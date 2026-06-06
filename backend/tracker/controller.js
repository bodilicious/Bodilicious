import mongoose from "mongoose";
import Order from "./models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import { getShiprocketToken, getEstimatedDeliveryDate, pushOrderToShiprocket, createShiprocketReturn } from "./shiprocketservice.js";
import { sendOrderConfirmationEmail, sendOrderConfirmationAfterInvoice } from "../email/emailService.js";
import { logAction } from "../admin/controller.js";
import { trackServerEvent } from "../utils/posthog.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import StoreSettings from "../settings/models.js";
import { enqueueWhatsApp } from "../whatsapp/queue.js";
import { getSettings } from "../settings/cache.js";



/* =========================================================
   CREATE ORDER (Transaction + Shiprocket/Razorpay Integration)
========================================================= */

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingDetails, paymentMethod, marketing } = req.body;
    const userId = req.user._id;

    // Razorpay orders must use /api/payment/razorpay/init + /api/payment/verify flow
    if (paymentMethod === "razorpay") {
      return res.status(400).json({ success: false, message: "Use /api/payment/razorpay/init for online payments" });
    }

    if (!items || items.length === 0) {
      throw new Error("No items provided");
    }

    if (!shippingDetails?.address) {
      throw new Error("Shipping details required");
    }

    let totalAmount = 0;
    let totalWeightGrams = 0; // For Shiprocket EDD
    const orderItems = [];

    // 🔹 Validate stock + calculate total
    for (const item of items) {
      let product;
      if (mongoose.Types.ObjectId.isValid(item.productId)) {
        product = await Product.findById(item.productId).session(session);
      }
      if (!product) {
        const searchPid = item.pid || item.productId;
        product = await Product.findOne({ pid: searchPid }).session(session);
      }

      if (!product) throw new Error("Product not found");

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      totalAmount += product.price * item.quantity;
      
      const itemWeightG = product.product_weight_g || (product.product_weight_ml ? product.product_weight_ml * 1.05 : 200); // Base estimate if no weight is found
      totalWeightGrams += itemWeightG * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        priceAtPurchase: product.price,
      });

      product.stock -= item.quantity;
      await product.save({ session });
    }

    const settings = await StoreSettings.findOne().session(session) || { shippingThreshold: 999, shippingCost: 99 };
    const shippingCost = totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost;
    let originalAmount = totalAmount + shippingCost;
    let finalAmount = originalAmount;
    let isWelcomeOfferApplied = false;
    let discountAmount = 0;

    // 🔹 Verify Welcome Offer Eligibility
    // Only eligible if there are no past orders in an active/successful state
    const existingOrdersCount = await Order.countDocuments({
      user: userId,
      orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
    }).session(session);

    if (existingOrdersCount === 0) {
      isWelcomeOfferApplied = true;
      discountAmount = Math.round(originalAmount * 0.10); // 10% off
      finalAmount = Math.max(0, originalAmount - discountAmount); // Ensure order total doesn't go below 0
    }

    const finalPaymentMethod = paymentMethod || "cod";
    
    // Calculate total weight in kg (Shiprocket requires minimum 0.5kg)
    const totalWeight = Math.max(0.5, totalWeightGrams / 1000);

    // 🔹 Calculate Estimated Delivery Date (EDD)
    let eddData = {
      estimatedDeliveryDate: null,
      estimatedDeliveryDays: null,
      estimatedCourierName: null,
      eddCalculatedAt: null,
    };

    try {
      const eddResponse = await getEstimatedDeliveryDate(
        shippingDetails.pincode,
        totalWeight,
        finalPaymentMethod === "cod"
      );
      if (eddResponse) {
        eddData = {
          estimatedDeliveryDate: eddResponse.estimatedDeliveryDate,
          estimatedDeliveryDays: eddResponse.estimatedDeliveryDays,
          estimatedCourierName: eddResponse.estimatedCourierName,
          eddCalculatedAt: new Date(),
        };
      }
    } catch (err) {
      console.error("EDD calculation failed safely:", err.message);
    }

    // 🔹 Create Order in MongoDB
    const [order] = await Order.create(
      [{
          user: userId,
          items: orderItems,
          totalAmount: finalAmount,
          discountAmount,
          isWelcomeOfferApplied,
          originalAmount,
          paymentMethod: finalPaymentMethod,
          paymentStatus: "pending",
          orderStatus: "pending",
          shippingDetails,
          marketing: marketing || undefined,
          ...eddData,
        }],
      { session }
    );

    await UserProfile.findByIdAndUpdate(
      userId,
      { $push: { orders: order._id }, $set: { cart: [] } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // ── Generate Invoice ──────────────────────────────────────────────
    let invoiceNumber = null;
    try {
      invoiceNumber = `INV-${Date.now()}-${order._id.toString().slice(-4).toUpperCase()}`;
      await Order.findByIdAndUpdate(order._id, {
        invoiceNumber,
        invoiceGenerated: true
      });
      console.log(`🧾 Invoice generated for order ${order._id}: ${invoiceNumber}`);
    } catch (invErr) {
      console.error("❌ Invoice generation failed:", invErr.message);
    }

    // ── Trigger Order Confirmation Email (Asynchronous/Non-blocking) ──
    const populatedOrder = await Order.findById(order._id).populate("items.product");
    const user = await UserProfile.findById(userId);
    
    if (invoiceNumber) {
      sendOrderConfirmationAfterInvoice(populatedOrder, user?.email);
    } else {
      console.warn("⚠️ Invoice generation failed or missing, skipping email trigger.");
    }

    /* =========================================================
       SHIPROCKET INTEGRATION (Non-blocking)
       Trigger only if COD. For Razorpay, it's triggered after payment verification.
    ========================================================= */
    if (finalPaymentMethod === "cod") {
      // 🚀 Background Push: Faster response to user
      pushOrderToShiprocket(populatedOrder).catch(shipErr => {
        console.error("Shiprocket background push error:", shipErr.message);
      });
    }

    // 🚀 Audit Order Placement
    logAction(req, "order_placed", "order", order._id.toString(), {
      total: order.totalAmount,
      itemCount: order.items.length,
      paymentMethod: order.paymentMethod
    }).catch(err => console.error("Order Placed Audit Failed:", err));

    // 🚀 PostHog Server-Side Tracking
    trackServerEvent(userId, 'Order Completed', {
      orderId: order._id.toString(),
      revenue: order.totalAmount,
      shipping: shippingCost,
      tax: 0,
      paymentMethod: order.paymentMethod,
      products: orderItems.map(item => ({
        productId: item.product.toString(),
        price: item.priceAtPurchase,
        quantity: item.quantity
      }))
    });

    return res.status(201).json({
      success: true,
      data: { order: populatedOrder },
    });

  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};



/* =========================================================
   TRACK ORDER (Real Shiprocket Tracking)
========================================================= */

export const trackShiprocketOrder = async (req, res) => {
  try {
    const { awb } = req.params;
    const userId = req.user._id;

    let order;

    if (mongoose.Types.ObjectId.isValid(awb)) {
      order = await Order.findOne({
        _id: awb,
        user: userId,
      });
    } else {
      order = await Order.findOne({
        awb,
        user: userId,
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.awb) {
      return res.status(400).json({
        success: false,
        message: "AWB not generated yet",
      });
    }

    if (!process.env.SHIPROCKET_EMAIL) {
      return res.status(500).json({
        success: false,
        message: "Shiprocket credentials not configured",
      });
    }

    const token = await getShiprocketToken();

    const trackRes = await fetch(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${order.awb}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!trackRes.ok) {
      throw new Error("Tracking failed");
    }

    const trackData = await trackRes.json();

    const info = trackData?.tracking_data;

    if (!info || info.track_status === 0) {
      return res.status(404).json({
        success: false,
        message: "Tracking not available yet",
      });
    }

    const timeline =
      info.shipment_track_activities?.map((a) => ({
        status: a.activity,
        location: a.location,
        date: a.date,
        completed: true,
      })) || [];

    return res.json({
      success: true,
      data: {
        awb: order.awb,
        status: info.shipment_status || "Processing",
        expectedDelivery: "Coming soon",
        timeline,
      },
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



/* =========================================================
   GET MY ORDERS
========================================================= */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.product");

    return res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



/* =========================================================
   GET SINGLE ORDER
========================================================= */
export const getSingleOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    }).populate("items.product");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



/* =========================================================
   SHIPROCKET WEBHOOK (Real-time Status Sync)
   POST /api/orders/webhook/shiprocket
========================================================= */
export const shiprocketWebhook = async (req, res) => {
  try {
    // ── Token verification ──────────────────────────────────────────────────
    // Set SHIPROCKET_WEBHOOK_TOKEN in .env, then append it to the URL you
    // enter in the Shiprocket dashboard:
    //   POST /api/v1/orders/webhook/shipping?token=<SHIPROCKET_WEBHOOK_TOKEN>
    // Shiprocket also supports sending it as X-Webhook-Token header.
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    const providedToken = req.query.token || req.headers["x-webhook-token"];

    if (!expectedToken || providedToken !== expectedToken) {
      console.warn("[Shiprocket Webhook] Blocked unauthorized request — IP:", req.ip);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    // ───────────────────────────────────────────────────────────────────────

    const { awb, status, current_status, order_id, channel_order_id } = req.body;
    const shiprocketStatus = (current_status || status || "").toLowerCase();

    if (!awb) {
      return res.status(400).json({ success: false, message: "AWB missing" });
    }

    console.log(`[Shiprocket Webhook] AWB: ${awb}, Status: ${shiprocketStatus}`);

    // Map Shiprocket statuses to our internal statuses
    const statusMap = {
      "new": "pending",
      "awb assigned": "processing",
      "manifested": "processing",
      "label generated": "processing",
      "pickup scheduled": "processing",
      "shipped": "shipped",
      "in transit": "shipped",
      "out for delivery": "shipped", // Or refine to a more granular status if needed
      "delivered": "delivered",
      "cancelled": "cancelled",
      "rto initiated": "returned",
      "rto delivered": "returned",
    };

    const internalStatus = statusMap[shiprocketStatus];

    const lookupQuery = [{ awb: awb }, { returnAwb: awb }];
    if (order_id) {
      lookupQuery.push({ shiprocketOrderId: order_id });
      lookupQuery.push({ shiprocketOrderId: String(order_id) });
      // Add return order matching
      lookupQuery.push({ returnShiprocketOrderId: order_id });
      lookupQuery.push({ returnShiprocketOrderId: String(order_id) });
    }

    const order = await Order.findOne({ $or: lookupQuery });

    if (order) {
      let isUpdated = false;

      // Check if this webhook is for a forward shipment or a return shipment
      const isReturn = (order.returnShiprocketOrderId == order_id) || (order.returnAwb === awb);

      // Auto-save the AWB depending on whether it's forwarding or returning
      if (!isReturn && !order.awb && awb && !shiprocketStatus.includes("rto") && !shiprocketStatus.includes("return")) {
        order.awb = awb;
        isUpdated = true;
        console.log(`[Shiprocket Webhook] Auto-saved new AWB ${awb} for Order ${order._id}`);
      } else if (isReturn && !order.returnAwb && awb) {
        order.returnAwb = awb;
        isUpdated = true;
        console.log(`[Shiprocket Webhook] Auto-saved new Return AWB ${awb} for Order ${order._id}`);
      }

      if (internalStatus) {
        // Only update if it's a "forward" movement to prevent overwriting deliberate manual overrides
        const statusPriority = ["pending", "processing", "shipped", "delivered"];
        const currentPriority = statusPriority.indexOf(order.orderStatus);
        const newPriority = statusPriority.indexOf(internalStatus);

        if (newPriority > currentPriority || internalStatus === "cancelled" || internalStatus === "returned") {
          order.orderStatus = internalStatus;
          isUpdated = true;
          
          // Delivered special handling
          if (internalStatus === "delivered" && order.isWelcomeOfferApplied) {
             await UserProfile.findByIdAndUpdate(order.user, {
                $set: { welcomeOfferUsed: true },
             });
          }

          console.log(`[Shiprocket Webhook] Order ${order._id} updated to ${internalStatus}`);
          
          // Trigger WhatsApp alert for Out for Delivery
          if (shiprocketStatus === "out for delivery") {
            const settings = await getSettings();
            if (settings.waAllEnabled && settings.waOutForDeliveryEnabled) {
              enqueueWhatsApp("out_for_delivery", {
                orderId: order._id.toString()
              }).catch(err => console.error("Failed to enqueue WhatsApp out_for_delivery:", err));
            }
          }

          // 🚀 Audit Fulfillment Events
          if (internalStatus === "shipped") {
             logAction(req, "shipment_created", "order", order._id.toString(), { awb, status: shiprocketStatus }, { source: "shiprocket-webhook" }).catch(err => console.error("Fulfillment Audit Failed:", err));
          } else if (internalStatus === "delivered") {
             logAction(req, "order_delivered", "order", order._id.toString(), { awb }, { source: "shiprocket-webhook" }).catch(err => console.error("Fulfillment Audit Failed:", err));
          } else if (internalStatus === "returned" || shiprocketStatus.includes("rto") || shiprocketStatus.includes("failed")) {
             logAction(req, "delivery_failed", "order", order._id.toString(), { awb, reason: shiprocketStatus }, { source: "shiprocket-webhook", severity: "WARNING" }).catch(err => console.error("Fulfillment Audit Failed:", err));
          }
        }
      }

      if (isUpdated) {
        await order.save();
      }
    }

    // Always respond with 200 to Shiprocket
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("[Shiprocket Webhook Error]", err.message);
    return res.status(500).json({ success: false });
  }
};



/* =========================================================
   UPDATE SHIPPING ADDRESS
========================================================= */
export const updateShippingAddress = async (req, res) => {
  try {
    const { name, email, phone, address, city, state, pincode } = req.body;

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Usually you don't allow changing address if it's already shipped/delivered.
    if (order.orderStatus === "shipped" || order.orderStatus === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Cannot update address for shipped/delivered orders.",
      });
    }

    order.shippingDetails = {
      ...order.shippingDetails,
      name: name || order.shippingDetails?.name,
      email: email || order.shippingDetails?.email,
      phone: phone || order.shippingDetails?.phone,
      address: address || order.shippingDetails?.address,
      city: city || order.shippingDetails?.city,
      state: state || order.shippingDetails?.state,
      pincode: pincode || order.shippingDetails?.pincode,
    };

    /* =========================================================
       Sync Address with Shiprocket if order has been pushed
    ========================================================= */
    if (order.shiprocketOrderId && process.env.SHIPROCKET_EMAIL) {
      try {
        const token = await getShiprocketToken();

        const nameParts = (order.shippingDetails.name || "").trim().split(" ");
        const firstName = nameParts[0] || "Customer";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

        const safePhone = (order.shippingDetails.phone || "").replace(/\D/g, "");
        const finalPhone = safePhone.length >= 10 ? safePhone.slice(-10) : "9999999999";

        const safePincode = (order.shippingDetails.pincode || "").replace(/\D/g, "");
        const finalPincode = safePincode.length === 6 ? safePincode : "110001";

        const updatePayload = {
          order_id: order.shiprocketOrderId,
          shipping_customer_name: firstName,
          shipping_last_name: lastName,
          shipping_phone: finalPhone,
          shipping_address: order.shippingDetails.address || "No Address Provided",
          shipping_city: order.shippingDetails.city || "Delhi",
          shipping_state: order.shippingDetails.state || "Delhi",
          shipping_country: "India",
          shipping_pincode: finalPincode
        };

        const shipRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/address/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(updatePayload)
        });

        if (!shipRes.ok) {
          const errText = await shipRes.text();
          console.error("Failed to update Shiprocket address:", errText);
        }
      } catch (shipErr) {
        console.error("Shiprocket update address error:", shipErr.message);
      }
    }

    await order.save();
    const populatedOrder = await Order.findById(order._id).populate("items.product");

    return res.json({
      success: true,
      data: populatedOrder,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================================
   CANCEL ORDER
========================================================= */
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        user: req.user._id,
        orderStatus: { $in: ["processing", "pending"] },
      },
      { $set: { orderStatus: "cancelled" } },
      { new: true }
    );

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled or not found",
      });
    }

    /* =========================================================
       Cancel on Shiprocket if shipmentId/AWB exists
    ========================================================= */
    if (order.awb || order.shiprocketOrderId) {
      try {
        if (process.env.SHIPROCKET_EMAIL) {
          const token = await getShiprocketToken();

          if (order.awb) {
            await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel/awbs", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ awbs: [order.awb] })
            });
          } else if (order.shiprocketOrderId) {
            await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ ids: [order.shiprocketOrderId] })
            });
          }
        }
      } catch (err) {
        console.error("Failed to cancel on Shiprocket:", err.message);
      }
    }

    /* =========================================================
       Razorpay Refund — only if paid online
    ========================================================= */
    let refundResult = null;
    if (order.paymentStatus === "paid" && order.razorpayPaymentId) {
      try {
        const razorpayInstance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const refund = await razorpayInstance.payments.refund(order.razorpayPaymentId, {
          amount: Math.round(order.totalAmount * 100), // paise
          speed: "normal",
          notes: { reason: "Order cancelled by customer" },
        });

        order.refundId = refund.id;
        order.refundStatus = "pending";
        order.refundAmount = order.totalAmount;
        order.paymentStatus = "refunded";
        refundResult = refund;
      } catch (refundErr) {
        console.error("Razorpay refund failed (cancel):", refundErr.message);
        // Don't block cancellation if refund call fails
        order.refundStatus = "failed";
        order.refundAmount = order.totalAmount;
      }
    }

    await order.save();

    // Restore stock for all cancelled items
    if (order.items && order.items.length > 0) {
      try {
        const bulkOps = order.items.map(item => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        }));
        await Product.bulkWrite(bulkOps);
      } catch (stockErr) {
        // Non-fatal: log but don't block the cancellation response
        console.error("Failed to restore stock after cancellation:", stockErr.message);
      }
    }

    // 🚀 Audit Order Cancellation
    logAction(req, "order_cancelled", "order", order._id.toString(), {
      reason: "Cancelled by user"
    }).catch(err => console.error("Order Cancelled Audit Failed:", err));

    return res.json({
      success: true,
      data: order,
      refund: refundResult
        ? { id: refundResult.id, status: refundResult.status, amount: order.totalAmount }
        : null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



/* =========================================================
   SOFT DELETE ORDER
========================================================= */
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        user: req.user._id,
      },
      { isDeleted: true },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      data: {},
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



/* =========================================================
   REQUEST RETURN
   POST /api/orders/:orderId/return
   Body: { reason: string }
========================================================= */
export const requestReturn = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid return reason (min 5 characters).",
      });
    }

    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Only delivered orders can be returned
    if (order.orderStatus !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can have a return request.",
      });
    }

    // Block duplicate requests
    if (order.returnStatus && order.returnStatus !== "none" && order.returnStatus !== "rejected") {
      return res.status(400).json({
        success: false,
        message: `A return request is already ${order.returnStatus} for this order.`,
      });
    }

    order.returnStatus = "requested";
    order.returnReason = reason.trim();
    order.returnRequestedAt = new Date();
    order.orderStatus = "return_requested";
    await order.save();

    // 🚀 Automate Shiprocket Return Creation (Non-blocking)
    const freshOrder = await Order.findById(order._id).populate("items.product");
    createShiprocketReturn(freshOrder, reason.trim()).catch(err => {
      console.error("Delayed Shiprocket return error:", err.message);
    });

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully.",
      data: order,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};




/* =========================================================
   UPDATE ORDER STATUS (Admin / Webhook)
   PATCH /api/orders/:orderId/status
   Body: { status: "delivered" | "shipped" | ... }
========================================================= */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "return_requested", "returned"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", "),
      });
    }

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.orderStatus = status;
    await order.save();

    // 🔹 When delivered → mark welcome offer as used for this user
    if (status === "delivered" && order.isWelcomeOfferApplied) {
      await UserProfile.findByIdAndUpdate(order.user, {
        $set: { welcomeOfferUsed: true },
      });
    }

    return res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================================
   ADD CUSTOMER COMMENT
   POST /api/orders/:orderId/comment
========================================================= */
export const addOrderComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Comment must be under 1000 characters" });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Ensure the order belongs to this user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Cap at 10 comments per order to avoid abuse
    if (order.customerComments.length >= 10) {
      return res.status(400).json({ success: false, message: "Maximum 10 comments per order" });
    }

    order.customerComments.push({ text: text.trim(), createdAt: new Date() });
    await order.save();

    return res.status(201).json({
      success: true,
      data: order.customerComments,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};