import mongoose from "mongoose";
import { calculateDiscount, calculateInclusiveTax, calculateShippingCost } from "../utils/pricing.js";
import Order, { customerVisibleOrderFilter, ORDER_ITEM_PRODUCT_FIELDS } from "./models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import { getShiprocketToken, getEstimatedDeliveryDate, pushOrderToShiprocket, createShiprocketReturn, isIndiaOrder, getInternationalShippingRate } from "./shiprocketservice.js";
import { sendOrderConfirmationEmail, sendOrderConfirmationAfterInvoice, sendOrderShippedEmail, sendAdminNewOrderAlert } from "../email/emailService.js";
import { logAction, applyAdminStatusChange } from "../admin/controller.js";
import { trackServerEvent } from "../utils/posthog.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import StoreSettings from "../settings/models.js";
import { enqueueWhatsApp } from "../whatsapp/queue.js";
import { getSettings } from "../settings/cache.js";
import NotificationService from "../procurement/notificationService.js";
import orderEvents from "../events/orderEvents.js";
import { toRazorpayMinorUnits, fromRazorpayMinorUnits } from "../utils/currencies.js";
import { fetchProductMaps, resolveProduct } from "../utils/productLookup.js";
import { safeEqual } from "../utils/signing.js";
import { validateCouponAtCheckout, claimCouponUsage, releaseCouponUsage } from "../coupons/controller.js";


// Internal/admin fields a customer must never receive.
const CUSTOMER_HIDDEN_ORDER_FIELDS = "-adminNote -statusHistory -needsManualReview -reviewReason -razorpaySignature -paymentClaimedAt -lastClaimFailedAt -paymentLinkId -paymentLink";

// Endpoints that return an order to its owner after a change used to send the raw
// document — admin notes and review flags included, and with items unpopulated, so
// the order list then showed "Unknown Product" until the next full reload.
const loadCustomerOrder = (orderId) =>
  Order.findById(orderId).select(CUSTOMER_HIDDEN_ORDER_FIELDS).populate("items.product", ORDER_ITEM_PRODUCT_FIELDS).lean();

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

        // No `amount`: Razorpay refunds whatever is still captured. Passing an amount
        // derived from totalAmount fails the whole refund if it exceeds the captured
        // amount by a rounding unit, or after an earlier partial refund — and a
        // cancellation is always meant to return the full remaining payment.
        const refund = await razorpayInstance.payments.refund(order.razorpayPaymentId, {
          speed: "normal",
          notes: { reason: "Order cancelled" },
        });

        order.refundId = refund.id;
        order.refundStatus = "pending";
        order.refundAmount = refund?.amount != null
          ? fromRazorpayMinorUnits(refund.amount, (refund.currency || order.currency || "INR").toUpperCase())
          : order.totalAmount;
        order.paymentStatus = "refunded";
        refundResult = refund;
      } catch (refundErr) {
        const msg = refundErr?.error?.description || refundErr.message;
        console.error("Razorpay refund failed (cancel side-effects):", msg);
        order.refundStatus = "failed";
        order.refundAmount = order.totalAmount;
        // Without a flag a failed refund was invisible: the order just read
        // "cancelled", the customer never got their money, and nothing prompted
        // anyone to refund by hand.
        order.needsManualReview = true;
        order.reviewReason = `Refund failed on cancellation (${msg}) — refund the customer manually in Razorpay.`;
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

    // Give back the coupon slot the cancelled order used
    await releaseCouponUsage(order._id).catch(err => console.error("Coupon release failed:", err.message));

    return refundResult;
};

/* =========================================================
   GET ORDER STATUS LITE
   Lightweight endpoint for polling order confirmation status
   Returns just ~100 bytes instead of the full profile payload
========================================================= */
export const getOrderStatusLite = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.isObjectIdOrHexString(orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Minimal query: only fetch fields needed for ConfirmationPage
    const order = await Order.findOne({ 
      _id: orderId, 
      user: req.user._id 
    }).select("paymentStatus orderStatus totalAmount").lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order status lite:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =========================================================
   CREATE ORDER (Transaction + Shiprocket/Razorpay Integration)
========================================================= */

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingDetails, billingDetails, paymentMethod, marketing, couponCode } = req.body;
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
        
        const key = `${id}:${item.variant || ''}`;
        
        if (!mergedItemsMap[key]) mergedItemsMap[key] = { ...item, quantity: 0 };
        mergedItemsMap[key].quantity += item.quantity;
    }
    const mergedItems = Object.values(mergedItemsMap);

    if (!shippingDetails?.address) {
      throw new Error("Shipping details required");
    }

    const country = shippingDetails.country?.trim() || "India";
    const isIndia = ["india", "in", "bharat", "ind"].includes(country.toLowerCase());

    // ── COD availability ──────────────────────────────────────────────────────
    // Read from settings rather than hardcoding, so the admin toggles control it.
    // International COD is OFF by default: no international courier can collect cash
    // on delivery, so such an order has to be settled out of band before dispatch.
    const codSettings = await getSettings();
    if (codSettings?.codEnabled === false) {
        throw new Error("Cash on Delivery is currently unavailable. Please use online payment.");
    }
    if (!isIndia && !codSettings?.codInternationalEnabled) {
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

      // fetchProductMaps doesn't filter on isActive — a hidden/discontinued product
      // could still be ordered from an existing cart.
      if (product.isActive === false) {
        throw new Error(`${product.name} is no longer available. Please remove it from your cart.`);
      }

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
        variant: item.variant || null,
      });
    }

    const settings = await StoreSettings.findOne().session(session) || {
      shippingThreshold: 999, shippingCost: 99,
      internationalShippingThreshold: 10000, internationalShippingCost: 2000
    };
    // The same shared helper getOrderQuote/initRazorpayOrder use. The inline copy here
    // charged the static international rate while the quote the customer had just seen
    // used the live Shiprocket rate, so an international COD total differed from it.
    const shippingCost = await calculateShippingCost({
      isIndia,
      totalAmount,
      settings,
      country,
      pincode: shippingDetails.pincode,
      totalWeightGrams,
      getInternationalShippingRate,
    });
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

    // ── Coupon (COD previously had no coupon support at all — a coupon applied
    // on the cart/shipping page would show a discounted total, then silently
    // vanish when the customer chose Cash on Delivery, charging full price
    // with no error. Validate + apply it the same way the Razorpay path does.) ──
    let coupon = null;
    if (couponCode) {
        const couponValidationResult = await validateCouponAtCheckout(couponCode, totalAmount, userId, [], orderItems);
        if (!couponValidationResult.valid) {
            throw new Error(couponValidationResult.error || "Invalid coupon code");
        }
        coupon = couponValidationResult.coupon;
    }

    const pricing = calculateDiscount(totalAmount, shippingCost, { existingOrdersCount }, coupon, orderItems);
    // pricing.shippingCost (not the outer `shippingCost`) is authoritative from
    // here on — a free_shipping coupon zeroes it out, and finalAmount is
    // computed against that effective value.
    const { finalAmount: goodsAndShipping, discountAmount, originalAmount: originalBeforeCod, isWelcomeOfferApplied, shippingCost: finalShippingCost } = pricing;

    // ── COD minimum + extra charge (admin settings) ──
    // Both were editable in Store Settings but never applied, so a "minimum order
    // for COD" didn't restrict anything and the COD fee was never charged.
    const codMinimum = Math.max(0, Number(codSettings?.minOrderValueForCOD) || 0);
    if (codMinimum > 0 && goodsAndShipping < codMinimum) {
        throw new Error(`Cash on Delivery is available on orders of ₹${codMinimum} or more. Please use online payment.`);
    }
    const codCharge = Math.max(0, Number(codSettings?.codExtraCharge) || 0);
    const finalAmount = goodsAndShipping + codCharge;
    const originalAmount = originalBeforeCod + codCharge;

    // GST disclosure, mirroring getOrderQuote: domestic only (exports are
    // zero-rated), carved out of finalAmount rather than added to it. COD orders
    // are always priced in INR, so no currency conversion is needed here.
    const codTaxAmount = calculateInclusiveTax(
        finalAmount,
        isIndia ? (codSettings?.taxRatePercent || 0) : 0
    );

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

    // 🔹 Create Order in MongoDB
    // (EDD is fetched after the commit below — it's a Shiprocket network call, and
    // inside the transaction a slow response held the stock locks open.)
    const [order] = await Order.create(
      [{
          user: userId,
          items: orderItems,
          totalAmount: finalAmount,
          shippingCost: finalShippingCost,
          codCharge,
          discountAmount,
          isWelcomeOfferApplied,
          couponCode: coupon ? coupon.code : null,
          appliedCoupon: coupon ? coupon._id : undefined,
          couponDiscount: coupon ? discountAmount : 0,
          originalAmount,
          taxAmount: codTaxAmount,
          paymentMethod: finalPaymentMethod,
          paymentStatus: "pending",
          orderStatus: "pending",
          shippingDetails,
          billingDetails: billingDetails || null,
          marketing: marketing || undefined,
        }],
      { session }
    );

    // Claim the coupon now, not at the pre-check above — nothing irreversible
    // has happened yet (no payment taken), so if a concurrent checkout won the
    // race for the last slot, aborting the transaction and asking the customer
    // to retry is correct here, unlike the Razorpay path where money has
    // already moved and the discount must be honored regardless.
    if (coupon) {
        const { claimed, reason } = await claimCouponUsage({
            couponId: coupon._id,
            userId,
            orderId: order._id,
            orderTotal: finalAmount,
            discountApplied: discountAmount,
            session
        });
        if (!claimed) {
            throw new Error(`Coupon is no longer available (${reason}). Please refresh your cart and try again.`);
        }
    }

    const productIdsToRemove = orderItems.map(i => i.product);
    await UserProfile.findByIdAndUpdate(userId, { 
      $addToSet: { orders: order._id },
      $pull: { cart: { product: { $in: productIdsToRemove } } }
    }).session(session);

    await session.commitTransaction();
    session.endSession();

    // 🔹 Estimated Delivery Date — best effort, outside the transaction
    if (isIndia) {
      try {
        const eddResponse = await getEstimatedDeliveryDate(shippingDetails.pincode, totalWeight, finalPaymentMethod === "cod");
        if (eddResponse) {
          await Order.updateOne({ _id: order._id }, { $set: {
            estimatedDeliveryDate: eddResponse.estimatedDeliveryDate,
            estimatedDeliveryDays: eddResponse.estimatedDeliveryDays,
            estimatedCourierName: eddResponse.estimatedCourierName,
            eddCalculatedAt: new Date(),
          } });
        }
      } catch (err) {
        console.error("EDD calculation failed safely:", err.message);
      }
    }

    // ── Third Party Events (Decoupled) ────────────────────────────────
    let populatedOrder;
    try {
        populatedOrder = await Order.findById(order._id).populate("items.product", ORDER_ITEM_PRODUCT_FIELDS);

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
    const orders = await Order.find(customerVisibleOrderFilter(req.user._id))
      .sort({ createdAt: -1 })
      .select("items totalAmount orderStatus paymentStatus paymentMethod createdAt estimatedDeliveryDate deliveredAt returnStatus invoiceNumber awb isWelcomeOfferApplied shippingCost codCharge discountAmount originalAmount currency exchangeRate taxAmount refundStatus customerComments")
      .populate("items.product", "name images price pid slug")
      .lean();

    if (orders) {
      orders.forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            if (item.product && item.product.images && item.product.images.length > 0) {
              item.product.images = item.product.images.slice(0, 1);
            }
          });
        }
      });
    }

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
    if (!mongoose.isObjectIdOrHexString(req.params.orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = await Order.findOne({ _id: req.params.orderId, ...customerVisibleOrderFilter(req.user._id) })
      .select(CUSTOMER_HIDDEN_ORDER_FIELDS)
      .populate("items.product", ORDER_ITEM_PRODUCT_FIELDS)
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.items) {
      order.items.forEach(item => {
        if (item.product && item.product.images && item.product.images.length > 0) {
          item.product.images = item.product.images.slice(0, 1);
        }
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
    // Set SHIPROCKET_WEBHOOK_TOKEN in .env, then supply it from the Shiprocket
    // dashboard either as the X-Webhook-Token header or as a query param:
    //   POST /api/v1/orders/webhook/shipping?token=<SHIPROCKET_WEBHOOK_TOKEN>
    // Both are accepted — previously only the header was read, so a dashboard
    // configured per the documented ?token= form silently 401'd and shipment
    // statuses stopped updating.
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    const providedToken = req.headers["x-webhook-token"] || req.query.token;

    if (!expectedToken || !safeEqual(String(providedToken || ""), expectedToken)) {
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
      "canceled": "cancelled", // Shiprocket's own spelling — "CANCELED"
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

      // A courier-side cancellation of a live order is flagged, not applied: setting
      // "cancelled" here skipped the refund and restock the cancel flows perform (and
      // "CANCELED", Shiprocket's spelling, never matched at all). Ops cancel it from the
      // admin panel, which refunds and restocks.
      if (!isReturn && internalStatus === "cancelled" && !["cancelled", "returned"].includes(order.orderStatus)) {
        const reason = `Shiprocket reports this order as "${current_status || status}". Cancel it from the admin panel so the refund and stock restore run.`;
        if (!(order.reviewReason || "").includes(reason)) {
          order.needsManualReview = true;
          order.reviewReason = order.reviewReason ? `${order.reviewReason} | ${reason}` : reason;
          isUpdated = true;
        }
      }

      // Return-shipment events never drive the order's forward status: the return
      // parcel being "shipped"/"delivered" overwrote return_requested with
      // shipped/delivered mid-return. Forward movement also only starts from a forward
      // status — a cancelled/returned order has index -1, so ANY status counted as
      // "forward" and could resurrect it.
      const statusPriority = ["pending", "processing", "shipped", "delivered"];
      const currentPriority = statusPriority.indexOf(order.orderStatus);
      const newPriority = statusPriority.indexOf(internalStatus);
      const isForwardMove = currentPriority !== -1 && newPriority > currentPriority;
      const isRto = internalStatus === "returned" && !["returned", "cancelled"].includes(order.orderStatus);

      if (!isReturn && internalStatus && internalStatus !== "cancelled") {
        if (isForwardMove || isRto) {
          order.statusHistory.push({
            fromStatus: order.orderStatus,
            toStatus: internalStatus,
            status: internalStatus,
            changedBy: null,
            source: "shiprocket",
            note: `Shiprocket webhook: "${current_status || status}"`,
            changedAt: new Date(),
          });
          order.orderStatus = internalStatus;
          isUpdated = true;

          // RTO on a prepaid order: the money isn't refunded automatically.
          if (isRto && order.paymentMethod !== "cod" && order.paymentStatus === "paid" && !["pending", "processed"].includes(order.refundStatus)) {
            order.needsManualReview = true;
            const reason = "Order returned to origin (RTO) — decide on the refund and process it in Razorpay.";
            order.reviewReason = order.reviewReason ? `${order.reviewReason} | ${reason}` : reason;
          }
          
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

          // Stamp shippedAt exactly once
          if (internalStatus === "shipped" && !order.shippedAt) {
              order.shippedAt = new Date();
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
             // /account/tracking isn't a route (the link 404'd); /track/:orderId is.
             const trackingUrl = `${process.env.FRONTEND_URL || 'https://www.bodilicious.in'}/track/${order._id}`;
             await sendOrderShippedEmail(order, trackingUrl, order.shippingDetails?.email, order.shippingDetails?.name).catch(err => console.error("Shipment Email Failed:", err));

          } else if (internalStatus === "delivered") {
             await logAction(req, "order_delivered", "order", order._id.toString(), { awb }, { source: "shiprocket-webhook" }).catch(err => console.error("Fulfillment Audit Failed:", err));
          } else if (internalStatus === "returned" || shiprocketStatus.includes("rto") || shiprocketStatus.includes("failed")) {
             await logAction(req, "delivery_failed", "order", order._id.toString(), { awb, reason: shiprocketStatus }, { source: "shiprocket-webhook", severity: "WARNING" }).catch(err => console.error("Fulfillment Audit Failed:", err));
             
             if (shiprocketStatus.includes("rto")) {
                 order.rtoReason = req.body.scrapping_reason || req.body.remark || req.body.reason || req.body.cancellation_reason || "Courier RTO";
                 isUpdated = true;
             }

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
          }
        }
      }

      // The parcel is physically back — restock. Independent of the status change
      // above: "rto initiated" already moved the order to "returned", so by the time
      // "rto delivered" arrives there is no status change left to hang this on.
      if (!isReturn && shiprocketStatus === "rto delivered" && !order.isStockRestored && order.items?.length > 0) {
        const claimedOrder = await Order.findOneAndUpdate(
          { _id: order._id, isStockRestored: { $ne: true } },
          { $set: { isStockRestored: true } }
        );
        if (claimedOrder) {
          try {
            await Product.bulkWrite(order.items.map(item => ({
              updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
            })));
            console.log(`[Shiprocket Webhook] Restored stock for order ${order._id}`);
          } catch (stockErr) {
            console.error("Failed to restore stock on webhook:", stockErr.message);
          }
        }
        order.isStockRestored = true;
        isUpdated = true;
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
    if (!mongoose.isObjectIdOrHexString(req.params.orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
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

    // Only before dispatch. The old check (not shipped/delivered) let a customer
    // re-address cancelled, returned and return-requested orders too.
    if (!["pending", "processing"].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "The address can only be changed before the order ships.",
      });
    }
    // Shiprocket rejects address updates once a courier/AWB is assigned, so the
    // change would be saved here but the parcel would still go to the old address.
    if (order.awb) {
      return res.status(400).json({
        success: false,
        message: "Your parcel has already been assigned to a courier. Please contact support to change the address.",
      });
    }

    const current = order.shippingDetails?.toObject ? order.shippingDetails.toObject() : { ...(order.shippingDetails || {}) };
    const pick = (key, max) => {
      const v = req.body?.[key];
      if (v === undefined || v === null) return current[key];
      const s = String(v).trim().slice(0, max);
      return s || current[key];
    };
    // `...order.shippingDetails` spread a Mongoose subdocument — its fields live under
    // _doc, so country (and anything else not re-listed) was silently dropped.
    const next = {
      ...current,
      name: pick("name", 100),
      email: pick("email", 254),
      phone: pick("phone", 20),
      address: pick("address", 500),
      city: pick("city", 100),
      state: pick("state", 100),
      pincode: pick("pincode", 12),
    };

    const domestic = isIndiaOrder({ shippingDetails: next });
    const phoneDigits = String(next.phone || "").replace(/\D/g, "");
    const pinDigits = String(next.pincode || "").replace(/\D/g, "");
    // Same rule as checkout (tracker/schema.js) — a stricter one here would refuse an
    // address edit for the very number the order was placed with (e.g. "0987…").
    if (domestic ? phoneDigits.length < 10 : (phoneDigits.length < 6 || phoneDigits.length > 15)) {
      return res.status(400).json({ success: false, message: "Please enter a valid phone number." });
    }
    if (domestic && !/^[1-9]\d{5}$/.test(pinDigits)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 6-digit pincode." });
    }
    if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    /* =========================================================
       Sync Address with Shiprocket if order has been pushed
    ========================================================= */
    if (order.shiprocketOrderId && process.env.SHIPROCKET_EMAIL) {
      try {
        const token = await getShiprocketToken();

        const nameParts = (next.name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "Customer";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        const updatePayload = {
          order_id: order.shiprocketOrderId,
          shipping_customer_name: firstName,
          shipping_last_name: lastName,
          shipping_phone: phoneDigits.slice(-10),
          shipping_address: next.address,
          shipping_city: next.city,
          shipping_state: next.state,
          shipping_country: next.country || "India",
          shipping_pincode: pinDigits || next.pincode,
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
          return res.status(502).json({
            success: false,
            message: "Failed to sync new address with our shipping partner. Please try again."
          });
        }
      } catch (shipErr) {
        console.error("Shiprocket update address error:", shipErr.message);
        return res.status(502).json({
          success: false,
          message: "Internal error syncing address with shipping partner."
        });
      }
    }

    // Conditional on the status still being editable — the order may have been
    // picked up/cancelled while the Shiprocket call above was in flight.
    const saved = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: { $in: ["pending", "processing"] } },
      { $set: { shippingDetails: next } },
      { runValidators: true }
    );
    if (!saved) {
      return res.status(409).json({ success: false, message: "This order changed while saving. Please refresh and try again." });
    }

    return res.json({
      success: true,
      data: await loadCustomerOrder(order._id),
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
    if (!mongoose.isObjectIdOrHexString(req.params.orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
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

    // A notification failure must not turn a completed cancellation into a 500.
    await NotificationService.emit({
        title: "Order Cancelled",
        body: `Order ${order._id.toString().slice(-6).toUpperCase()} was cancelled. Reason: ${req.body?.reason || 'Not provided'}.`,
        type: "warning",
        sourceModule: "orders",
        sourceModel: "Order",
        sourceId: order._id.toString()
    }).catch(e => console.error("Notification Service failed:", e));

    return res.json({
      success: true,
      data: { _id: order._id, orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, refundStatus: order.refundStatus ?? null },
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

    if (!mongoose.isObjectIdOrHexString(req.params.orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
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
    // Internally a no-op for international orders — Shiprocket reverse pickup only
    // covers Indian addresses, so it flags the order for manual RMA instead.
    const freshOrder = await Order.findById(order._id).populate("items.product", ORDER_ITEM_PRODUCT_FIELDS);
    createShiprocketReturn(freshOrder, reason.trim()).catch(err => {
      console.error("Delayed Shiprocket return error:", err.message);
    });

    const isDomesticReturn = isIndiaOrder(order);
    NotificationService.emit({
        title: isDomesticReturn ? "Return Requested" : "International Return — Manual RMA Required",
        body: isDomesticReturn
          ? `Order ${order._id.toString().slice(-6).toUpperCase()} requested a return: ${reason.trim()}`
          : `Order ${order._id.toString().slice(-6).toUpperCase()} (ships to ${order.shippingDetails?.country}) requested a return: ${reason.trim()}. No automated reverse pickup — arrange the return manually.`,
        type: "warning",
        sourceModule: "orders",
        sourceModel: "Order",
        sourceId: order._id.toString()
    }).catch(e => console.error("Notification Service failed:", e));

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully.",
      data: await loadCustomerOrder(order._id),
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
    const { status, note } = req.body;
    if (!mongoose.isObjectIdOrHexString(req.params.orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Same routine as the admin panel. This legacy route had its own copy that allowed
    // any status jump (delivered → pending), never refunded or restocked a "returned"
    // order, and set no shipped/delivered timestamps.
    const result = await applyAdminStatusChange(order, status, req, { note });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }
    await order.save();
    orderEvents.emit("order_status_updated", order);

    return res.json({ success: true, data: order, warnings: result.warnings });
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

    if (!mongoose.isObjectIdOrHexString(req.params.orderId)) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Atomic push with the 10-comment cap in the filter: the read-check-save version
    // let parallel posts exceed the cap, and a full save() re-validated the whole
    // order, so one bad legacy field made commenting impossible.
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        user: req.user._id,
        $expr: { $lt: [{ $size: { $ifNull: ["$customerComments", []] } }, 10] },
      },
      { $push: { customerComments: { text: text.trim(), createdAt: new Date() } } },
      { new: true, projection: { customerComments: 1 } }
    );
    if (!order) {
      const exists = await Order.exists({ _id: req.params.orderId, user: req.user._id });
      return exists
        ? res.status(400).json({ success: false, message: "Maximum 10 comments per order" })
        : res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(201).json({
      success: true,
      data: order.customerComments,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};