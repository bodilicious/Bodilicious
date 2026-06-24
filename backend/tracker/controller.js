import mongoose from "mongoose";
import { calculateDiscount } from "../utils/pricing.js";
import Order from "./models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import { getShiprocketToken, getEstimatedDeliveryDate, pushOrderToShiprocket, createShiprocketReturn } from "./shiprocketservice.js";
import { sendOrderConfirmationEmail, sendOrderConfirmationAfterInvoice, sendOrderShippedEmail, sendAdminNewOrderAlert } from "../email/emailService.js";
import { logAction } from "../admin/controller.js";
import { trackServerEvent } from "../utils/posthog.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import StoreSettings from "../settings/models.js";
import { enqueueWhatsApp } from "../whatsapp/queue.js";
import { getSettings } from "../settings/cache.js";
import NotificationService from "../procurement/notificationService.js";
import orderEvents from "../events/orderEvents.js";
import { toRazorpayMinorUnits } from "../utils/currencies.js";
import { fetchProductMaps, resolveProduct } from "../utils/productLookup.js";


/* =========================================================
   HANDLE ORDER CANCELLATION SIDE EFFECTS
========================================================= */
export const handleOrderCancellationSideEffects = async (order) => {
    // Prevent double refunds
    if (order.refundStatus === "processed" || order.refundStatus === "pending") {
        return null;
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
          amount: toRazorpayMinorUnits(order.totalAmount, order.currency || "INR"),
          speed: "normal",
          notes: { reason: "Order cancelled" },
        });

        order.refundId = refund.id;
        order.refundStatus = "pending";
        order.refundAmount = order.totalAmount;
        order.paymentStatus = "refunded";
        refundResult = refund;
      } catch (refundErr) {
        console.error("Razorpay refund failed (cancel side-effects):", refundErr.message);
        order.refundStatus = "failed";
        order.refundAmount = order.totalAmount;
      }
    }

    // Restore stock
    if (!order.isStockRestored && order.items && order.items.length > 0) {
      const claimedOrder = await Order.findOneAndUpdate(
        { _id: order._id, isStockRestored: false },
        { $set: { isStockRestored: true } }
      );
      if (claimedOrder) {
        try {
          const bulkOps = order.items.map(item => ({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { stock: item.quantity } },
            },
          }));
          await Product.bulkWrite(bulkOps);
          order.isStockRestored = true;
        } catch (stockErr) {
          console.error("Failed to restore stock after cancellation:", stockErr.message);
          await NotificationService.emit({
              title: "CRITICAL: Stock Restoration Failed in DB",
              body: `Order ${order._id.toString().slice(-6).toUpperCase()} was claimed for stock restore, but bulkWrite failed: ${stockErr.message}. Manual inventory fix required!`,
              type: "error",
              sourceModule: "orders",
              sourceModel: "Order",
              sourceId: order._id.toString()
          }).catch(e => console.error("Notification Service failed:", e));
        }
      }
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
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ awbs: [order.awb] })
            });
          } else if (order.shiprocketOrderId) {
            await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ids: [order.shiprocketOrderId] })
            });
          }
        }
      } catch (err) {
        console.error("Failed to cancel on Shiprocket:", err.message);
      }
    }

    return refundResult;
};

/* =========================================================
   CREATE ORDER (Transaction + Shiprocket/Razorpay Integration)
========================================================= */

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingDetails, billingDetails, paymentMethod, marketing } = req.body;
    const userId = req.user._id;

    // Razorpay orders must use /api/payment/razorpay/init + /api/payment/verify flow
    if (paymentMethod === "razorpay") {
      return res.status(400).json({ success: false, message: "Use /api/payment/razorpay/init for online payments" });
    }

    if (!items || items.length === 0) {
      throw new Error("No items provided");
    }

    // Strictly validate and merge duplicate items
    const mergedItemsMap = {};
    for (const item of items) {
        if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
            throw new Error("Invalid item quantity");
        }
        const id = item.productId || item.pid;
        if (!id) throw new Error("Invalid item ID");
        
        if (!mergedItemsMap[id]) mergedItemsMap[id] = { ...item, quantity: 0 };
        mergedItemsMap[id].quantity += item.quantity;
    }
    const mergedItems = Object.values(mergedItemsMap);

    if (!shippingDetails?.address) {
      throw new Error("Shipping details required");
    }

    const country = shippingDetails.country?.trim() || "India";
    const isIndia = ["india", "in", "bharat", "ind"].includes(country.toLowerCase());
    
    if (!isIndia) {
        throw new Error("Cash on Delivery (COD) is only available within India. Please use online payment for international orders.");
    }

    let totalAmount = 0;
    let totalWeightGrams = 0; // For Shiprocket EDD
    const orderItems = [];

    // 🔹 Batch-fetch all products in one round-trip (avoids N sequential DB calls inside the transaction)
    const { mapById: codMapById, mapByPid: codMapByPid } = await fetchProductMaps(mergedItems, { session });

    // 🔹 Validate stock + calculate total
    for (const item of mergedItems) {
      const product = resolveProduct(item, codMapById, codMapByPid);

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
    }

    const settings = await StoreSettings.findOne().session(session) || { shippingThreshold: 999, shippingCost: 99 };
    const shippingCost = totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost;
    // 🔹 Verify Welcome Offer Eligibility
    // Only eligible if there are no past orders in an active/successful state
    const userProfile = await UserProfile.findById(userId).select("welcomeOfferUsed").session(session);
    let existingOrdersCount = 0;
    if (userProfile?.welcomeOfferUsed) {
        existingOrdersCount = 1;
    } else {
        existingOrdersCount = await Order.countDocuments({
            user: userId,
            orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
            $or: [
                { paymentMethod: "cod" },
                { paymentMethod: "razorpay", paymentStatus: { $in: ["paid", "refunded"] } }
            ]
        }).session(session);
    }

    const pricing = calculateDiscount(totalAmount, shippingCost, { existingOrdersCount });
    const { finalAmount, discountAmount, originalAmount, isWelcomeOfferApplied } = pricing;

    if (isWelcomeOfferApplied) {
        const profileClaim = await UserProfile.findOneAndUpdate(
            { _id: userId, welcomeOfferUsed: { $ne: true } },
            { $set: { welcomeOfferUsed: true } },
            { session, new: true }
        );
        if (!profileClaim) {
            throw new Error("Welcome offer no longer valid. Please refresh your checkout.");
        }
    }

    // Deduct stock atomically to prevent overselling
    const bulkOps = orderItems.map(item => ({
        updateOne: {
            filter: { _id: item.product, stock: { $gte: item.quantity } },
            update: { $inc: { stock: -item.quantity } }
        }
    }));
    const bulkResult = await Product.bulkWrite(bulkOps, { session });
    if (bulkResult.modifiedCount !== orderItems.length) {
        throw new Error("Insufficient stock for one or more items. Another customer may have just purchased the last unit.");
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
          shippingCost,
          discountAmount,
          isWelcomeOfferApplied,
          originalAmount,
          paymentMethod: finalPaymentMethod,
          paymentStatus: "pending",
          orderStatus: "pending",
          shippingDetails,
          billingDetails: billingDetails || null,
          marketing: marketing || undefined,
          ...eddData,
        }],
      { session }
    );

    const productIdsToRemove = orderItems.map(i => i.product);
    await UserProfile.findByIdAndUpdate(userId, { 
      $addToSet: { orders: order._id },
      $pull: { cart: { product: { $in: productIdsToRemove } } }
    }).session(session);

    await session.commitTransaction();
    session.endSession();

    // ── Third Party Events (Decoupled) ────────────────────────────────
    let populatedOrder;
    try {
        populatedOrder = await Order.findById(order._id).populate("items.product");

        // ── Generate Invoice ──────────────────────────────────────────────
        try {
          const invoiceNumber = `INV-${populatedOrder._id.toString().toUpperCase()}`;
          await Order.findByIdAndUpdate(populatedOrder._id, {
            invoiceNumber,
            invoiceGenerated: true
          });
          populatedOrder.invoiceNumber = invoiceNumber;
          populatedOrder.invoiceGenerated = true;
          console.log(`🧾 Invoice generated for order ${populatedOrder._id}: ${invoiceNumber}`);
        } catch (invErr) {
          console.error("❌ Invoice generation failed:", invErr.message);
          await NotificationService.emit({
              title: "CRITICAL: COD Invoice Generation Failed",
              body: `Failed to generate invoice for COD order ${populatedOrder._id}: ${invErr.message}`,
              type: "error",
              sourceModule: "orders",
              sourceModel: "Order",
              sourceId: populatedOrder._id.toString()
          }).catch(e => console.error("Notification Service failed:", e));
        }

        orderEvents.emit("order_placed", populatedOrder);
    } catch (eventErr) {
        console.error("❌ Failed to emit order events:", eventErr);
    }

    // 🚀 Audit Order Placement
    logAction(req, "order_placed", "order", order._id.toString(), {
      total: order.totalAmount,
      itemCount: order.items.length,
      paymentMethod: order.paymentMethod
    }).catch(err => console.error("Order Placed Audit Failed:", err));

    return res.status(201).json({
      success: true,
      data: { order: populatedOrder || order },
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

    // If tracking is not yet live on Shiprocket but we have the AWB
    if (!info || info.track_status === 0) {
      return res.json({
        success: true,
        data: {
          awb: order.awb,
          status: order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1),
          expectedDelivery: order.estimatedDeliveryDate 
            ? new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
            : "Soon",
          timeline: [
            { status: 'Order Confirmed', location: 'System', date: new Date(order.createdAt).toLocaleDateString(), completed: true },
            { status: 'Processing', location: 'Warehouse', date: '', completed: false }
          ]
        }
      });
    }

    const timeline =
      info.shipment_track_activities?.map((a) => ({
        status: a.activity,
        location: a.location,
        date: a.date,
        completed: true,
      })) || [];
      
    const currentStatus = info.shipment_track?.[0]?.current_status || order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1);
    const expectedDeliveryDate = info.shipment_track?.[0]?.edd 
                                  ? new Date(info.shipment_track[0].edd).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                                  : order.estimatedDeliveryDate 
                                    ? new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                                    : "Coming soon";

    return res.json({
      success: true,
      data: {
        awb: order.awb,
        status: currentStatus,
        expectedDelivery: expectedDeliveryDate,
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
    const orders = await Order.find({
      user: req.user._id,
      orderStatus: { $ne: "abandoned" },
      $nor: [
        { paymentMethod: "razorpay", paymentStatus: { $in: ["pending", "failed"] } },
        { paymentMethod: "razorpay", paymentStatus: "paid", invoiceGenerated: { $ne: true } }
      ]
    })
      .sort({ createdAt: -1 })
      .select("items totalAmount orderStatus paymentStatus createdAt estimatedDeliveryDate returnStatus invoiceNumber awb isWelcomeOfferApplied shippingCost discountAmount originalAmount currency exchangeRate deliveredAt taxAmount")
      .populate("items.product", "name images price pid slug")
      .lean();

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
      orderStatus: { $ne: "abandoned" },
      $nor: [
        { paymentMethod: "razorpay", paymentStatus: { $in: ["pending", "failed"] } },
        { paymentMethod: "razorpay", paymentStatus: "paid", invoiceGenerated: { $ne: true } }
      ]
    })
      .select("-adminNote -statusHistory -needsManualReview -reviewReason -razorpaySignature -paymentClaimedAt -lastClaimFailedAt -paymentLinkId -paymentLink")
      .populate("items.product")
      .lean();

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
    const providedToken = req.headers["x-webhook-token"];

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
      const isReturn = (String(order.returnShiprocketOrderId) === String(order_id)) || (order.returnAwb === awb);

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
          
          // Delivered: mark COD orders as paid — payment is collected at the door,
          // so Shiprocket's delivery confirmation is the correct trigger to set paymentStatus.
          if (internalStatus === "delivered" && order.paymentMethod === "cod" && order.paymentStatus !== "paid") {
              order.paymentStatus = "paid";
              isUpdated = true;
          }

          // Stamp deliveredAt exactly once — used by the return window enforcement
          if (internalStatus === "delivered" && !order.deliveredAt) {
              order.deliveredAt = new Date();
              isUpdated = true;
          }

          console.log(`[Shiprocket Webhook] Order ${order._id} updated to ${internalStatus}`);
          
          // Trigger WhatsApp alert for Out for Delivery
          if (shiprocketStatus === "out for delivery") {
            const settings = await getSettings();
            if (settings.waAllEnabled && settings.waOutForDeliveryEnabled) {
              await enqueueWhatsApp("out_for_delivery", {
                orderId: order._id.toString()
              }).catch(err => console.error("Failed to enqueue WhatsApp out_for_delivery:", err));
            }
          }

          // 🚀 Audit Fulfillment Events
          if (internalStatus === "shipped") {
             await logAction(req, "shipment_created", "order", order._id.toString(), { awb, status: shiprocketStatus }, { source: "shiprocket-webhook" }).catch(err => console.error("Fulfillment Audit Failed:", err));
             
             // 🚀 Trigger Shipment Email
             const trackingUrl = `${process.env.FRONTEND_URL || 'https://www.bodilicious.in'}/account/tracking?awb=${awb}`;
             await sendOrderShippedEmail(order, trackingUrl, order.shippingDetails?.email, order.shippingDetails?.name).catch(err => console.error("Shipment Email Failed:", err));

          } else if (internalStatus === "delivered") {
             await logAction(req, "order_delivered", "order", order._id.toString(), { awb }, { source: "shiprocket-webhook" }).catch(err => console.error("Fulfillment Audit Failed:", err));
          } else if (internalStatus === "returned" || shiprocketStatus.includes("rto") || shiprocketStatus.includes("failed")) {
             await logAction(req, "delivery_failed", "order", order._id.toString(), { awb, reason: shiprocketStatus }, { source: "shiprocket-webhook", severity: "WARNING" }).catch(err => console.error("Fulfillment Audit Failed:", err));
             
             // Release welcome offer for returned/failed deliveries
             if (order.isWelcomeOfferApplied && (internalStatus === "returned" || shiprocketStatus.includes("rto"))) {
                 const userHasPaidOrder = await Order.exists({
                     user: order.user,
                     orderStatus: { $nin: ["abandoned", "cancelled", "returned"] },
                     _id: { $ne: order._id },
                     $or: [
                         { paymentMethod: "cod" },
                         { paymentStatus: { $in: ["paid", "refunded"] } }
                     ]
                 });
                 if (!userHasPaidOrder) {
                     await UserProfile.updateOne({ _id: order.user }, { $set: { welcomeOfferUsed: false } });
                 }
             }

             if ((internalStatus === "cancelled" || shiprocketStatus === "rto delivered") && !order.isStockRestored) {
               if (order.items && order.items.length > 0) {
                 const claimedOrder = await Order.findOneAndUpdate(
                   { _id: order._id, isStockRestored: false },
                   { $set: { isStockRestored: true } }
                 );
                 if (claimedOrder) {
                   try {
                     const bulkOps = order.items.map(item => ({
                       updateOne: {
                         filter: { _id: item.product },
                         update: { $inc: { stock: item.quantity } },
                       },
                     }));
                     await Product.bulkWrite(bulkOps);
                     order.isStockRestored = true;
                     isUpdated = true;
                     console.log(`[Shiprocket Webhook] Restored stock for order ${order._id}`);
                   } catch (stockErr) {
                     console.error("Failed to restore stock on webhook:", stockErr.message);
                   }
                 }
               }
             }
          }
        }
      }

      if (isUpdated) {
        await order.save();
        orderEvents.emit("order_status_updated", order);
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
          return res.status(500).json({
            success: false,
            message: "Failed to sync new address with our shipping partner. Please try again."
          });
        }
      } catch (shipErr) {
        console.error("Shiprocket update address error:", shipErr.message);
        return res.status(500).json({
          success: false,
          message: "Internal error syncing address with shipping partner."
        });
      }
    }

    await Order.findByIdAndUpdate(order._id, {
      $set: { shippingDetails: order.shippingDetails }
    });
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
    const oldOrder = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        user: req.user._id,
        orderStatus: { $in: ["processing", "pending"] },
      },
      { $set: { orderStatus: "cancelled" } }
    );

    if (!oldOrder) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled or not found",
      });
    }

    const previousStatus = oldOrder.orderStatus;
    
    // Add history entry in a separate update since we couldn't do it dynamically inside findOneAndUpdate without complex aggregations
    await Order.updateOne(
      { _id: oldOrder._id },
      {
        $push: {
          statusHistory: {
            fromStatus: previousStatus,
            toStatus: "cancelled",
            status: "cancelled",
            changedBy: req.user._id,
            source: "user",
            changedAt: new Date()  // `changedAt` matches schema — `timestamp` was silently ignored
          }
        }
      }
    );

    const order = await Order.findById(oldOrder._id);

    orderEvents.emit("order_status_updated", order);

    if (order.isWelcomeOfferApplied) {
        const userHasPaidOrder = await Order.exists({
            user: order.user,
            orderStatus: { $nin: ["abandoned", "cancelled", "returned"] },
            _id: { $ne: order._id },
            $or: [
                { paymentMethod: "cod" },
                { paymentStatus: { $in: ["paid", "refunded"] } }
            ]
        });
        if (!userHasPaidOrder) {
            await UserProfile.updateOne({ _id: order.user }, { $set: { welcomeOfferUsed: false } });
        }
    }

    let refundResult = null;
    try {
        refundResult = await handleOrderCancellationSideEffects(order);
    } catch (err) {
        console.error("Side effects failed:", err.message);
    } finally {
        const setPayload = {
            refundId: order.refundId ?? null,
            refundStatus: order.refundStatus ?? null,
            refundAmount: order.refundAmount ?? null,
            paymentStatus: order.paymentStatus
        };
        if (order.isStockRestored) {
            setPayload.isStockRestored = true;
        }
        await Order.updateOne({ _id: order._id }, { $set: setPayload });
    }

    // 🚀 Audit Order Cancellation
    await logAction(req, "order_cancelled", "order", order._id.toString(), {
      reason: "Cancelled by user"
    }).catch(err => console.error("Order Cancelled Audit Failed:", err));

    await NotificationService.emit({
        title: "Order Cancelled",
        body: `Order ${order._id.toString().slice(-6).toUpperCase()} was cancelled. Reason: ${req.body?.reason || 'Not provided'}.`,
        type: "warning",
        sourceModule: "orders",
        sourceModel: "Order",
        sourceId: order._id.toString()
    });

    return res.json({
      success: true,
      data: { _id: order._id, orderStatus: order.orderStatus },
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
    // Only allow soft-deleting orders in a terminal state (delivered, cancelled,
    // returned, abandoned). Deleting active orders (processing / shipped) would
    // make them invisible in the DB while still live in Shiprocket, causing
    // admin confusion and blocking return requests after delivery.
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        user: req.user._id,
        orderStatus: { $in: ["delivered", "cancelled", "returned", "abandoned"] },
      },
      { isDeleted: true },
      { new: true }
    );

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be deleted. Only delivered, cancelled, or returned orders can be removed.",
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

    // Enforce configurable return window (StoreSettings.returnWindowDays, default 7)
    // Use deliveredAt if available; fall back to updatedAt for orders delivered before
    // this field was added (avoids permanently blocking returns on legacy orders).
    const settings = await getSettings();
    const returnWindowDays = settings?.returnWindowDays ?? 7;
    const deliveryTimestamp = order.deliveredAt || order.updatedAt;
    const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
    if (deliveryTimestamp && Date.now() - new Date(deliveryTimestamp).getTime() > windowMs) {
      return res.status(400).json({
        success: false,
        message: `Return window has closed. Returns must be requested within ${returnWindowDays} days of delivery.`,
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
    
    const previousStatus = order.orderStatus;
    order.orderStatus = "return_requested";

    order.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: "return_requested",
      status: "return_requested",
      changedBy: req.user._id,
      source: "user",
      changedAt: new Date()  // `changedAt` matches schema — `timestamp` was silently ignored
    });

    await order.save();
    orderEvents.emit("order_status_updated", order);

    // 🚀 Automate Shiprocket Return Creation (Non-Blocking)
    const freshOrder = await Order.findById(order._id).populate("items.product");
    createShiprocketReturn(freshOrder, reason.trim()).catch(err => {
      console.error("Delayed Shiprocket return error:", err.message);
    });

    await NotificationService.emit({
        title: "Return Requested",
        body: `Order ${order._id.toString().slice(-6).toUpperCase()} requested a return: ${reason.trim()}`,
        type: "warning",
        sourceModule: "orders",
        sourceModel: "Order",
        sourceId: order._id.toString()
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

    const previousStatus = order.orderStatus;
    order.orderStatus = status;

    order.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: status,
      status: status,
      changedBy: req.user._id,
      source: "admin",
      changedAt: new Date()  // `changedAt` matches schema — `timestamp` was silently ignored
    });

    await order.save();
    orderEvents.emit("order_status_updated", order);

    if (((status === "cancelled" && previousStatus !== "cancelled") || (status === "returned" && previousStatus !== "returned")) && order.isWelcomeOfferApplied) {
        const userHasPaidOrder = await Order.exists({
            user: order.user,
            orderStatus: { $nin: ["abandoned", "cancelled", "returned"] },
            _id: { $ne: order._id },
            $or: [
                { paymentMethod: "cod" },
                { paymentStatus: { $in: ["paid", "refunded"] } }
            ]
        });
        if (!userHasPaidOrder) {
            await UserProfile.updateOne({ _id: order.user }, { $set: { welcomeOfferUsed: false } });
        }
    }
    
    if (status === "cancelled" && previousStatus !== "cancelled") {
        try {
            await handleOrderCancellationSideEffects(order);
        } catch (err) {
            console.error("Side effects failed:", err.message);
        } finally {
            const setPayload = {
                refundId: order.refundId ?? null,
                refundStatus: order.refundStatus ?? null,
                refundAmount: order.refundAmount ?? null,
                paymentStatus: order.paymentStatus
            };
            if (order.isStockRestored) {
                setPayload.isStockRestored = true;
            }
            await Order.updateOne({ _id: order._id }, { $set: setPayload });
        }
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