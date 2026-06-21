import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../tracker/models.js";
import UserProfile from "../profile/models.js";
import Product from "../products/models.js";
import { getShiprocketToken, getEstimatedDeliveryDate, pushOrderToShiprocket } from "../tracker/shiprocketservice.js";
import { sendOrderConfirmationEmail, sendOrderConfirmationAfterInvoice, sendAdminNewOrderAlert, sendAdminPaymentSuccessNoOrderAlert } from "../email/emailService.js";
import Razorpay from "razorpay";
import { COUNTRIES } from "../utils/countries.js";
import { logAction } from "../admin/controller.js";
import { trackServerEvent } from "../utils/posthog.js";
import { enqueueWhatsApp } from "../whatsapp/queue.js";
import { getSettings } from "../settings/cache.js";
import NotificationService from "../procurement/notificationService.js";
import { calculateDiscount } from "../utils/pricing.js";
import { CHECKOUT_CURRENCIES, roundForCurrency, toRazorpayMinorUnits } from "../utils/currencies.js";
import orderEvents from "../events/orderEvents.js";
import { fetchProductMaps, resolveProduct } from "../utils/productLookup.js";

/* =========================================================
   PROCESS PAID ORDER (Helper)
   Handles stock deduction, EDD, clearing cart, emails for successful payments
========================================================= */
export const processPaidOrder = async (orderId, paymentId, signature, req) => {
    // orderId is the MongoDB Order _id

    const session = await mongoose.startSession();
    session.startTransaction();

    let populatedOrder;

    // ── Atomic claim outside transaction ──
    // This ensures that if the transaction rolls back, the "paid" lock persists so we can retry or manually review.
    const priorDoc = await Order.findOneAndUpdate(
        { 
            _id: orderId, 
            $or: [
                { paymentStatus: { $in: ["pending", "failed"] } },
                { paymentStatus: "paid", invoiceGenerated: { $ne: true }, paymentClaimedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } }
            ]
        },
        { $set: { paymentStatus: "paid", razorpayPaymentId: paymentId, paymentClaimedAt: new Date() } },
        { returnDocument: "before" }
    );
    const priorPaymentStatus = priorDoc?.paymentStatus ?? "pending";
    const priorPaymentId = priorDoc?.razorpayPaymentId ?? null;

    try {
        if (!priorDoc) {
            // Already processed or not found
            const existingOrder = await Order.findById(orderId).populate("items.product").session(session);
            if (!existingOrder) throw new Error("Order not found");
            await session.abortTransaction();
            session.endSession();
            return { success: true, message: "Already processed", order: existingOrder };
        }

        const order = await Order.findById(orderId).session(session);

        if (order.orderStatus === "cancelled" || order.orderStatus === "abandoned") {
            const wasAbandoned = order.orderStatus === "abandoned";
            const previousOrderStatus = order.orderStatus;
            order.orderStatus = "pending"; // un-cancel/un-abandon it since it's now paid

            // Record the status resurrection in history so ops can audit it
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push({
                fromStatus: previousOrderStatus,
                toStatus: "pending",
                status: "pending",
                changedBy: null,
                source: "system",
                changedAt: new Date(),
                note: "Order resurrected by payment capture after being " + previousOrderStatus
            });

            // Re-lock the welcome offer if it was an abandoned order and used it,
            // since the draft cleanup cron might have released it.
            if (wasAbandoned && order.isWelcomeOfferApplied) {
                await UserProfile.updateOne({ _id: order.user }, { $set: { welcomeOfferUsed: true } }, { session });
            }
        }

        // ── Re-deduct stock if it was restored by a previous failed payment ──
        if (order.isStockRestored) {
            const bulkOps = order.items.map(item => ({
                updateOne: {
                    filter: { _id: item.product, stock: { $gte: item.quantity } },
                    update: { $inc: { stock: -item.quantity } }
                }
            }));
            const bulkResult = await Product.bulkWrite(bulkOps, { session });
            if (bulkResult.modifiedCount !== order.items.length) {
                await NotificationService.emit({
                    title: "CRITICAL: Stock Missing for Paid Order",
                    body: `Order ${order._id.toString().slice(-6).toUpperCase()} was paid after a retry, but stock is no longer available. Immediate manual refund or inventory adjustment required.`,
                    type: "error",
                    sourceModule: "orders",
                    sourceModel: "Order",
                    sourceId: order._id.toString()
                });
                throw new Error("Insufficient stock to process retried payment.");
            }
            order.isStockRestored = false;
        }

        // ── Weight calculation (read-only, no writes) — runs BEFORE the transaction ──
        // Moved outside the session to avoid holding a transaction lock during product reads.
        // The weight is only used for EDD; it does not affect stock or payment amounts.
        let totalWeightGrams = 0;
        {
            const productIds = order.items.map(i => i.product);
            const weightProducts = await Product.find({ _id: { $in: productIds } }).select("product_weight_g product_weight_ml").lean();
            const weightMap = Object.fromEntries(weightProducts.map(p => [p._id.toString(), p]));
            for (const orderItem of order.items) {
                const p = weightMap[orderItem.product.toString()];
                const itemWeightG = p?.product_weight_g || (p?.product_weight_ml ? p.product_weight_ml * 1.05 : 200);
                totalWeightGrams += itemWeightG * orderItem.quantity;
            }
        }

        // EDD — only applicable for India orders (Shiprocket only covers Indian pincodes)
        const isIndiaOrder = !order.shippingDetails.country || 
            ['india', 'in', 'bharat', 'ind'].includes((order.shippingDetails.country || '').toLowerCase().trim());
        
        if (isIndiaOrder) {
            const totalWeight = Math.max(0.5, totalWeightGrams / 1000);
            try {
                const eddResponse = await getEstimatedDeliveryDate(order.shippingDetails.pincode, totalWeight, false);
                if (eddResponse) {
                    order.estimatedDeliveryDate = eddResponse.estimatedDeliveryDate;
                    order.estimatedDeliveryDays = eddResponse.estimatedDeliveryDays;
                    order.estimatedCourierName = eddResponse.estimatedCourierName;
                    order.eddCalculatedAt = new Date();
                }
            } catch (e) {
                console.error("EDD fetch failed:", e.message);
            }
        }

        // paymentStatus and razorpayPaymentId were already set atomically before
        // starting the session — only update signature and other mutated fields here
        const updateFields = {
            orderStatus: order.orderStatus,
            isStockRestored: order.isStockRestored,
            invoiceNumber: `INV-${orderId.toString().toUpperCase()}`,
            invoiceGenerated: true
        };
        if (order.estimatedDeliveryDate) {
            updateFields.estimatedDeliveryDate = order.estimatedDeliveryDate;
            updateFields.estimatedDeliveryDays = order.estimatedDeliveryDays;
            updateFields.estimatedCourierName = order.estimatedCourierName;
            updateFields.eddCalculatedAt = order.eddCalculatedAt;
        }
        if (signature) {
            updateFields.razorpaySignature = signature;
        }

        await Order.updateOne({ _id: orderId }, { $set: updateFields }, { session });

        const productIdsToRemove = order.items.map(i => i.product);
        await UserProfile.findByIdAndUpdate(order.user, { 
            $addToSet: { orders: order._id }, 
            $pull: { cart: { product: { $in: productIdsToRemove } } } 
        }).session(session);

        // 🚀 Audit Order Placed / Payment Captured
        await logAction(req, "payment_captured", "order", order._id.toString(), {
            total: order.totalAmount,
            paymentId: paymentId,
            paymentMethod: "razorpay"
        }, { source: signature ? "frontend" : "webhook" }).catch(err => console.error("Payment Captured Audit Failed:", err));

        await NotificationService.emit({
            title: "New Order Received",
            body: `Order ${order._id.toString().slice(-6).toUpperCase()} placed for ₹${order.totalAmount}.`,
            type: "info",
            sourceModule: "orders",
            sourceModel: "Order",
            sourceId: order._id.toString()
        });

        await session.commitTransaction();
        session.endSession();

        populatedOrder = await Order.findById(order._id).populate("items.product");

        populatedOrder.invoiceNumber = `INV-${populatedOrder._id.toString().toUpperCase()}`;
        populatedOrder.invoiceGenerated = true;

        // 🚀 PostHog Server-Side Tracking, Shiprocket, Emails, WhatsApp moved to orderEvents
        orderEvents.emit("order_placed", populatedOrder);

    } catch (txErr) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();

        if (txErr.message === "Insufficient stock to process retried payment.") {
            console.error(`[processPaidOrder] CRITICAL: Stock permanently unavailable for order ${orderId}. Auto-refunding.`);
            try {
                const razorpayInstance = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET,
                });
                const paymentFetch = await razorpayInstance.payments.fetch(paymentId);
                
                if (paymentFetch.status === "captured" && paymentFetch.amount_refunded === 0) {
                    const refund = await razorpayInstance.payments.refund(paymentId, {
                        amount: paymentFetch.amount,
                        notes: { reason: "Out of stock on payment retry" }
                    });
                    
                    await Order.updateOne(
                        { _id: orderId },
                        { 
                            $set: { 
                                orderStatus: "cancelled", 
                                paymentStatus: "refunded",
                                refundStatus: "processed",
                                refundId: refund.id,
                                refundAmount: refund.amount / 100,
                                paymentClaimedAt: null 
                            },
                            $push: {
                                statusHistory: {
                                    fromStatus: priorPaymentStatus === "paid" ? "processing" : "pending",
                                    toStatus: "cancelled",
                                    status: "cancelled",
                                    changedBy: "system",
                                    source: "system",
                                    // `changedAt` matches the schema field — `timestamp` was silently ignored
                                    changedAt: new Date()
                                }
                            }
                        }
                    );
                    
                    // Use PermanentError so withRetry skips backoff instantly
                    throw new PermanentError("order cancelled and auto-refunded due to insufficient stock");
                }
            } catch (refundErr) {
                if (refundErr.isPermanent || refundErr.message === "order cancelled and auto-refunded due to insufficient stock") {
                    throw refundErr; // Rethrow terminal error
                }
                console.error(`[processPaidOrder] Failed to auto-refund out-of-stock order ${orderId}:`, refundErr);
            }
        }

        // ── Revert the atomic "paid" claim ─────────────────────────────────────
        // The claim ran outside the transaction so it is NOT rolled back automatically.
        // We must restore to the EXACT pre-claim state so:
        //   1. withRetry attempt 2 sees the correct pre-state and re-claims cleanly.
        //   2. The reconciliation cron (which queries paymentStatus: "pending"|"failed")
        //      picks this order up if all retries are exhausted.
        // Condition { paymentStatus: "paid" } prevents a double-revert if another
        // concurrent path already cleaned this up.
        const revertErr = await Order.updateOne(
            { _id: orderId, paymentStatus: "paid", razorpayPaymentId: paymentId },
            { $set: { paymentStatus: priorPaymentStatus, razorpayPaymentId: priorPaymentId, paymentClaimedAt: null, lastClaimFailedAt: new Date() } }
        ).catch(e => e);
        if (revertErr instanceof Error) {
            console.error("[processPaidOrder] CRITICAL: Failed to revert payment claim:", revertErr.message);
            await Order.updateOne({ _id: orderId }, { $set: { needsManualReview: true } }).catch(e => e);
            await NotificationService.emit({
                title: "CRITICAL: Payment Claim Revert Failed",
                body: `Order ${orderId.toString().slice(-6).toUpperCase()} failed to revert payment claim after order creation failed. Order is stuck in paid state but not fully processed. Manual intervention required.`,
                type: "error",
                sourceModule: "orders",
                sourceModel: "Order",
                sourceId: orderId.toString()
            }).catch(e => e);
        }

        await logAction(req, "order_creation_failed", "order", orderId.toString(), {
            error: txErr.message,
            revertedTo: priorPaymentStatus,
            action: "Atomic claim reverted — reconciliation cron will retry if all withRetry exhausted"
        }, { severity: "ERROR" }).catch(err => console.error("Order Creation Failed Audit Failed:", err));

        throw txErr;
    }

    return { success: true, message: "Payment verified and order created successfully", order: populatedOrder };
};

/* =========================================================
   GET ORDER QUOTE
   POST /api/payment/quote
   Generates a sealed quote to prevent tampering.
========================================================= */
export const getOrderQuote = async (req, res) => {
    try {
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("CRITICAL: RAZORPAY_KEY_SECRET is not configured");
            return res.status(500).json({ success: false, message: "Payment configuration error" });
        }

        const { items, shippingDetails } = req.body;
        const userId = req.user?._id;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }

        // Strictly validate and merge duplicate items
        const mergedItemsMap = {};
        for (const item of items) {
            if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: "Invalid item quantity" });
            }
            const id = item.productId || item.pid;
            if (!id) return res.status(400).json({ success: false, message: "Invalid item ID" });
            
            if (!mergedItemsMap[id]) mergedItemsMap[id] = { ...item, quantity: 0 };
            mergedItemsMap[id].quantity += item.quantity;
        }
        const mergedItems = Object.values(mergedItemsMap);

        if (!shippingDetails?.country) {
            return res.status(400).json({ success: false, message: "Shipping country required" });
        }

        // Use the in-memory settings cache — avoids an extra DB round-trip per quote request
        const settings = (await getSettings()) || { 
            shippingThreshold: 999, shippingCost: 99,
            internationalShippingEnabled: false, internationalShippingCost: 2000, internationalShippingThreshold: 10000,
            supportedCountries: COUNTRIES
        };

        const isIndia = !shippingDetails.country.trim() || ["india", "in", "bharat", "ind"].includes(shippingDetails.country.toLowerCase().trim());
        
        if (!isIndia) {
            if (!settings.internationalShippingEnabled) {
                return res.status(400).json({ success: false, message: "International shipping is not enabled." });
            }
            if (!settings.internationalCheckoutEnabled) {
                return res.status(400).json({ success: false, message: "International checkout is currently disabled. Please check back later." });
            }
            const supported = (settings.supportedCountries || []).map(c => c.toLowerCase());
            if (!supported.includes(shippingDetails.country.toLowerCase().trim())) {
                return res.status(400).json({ success: false, message: `We do not currently ship to ${shippingDetails.country}.` });
            }
        }

        // Batch fetch all products in one round-trip — avoids N sequential DB calls
        const { mapById: productMapById, mapByPid: productMapByPid } = await fetchProductMaps(mergedItems);

        let totalAmount = 0;
        for (const item of mergedItems) {
            const product = resolveProduct(item, productMapById, productMapByPid);
            if (!product) {
                return res.status(400).json({ success: false, message: "Product not found" });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
            }
            totalAmount += product.price * item.quantity;
        }

        let shippingCost = 0;
        if (isIndia) {
            shippingCost = totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost;
        } else {
            shippingCost = totalAmount >= settings.internationalShippingThreshold ? 0 : settings.internationalShippingCost;
        }

        let existingOrdersCount = 1; // Default to 1 for guests (no welcome offer)
        if (userId) {
            const userProfile = await UserProfile.findById(userId).select("welcomeOfferUsed");
            if (userProfile?.welcomeOfferUsed) {
                existingOrdersCount = 1; // Force ineligible
            } else {
                existingOrdersCount = await Order.countDocuments({
                    user: userId,
                    orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
                    $or: [
                        { paymentMethod: "cod" },
                        { paymentMethod: "razorpay", paymentStatus: { $in: ["paid", "refunded"] } }
                    ]
                });
            }
        }

        const pricing = calculateDiscount(totalAmount, shippingCost, { existingOrdersCount });

        // ── Currency selection ────────────────────────────────────────────────
        // Display currency = what the user selected (any of 160+)
        // Checkout currency = must be in CHECKOUT_CURRENCIES (Razorpay-supported)
        // If display currency is not in checkout list, fall back to INR for payment
        // but still convert display amounts for the quote response.
        const requestedCurrency = (req.body.targetCurrency || "INR").toUpperCase();
        const checkoutCurrency = CHECKOUT_CURRENCIES.has(requestedCurrency) ? requestedCurrency : "INR";
        const isFallback = checkoutCurrency !== requestedCurrency;

        let conversionRate = 1;
        if (checkoutCurrency !== "INR") {
            // Mongoose Map objects use .get(); plain objects use bracket notation
            const rawRate = settings.exchangeRates?.get
                ? settings.exchangeRates.get(checkoutCurrency)
                : settings.exchangeRates?.[checkoutCurrency];

            // USD fallback in case cron hasn't run yet
            const resolvedRate = rawRate ||
                (checkoutCurrency === "USD" && settings.usdExchangeRate ? 1 / settings.usdExchangeRate : null);

            if (!resolvedRate || resolvedRate <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Exchange rate for ${checkoutCurrency} is currently unavailable. Please select another currency or try again later.`
                });
            }
            conversionRate = resolvedRate;
        }

        const applyConversion = (val) => roundForCurrency(val * conversionRate, checkoutCurrency);

        const convertedSubtotal      = applyConversion(pricing.subtotal);
        const convertedShippingCost  = applyConversion(pricing.shippingCost);
        const convertedDiscountAmount = applyConversion(pricing.discountAmount);
        const convertedFinalAmount   = applyConversion(pricing.finalAmount);
        const convertedOriginalAmount = applyConversion(pricing.originalAmount);

        const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes

        const quotePayload = {
            userId: userId ? userId.toString() : null,
            subtotal: convertedSubtotal,
            shippingCost: convertedShippingCost,
            discountAmount: convertedDiscountAmount,
            finalAmount: convertedFinalAmount,
            originalAmount: convertedOriginalAmount,
            isWelcomeOfferApplied: pricing.isWelcomeOfferApplied,
            expiry,
            country: shippingDetails.country.trim(),
            currency: checkoutCurrency,
            requestedCurrency,   // stored for display purposes only
            isFallback,          // tells frontend if we fell back to INR
            exchangeRate: conversionRate
        };

        const signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(JSON.stringify(quotePayload))
            .digest("hex");

        const quoteId = Buffer.from(JSON.stringify({ payload: quotePayload, signature })).toString('base64');
        const deliveryEstimate = isIndia ? "3-5 business days" : "7-21 business days";

        return res.status(200).json({
            success: true,
            data: {
                quoteId,
                subtotal: convertedSubtotal,
                shippingCost: convertedShippingCost,
                discountAmount: convertedDiscountAmount,
                totalAmount: convertedFinalAmount,
                deliveryEstimate,
                currency: checkoutCurrency,
                isFallback,               // frontend shows toast if true
                requestedCurrency
            }
        });
    } catch (err) {
        console.error("Get Quote error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/* =========================================================
   INIT RAZORPAY ORDER
   POST /api/payment/razorpay/init
   Creates Razorpay order AND a Draft DB Order
========================================================= */
export const initRazorpayOrder = async (req, res) => {
    try {
        const { items, shippingDetails, billingDetails, marketing, quoteId } = req.body;
        const userId = req.user._id;

        if (!quoteId) return res.status(400).json({ success: false, message: "Missing quoteId. Please refresh cart." });

        let decodedQuote;
        try {
            decodedQuote = JSON.parse(Buffer.from(quoteId, 'base64').toString('utf8'));
        } catch (e) {
            return res.status(400).json({ success: false, message: "Invalid quote format" });
        }

        const { payload, signature } = decodedQuote;
        if (!payload || !signature) return res.status(400).json({ success: false, message: "Invalid quote structure" });

        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("[initRazorpayOrder] CRITICAL: Missing RAZORPAY_KEY_SECRET");
            return res.status(500).json({ success: false, message: "Payment configuration error" });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(JSON.stringify(payload))
            .digest("hex");

        if (expectedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Quote signature mismatch. Please refresh." });
        }

        if (Date.now() > payload.expiry) {
            return res.status(400).json({ success: false, message: "Quote expired. Please refresh checkout." });
        }

        if (payload.userId !== (userId ? userId.toString() : null)) {
            return res.status(400).json({ success: false, message: "Invalid quote for this user. Please refresh checkout." });
        }


        if (payload.country !== shippingDetails?.country?.trim()) {
            return res.status(400).json({ success: false, message: "Shipping country changed. Please recalculate quote." });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }

        // Strictly validate and merge duplicate items
        const mergedItemsMap = {};
        for (const item of items) {
            if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: "Invalid item quantity" });
            }
            const id = item.productId || item.pid;
            if (!id) return res.status(400).json({ success: false, message: "Invalid item ID" });
            
            if (!mergedItemsMap[id]) mergedItemsMap[id] = { ...item, quantity: 0 };
            mergedItemsMap[id].quantity += item.quantity;
        }
        const mergedItems = Object.values(mergedItemsMap);

        if (!shippingDetails?.address) {
            return res.status(400).json({ success: false, message: "Shipping details required" });
        }

        // Recalculate subtotal to ensure items haven't changed
        let subtotal = 0;
        const orderItems = [];

        // Batch fetch all products in one round-trip — avoids N sequential DB calls
        const { mapById: initMapById, mapByPid: initMapByPid } = await fetchProductMaps(mergedItems);

        for (const item of mergedItems) {
            const product = resolveProduct(item, initMapById, initMapByPid);
            if (!product) {
                console.error("Product not found for item:", item);
                return res.status(400).json({ success: false, message: "Product not found" });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
            }
            subtotal += product.price * item.quantity;
            
            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                priceAtPurchase: product.price,
            });
        }

        // Full Pricing Re-validation (Fix for #1)
        const isIndia = !shippingDetails?.country?.trim() || ["india", "in", "bharat", "ind"].includes(shippingDetails.country.toLowerCase().trim());
        // Use the in-memory settings cache — avoids an extra DB round-trip per init request
        const settings = (await getSettings()) || { shippingThreshold: 999, shippingCost: 99, internationalShippingCost: 2000, internationalShippingThreshold: 10000 };
        
        let shippingCost = isIndia 
            ? (subtotal >= settings.shippingThreshold ? 0 : settings.shippingCost)
            : (subtotal >= settings.internationalShippingThreshold ? 0 : settings.internationalShippingCost);

        let existingOrdersCount = 1;
        if (userId) {
            const userProfile = await UserProfile.findById(userId).select("welcomeOfferUsed");
            if (!userProfile?.welcomeOfferUsed) {
                existingOrdersCount = await Order.countDocuments({
                    user: userId,
                    orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
                    $or: [
                        { paymentMethod: "cod" },
                        { paymentMethod: "razorpay", paymentStatus: { $in: ["paid", "refunded"] } }
                    ]
                });
            }
        }

        const pricing = calculateDiscount(subtotal, shippingCost, { existingOrdersCount });
        const applyConversion = (val) => roundForCurrency(val * (payload.exchangeRate || 1), payload.currency || "INR");
        const convertedFinalAmount = applyConversion(pricing.finalAmount);

        if (Math.abs(convertedFinalAmount - payload.finalAmount) > Math.max(1, convertedFinalAmount * 0.001)) {
            return res.status(400).json({ success: false, message: "Cart contents or pricing changed. Please refresh quote." });
        }

        const finalAmount = payload.finalAmount;
        const targetCurrency = payload.currency || "INR";

        // Pre-flight check for welcome offer to avoid orphaning Razorpay orders
        if (payload.isWelcomeOfferApplied) {
            const profile = await UserProfile.findById(userId).select("welcomeOfferUsed");
            if (profile?.welcomeOfferUsed) {
                return res.status(400).json({ success: false, message: "Welcome offer has already been used. Please refresh quote." });
            }
        }

        // Create Razorpay order
        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const razorpayAmount = toRazorpayMinorUnits(finalAmount, targetCurrency);

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: razorpayAmount,
            currency: targetCurrency,
            receipt: `rp_${Date.now()}`,
            notes: {
                userId: userId.toString(),
                itemCount: items.length,
            },
        });

        // ── Inventory Reservation Transaction ──
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            if (payload.isWelcomeOfferApplied) {
                const profileClaim = await UserProfile.findOneAndUpdate(
                    { _id: userId, welcomeOfferUsed: { $ne: true } },
                    { $set: { welcomeOfferUsed: true } },
                    { session, new: true }
                );
                if (!profileClaim) {
                    throw new Error("Welcome offer could not be applied. Please retry checkout.");
                }
            }

            // Deduct stock immediately
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

            // 🚀 CREATE DB ORDER AS PENDING (Draft Order)
            const [newOrder] = await Order.create([{
                user: userId,
                items: orderItems,
                totalAmount: finalAmount,
                shippingCost: payload.shippingCost,
                discountAmount: payload.discountAmount,
                isWelcomeOfferApplied: payload.isWelcomeOfferApplied,
                originalAmount: payload.originalAmount,
                paymentMethod: "razorpay",
                paymentStatus: "pending",
                orderStatus: "pending",
                razorpayOrderId: razorpayOrder.id,
                currency: targetCurrency,
                exchangeRate: payload.exchangeRate || 1,
                shippingDetails,
                billingDetails: billingDetails || null,
                marketing: marketing || undefined
            }], { session });

            await session.commitTransaction();
            session.endSession();

            // 🚀 Audit Payment Initiated
            await logAction(req, "payment_initiated", "order", razorpayOrder.id, {
                amount: finalAmount,
                itemCount: items.length,
                dbOrderId: newOrder._id.toString()
            }).catch(err => console.error("Payment Initiated Audit Failed:", err));

            return res.status(201).json({
                success: true,
                data: {
                    razorpayOrder,
                    calculatedAmount: finalAmount,
                    dbOrderId: newOrder._id,
                },
            });
        } catch (dbErr) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            throw dbErr;
        }

    } catch (err) {
        console.error("Init Razorpay Order error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/* =========================================================
   VERIFY PAYMENT & CREATE ORDER
   POST /api/payment/verify
   After payment success: verify signature → complete draft order
   Retries processPaidOrder up to 3 times before giving up.
   On total failure returns 202 (payment captured, order pending)
   so the frontend can show a meaningful message to the customer.
   The Razorpay webhook remains a background safety net.
========================================================= */

/**
 * Retry helper — calls fn up to (attempts) times.
 * Waits backoffMs * 2^i ms between each attempt.
 * Returns the result of the first successful call.
 * Throws the last error if all attempts fail.
 *
 * Permanent errors (those that will NEVER succeed on retry) are thrown
 * immediately without waiting for backoff, to avoid making the customer
 * wait 3+ seconds for a retry that cannot possibly help.
 */
/**
 * PermanentError — throw this for errors where retrying is guaranteed to fail.
 * withRetry detects `.isPermanent` and short-circuits immediately without backoff,
 * avoiding making the customer wait 3+ seconds for a retry that cannot possibly help.
 * Prefer this over adding to PERMANENT_ERRORS for new code.
 */
class PermanentError extends Error {
    constructor(message) {
        super(message);
        this.isPermanent = true;
        this.name = "PermanentError";
    }
}

// Legacy substring fallback for permanent errors that pre-date PermanentError.
// Keep entries specific — substring matching is inherently fragile.
// For new permanent-failure throws, use `new PermanentError(...)` instead.
const PERMANENT_ERRORS = [
    "order not found",
    "invalid payment signature",
    "product not found",
    "order cancelled and auto-refunded due to insufficient stock",
];

const withRetry = async (fn, attempts = 3, backoffMs = 500) => {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            // PermanentError takes priority — avoids fragile substring matching
            if (err.isPermanent) {
                console.error(`[withRetry] Permanent error on attempt ${i + 1}, not retrying:`, err.message);
                throw err;
            }
            const errMsg = (err.message || "").toLowerCase();
            // Legacy check for permanent errors that pre-date PermanentError class
            if (PERMANENT_ERRORS.some(pe => errMsg.includes(pe))) {
                console.error(`[withRetry] Permanent error on attempt ${i + 1}, not retrying:`, err.message);
                throw err;
            }
            console.error(`[withRetry] Attempt ${i + 1}/${attempts} failed:`, err.message);
            if (i < attempts - 1) {
                await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, i)));
            }
        }
    }
    throw lastErr;
};

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing Razorpay details" });
        }

        const existingOrder = await Order.findOne({ 
            razorpayOrderId: razorpay_order_id,
            user: req.user._id
        });
        if (!existingOrder) {
            return res.status(400).json({ success: false, message: "Draft order not found or unauthorized" });
        }

        if (existingOrder.paymentStatus === "paid" && existingOrder.invoiceGenerated) {
            // Only short-circuit if the order is fully finalised (invoice generated).
            // If invoiceGenerated is false the atomic claim fired but the Mongoose
            // transaction aborted (stale lock). Fall through so processPaidOrder
            // can reprocess via the webhook stale-lock path or withRetry.
            const populatedExisting = await Order.findById(existingOrder._id).populate("items.product");
            return res.status(200).json({
                success: true,
                message: "Payment already processed",
                data: populatedExisting,
            });
        }

        // ── Verify Razorpay signature ─────────────────────────────────────────
        // Fail loudly if secret is missing — a fallback string would silently
        // reject ALL real payments with a cryptic "Invalid signature" error.
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("[verifyPayment] CRITICAL: RAZORPAY_KEY_SECRET is not set");
            return res.status(500).json({ success: false, message: "Payment configuration error" });
        }
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            await logAction(req, "payment_verification_failed", "order", razorpay_order_id, {
                paymentId: razorpay_payment_id
            }, { severity: "CRITICAL" }).catch(err => console.error("Payment Verification Failed Audit:", err));
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        // ── Attempt to process order — up to 3 times ─────────────────────────
        // Signature is valid → payment IS captured by Razorpay at this point.
        // We MUST NOT return 500 if order creation fails — the customer's money
        // is taken. Return 202 with paymentCaptured:true so the frontend can
        // show a proper "payment received, order is being created" message.
        //
        // ⚠️  Retry safety: processPaidOrder has an atomic claim (findOneAndUpdate
        // paymentStatus: pending → paid) that runs OUTSIDE the Mongoose session.
        // If attempt 1 wins the claim then the session transaction aborts (network
        // error, DB timeout, etc.), the claim is NOT rolled back. On retry 2 the
        // claim returns null → processPaidOrder returns { message: "Already processed" }.
        //
        // This is actually CORRECT behaviour: the webhook will fire independently
        // and complete the order. We treat "Already processed" on a NON-first
        // attempt as a known-partial state and route to the 202 path so the
        // customer sees the "payment received" screen rather than a false success.
        let result;
        let attemptSucceeded = false;
        try {
            result = await withRetry(
                async () => {
                    const r = await processPaidOrder(existingOrder._id, razorpay_payment_id, razorpay_signature, req);
                    // "Already processed" on first call = idempotent success (webhook raced us).
                    // "Already processed" on a RETRY = claim fired but transaction aborted.
                    // We can't distinguish which retry we're on inside the lambda, so we
                    // expose the message and let the outer handler decide.
                    return r;
                },
                3,   // attempts
                500  // base backoff ms (500 → 1000 → 2000)
            );
            // If the result comes back as "Already processed" it means the first
            // attempt's atomic claim succeeded but the transaction may not have.
            // The webhook will complete it — return 202 so the frontend shows the
            // "payment received" screen instead of navigating to a potentially
            // empty confirmation page.
            if (result?.message === "Already processed") {
                // Re-check: is the order fully finalised (in UserProfile.orders)?
                const userHasOrder = await UserProfile.exists({
                    _id: existingOrder.user,
                    orders: existingOrder._id
                });
                if (userHasOrder) {
                    // Fully processed — genuine idempotent hit. Return success.
                    attemptSucceeded = true;
                } else {
                    // Atomic claim fired but session transaction aborted.
                    // The cart was NOT cleared. Force-clear the specific items now.
                    const productIdsToRemove = existingOrder.items.map(i => i.product);
                    await UserProfile.findByIdAndUpdate(existingOrder.user, {
                        $pull: { cart: { product: { $in: productIdsToRemove } } }
                    }).catch(e => console.error("[verifyPayment] Failed to clear cart on partial failure:", e.message));

                    // Webhook safety net will complete the order.
                    // Tell the frontend "payment received, order pending".
                    console.warn("[verifyPayment] Atomic claim fired but order not in UserProfile — routing to 202.");
                    return res.status(202).json({
                        success: false,
                        paymentCaptured: true,
                        message: "Your payment was received but order confirmation is delayed. Your order will appear in My Account within a few minutes.",
                        razorpay_payment_id,
                        orderId: existingOrder._id.toString(),
                        // /order-status returns the order in any paymentStatus state (unlike
                        // /api/orders/:id which hides pending/draft orders with a 404)
                        pollUrl: `/api/v1/payment/order-status/${existingOrder._id}`
                    });
                }
            } else {
                attemptSucceeded = true;
            }
        } catch (processErr) {
            // All 3 attempts failed. Log at CRITICAL severity.
            console.error("[verifyPayment] processPaidOrder failed after 3 retries:", processErr.message);
            await logAction(req, "order_creation_failed_all_retries", "order", existingOrder._id.toString(), {
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                error: processErr.message,
                attempts: 3
            }, { severity: "CRITICAL" }).catch(err => console.error("Retry exhausted audit failed:", err));

            // ── Stamp the order as needing ops review ────────────────────────────
            // Log alone is easy to miss. Setting a persisted flag makes the stuck
            // order queryable: Order.find({ needsManualReview: true })
            await Order.updateOne(
                { _id: existingOrder._id },
                { $set: {
                    needsManualReview: true,
                    reviewReason: `processPaidOrder failed after 3 retries: ${processErr.message}`
                }}
            ).catch(e => console.error("[verifyPayment] Failed to set needsManualReview flag:", e.message));

            // 202 = "we received it, still working on it".
            // The Razorpay webhook (payment.captured event) will retry processPaidOrder
            // asynchronously — the order WILL be created eventually.
            return res.status(202).json({
                success: false,
                paymentCaptured: true,
                message: "Your payment was received but order confirmation is delayed. Your order will appear in My Account within a few minutes.",
                razorpay_payment_id,
                orderId: existingOrder._id.toString(),
                // /order-status returns the order in any paymentStatus state (unlike
                // /api/orders/:id which hides pending/draft orders with a 404)
                pollUrl: `/api/v1/payment/order-status/${existingOrder._id}`
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.order,
        });

    } catch (err) {
        console.error("Payment verification error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/* =========================================================
   RAZORPAY WEBHOOK
   Fallback in case the frontend verify call failed (e.g. network drop)
========================================================= */
export const razorpayWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error("[Webhook] Missing RAZORPAY_WEBHOOK_SECRET in environment");
            return res.status(500).json({ success: false, message: "Webhook configuration error" });
        }
        if (!req.rawBody) {
            console.error("[Webhook] Missing req.rawBody - raw body parser not configured correctly");
            return res.status(400).json({ success: false, message: "Missing raw body" });
        }

        const signature = req.headers["x-razorpay-signature"];

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(req.rawBody)
            .digest("hex");

        if (expectedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        const { event, payload } = req.body;

        if (event === "payment.captured") {
            const payment = payload.payment.entity;
            
            let existing = null;
            if (payment.order_id) {
                existing = await Order.findOne({ razorpayOrderId: payment.order_id });
            }
            
            // Fallback for Admin Payment Links (they don't store razorpayOrderId before payment)
            if (!existing && payment.notes?.orderId) {
                existing = await Order.findById(payment.notes.orderId);
            }
            
            if (existing) {
                // Guard: if the order is cancelled AND the refund is already
                // in-flight (pending/processed), this webhook is a duplicate — skip.
                // This prevents the double-Shiprocket-cancel scenario where
                // handleOrderCancellationSideEffects already ran AND this webhook fires.
                if (existing.orderStatus === "cancelled" && ["processed", "pending"].includes(existing.refundStatus)) {
                     console.log(`[Webhook] Duplicate refund event for order ${existing._id}. Skipping.`);
                     return res.status(200).json({ success: true, message: "Duplicate event" });
                }

                if (existing.orderStatus === "cancelled" && !["processed", "pending"].includes(existing.refundStatus)) {
                    console.warn(`[Webhook] Order ${existing._id} was cancelled, but payment was captured. Initiating auto-refund.`);
                    try {
                        const razorpayInstance = new Razorpay({
                            key_id: process.env.RAZORPAY_KEY_ID,
                            key_secret: process.env.RAZORPAY_KEY_SECRET,
                        });
                        await razorpayInstance.payments.refund(payment.id, {
                            amount: payment.amount,
                            notes: { reason: "Order was already cancelled before payment was processed." }
                        });
                        console.log(`[Webhook] Auto-refund initiated for payment ${payment.id}`);
                        
                        await logAction(req, "payment_auto_refunded", "order", existing._id.toString(), {
                            paymentId: payment.id,
                            amount: payment.amount / 100,
                            reason: "Order was cancelled"
                        }, { source: "razorpay-webhook", severity: "WARNING" });
                        
                    } catch (refundErr) {
                        console.error(`[Webhook] Failed to auto-refund payment ${payment.id}:`, refundErr);
                    }
                    return res.status(200).json({ success: true, message: "Order is cancelled. Auto-refund initiated." });
                }

                // Pessimistic check: Did the transaction ACTUALLY complete?
                const isFullyProcessed = await UserProfile.exists({ _id: existing.user, orders: existing._id });
                
                if (!isFullyProcessed) {
                    if (existing.paymentStatus === "paid") {
                        // The order was claimed, but transaction never finished.
                        // Is it actively running, or did the Node server crash?
                        const lockAgeMs = Date.now() - (existing.paymentClaimedAt?.getTime() || 0);
                        
                        if (lockAgeMs > 120000) { // 2 minutes timeout
                            console.warn(`[Webhook] Force-releasing STALE 'paid' lock for order ${existing._id} (age: ${lockAgeMs}ms). Recovering from crash.`);
                            await Order.updateOne({ _id: existing._id }, { $set: { paymentStatus: "pending" } });
                            await processPaidOrder(existing._id, payment.id, null, req);
                        } else {
                            console.warn(`[Webhook] Order ${existing._id} is actively processing (lock age: ${lockAgeMs}ms). Returning 409 to force webhook retry.`);
                            // Return 409 so Razorpay retries the webhook in a few minutes
                            return res.status(409).json({ success: false, message: "Transaction actively processing. Please retry later." });
                        }
                    } else {
                        // Normal draft state
                        await processPaidOrder(existing._id, payment.id, null, req);
                    }
                } else {
                    console.log(`[Webhook] Order ${existing._id} already fully processed. Ignored.`);
                }
            } else if (!existing) {
                // 🚀 Audit Payment Success No Order (should be very rare now!)
                await logAction(req, "payment_success_no_order", "order", payment.order_id, {
                    paymentId: payment.id,
                    amount: payment.amount / 100
                }, { source: "razorpay-webhook", severity: "CRITICAL" }).catch(err => console.error("Payment Success No Order Audit:", err));
                
                let refundSuccess = false;
                try {
                    const razorpayInstance = new Razorpay({
                        key_id: process.env.RAZORPAY_KEY_ID,
                        key_secret: process.env.RAZORPAY_KEY_SECRET,
                    });
                    const paymentFetch = await razorpayInstance.payments.fetch(payment.id);
                    if (paymentFetch.status === "captured" && paymentFetch.amount_refunded === 0) {
                        await razorpayInstance.payments.refund(payment.id, {
                            amount: paymentFetch.amount,
                            notes: { reason: "Orphaned payment (no order found). Auto-refunded." }
                        });
                        console.log(`[Webhook] Auto-refunded orphaned payment ${payment.id}`);
                        refundSuccess = true;
                    } else if (paymentFetch.amount_refunded > 0) {
                        refundSuccess = true;
                    }
                } catch (err) {
                    console.error(`[Webhook] Failed to auto-refund orphaned payment ${payment.id}:`, err);
                }

                // If sendAdminPaymentSuccessNoOrderAlert doesn't take 4 arguments, it'll just ignore the 4th,
                // but the ops alert will still trigger from NotificationService.
                sendAdminPaymentSuccessNoOrderAlert(payment.id, payment.order_id, payment.amount / 100);

                await NotificationService.emit({
                    title: `Orphaned Payment Received ${refundSuccess ? '(Auto-Refunded)' : '(Action Required)'}`,
                    body: `Payment of ₹${payment.amount / 100} was captured via Razorpay, but the corresponding order was not found in our database. ${refundSuccess ? 'It has been automatically refunded.' : 'Auto-refund FAILED. Please refund manually in Razorpay.'}`,
                    type: "critical",
                    sourceModule: "payment",
                    sourceId: payment.id
                });
            }
        } else if (event === "payment.failed") {
            const payment = payload.payment.entity;

            // ── Update status + restore stock atomically ──────────────────────────
            // Razorpay retries webhook delivery on non-200 responses, so this handler
            // can fire more than once for the same event. We gate BOTH the status update
            // and the stock restoration on isStockRestored to prevent double-restore.
            // { new: true } returns the POST-update doc so isStockRestored reflects
            // whether WE just set it (true) or it was already set by a prior delivery (false).
            // Fix: include "failed" in the filter so a second webhook delivery (Razorpay retries
            // on non-200 responses) can still restore stock if the first delivery set
            // paymentStatus→"failed" but then crashed before completing the bulkWrite.
            const failedOrder = await Order.findOneAndUpdate(
                { razorpayOrderId: payment.order_id, paymentStatus: { $in: ["pending", "failed"] }, isStockRestored: false },
                { $set: { paymentStatus: "failed", isStockRestored: true } },
                { new: true }
            );

            if (failedOrder && failedOrder.items?.length > 0) {
                try {
                    const restoreOps = failedOrder.items.map(item => ({
                        updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } }
                    }));
                    await Product.bulkWrite(restoreOps);
                    console.log(`[Webhook] Restored stock for payment.failed order ${failedOrder._id}`);
                } catch (stockErr) {
                    console.error("[Webhook] Failed to restore stock on payment.failed:", stockErr.message);
                }
            }

            await logAction(req, "payment_failed", "order", payment.order_id, {
                paymentId: payment.id,
                reason: payment.error_description
            }, { source: "razorpay-webhook", severity: "WARNING" }).catch(err => console.error("Payment Failed Audit Failed:", err));

            await NotificationService.emit({
                title: "Payment Failed",
                body: `A payment attempt of ₹${payment.amount / 100} failed. Reason: ${payment.error_description}`,
                type: "warning",
                sourceModule: "payment",
                sourceId: payment.id
            });

            const settings = await getSettings();
            if (settings.waAllEnabled && settings.waPaymentFailureEnabled) {
              await enqueueWhatsApp("payment_failure", {
                razorpayOrderId: payment.order_id,
                amount: payment.amount / 100
              }, { delay: 3000 }).catch(err => console.error("Failed to enqueue WhatsApp payment_failure:", err));
            }
        } else if (event === "refund.processed") {
            const refund = payload.refund.entity;
            const paymentId = refund.payment_id;
            
            const order = await Order.findOne({ razorpayPaymentId: paymentId });
            if (order) {
                order.paymentStatus = "refunded";
                order.refundStatus = "processed";
                
                // CRITICAL: If an admin refunded this directly on Razorpay, we MUST cancel the order
                // so we don't accidentally ship it for free.
                // Snapshot the status BEFORE mutating so the Shiprocket cancel guard
                // below can check whether the order was already cancelled prior to
                // this webhook (i.e. handleOrderCancellationSideEffects already ran).
                const statusBeforeRefundWebhook = order.orderStatus;
                if (order.orderStatus !== "cancelled" && order.orderStatus !== "returned") {
                    const previousStatus = order.orderStatus;
                    order.orderStatus = "cancelled";
                    order.statusHistory = order.statusHistory || [];
                    order.statusHistory.push({
                        fromStatus: previousStatus,
                        toStatus: "cancelled",
                        status: "cancelled",
                        source: "razorpay-webhook",
                        note: "Order auto-cancelled because a refund was processed on Razorpay"
                    });
                }

                try {
                    // 1. Shiprocket Cancel — only if not already cancelled BEFORE this webhook
                    // fired (i.e. handleOrderCancellationSideEffects hadn't already run).
                    // We use the pre-mutation snapshot so that setting order.orderStatus = "cancelled"
                    // above doesn't make this condition evaluate to false (the original bug).
                    if ((order.awb || order.shiprocketOrderId) && statusBeforeRefundWebhook !== "cancelled") {
                        if (process.env.SHIPROCKET_EMAIL) {
                            const { getShiprocketToken } = await import("../tracker/shiprocketservice.js");
                            const token = await getShiprocketToken();
                            let shipCancelRes;
                            if (order.awb) {
                                shipCancelRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel/awbs", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ awbs: [order.awb] })
                                });
                            } else if (order.shiprocketOrderId) {
                                shipCancelRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ ids: [order.shiprocketOrderId] })
                                });
                            }
                            // Guard: a silent Shiprocket failure here means the order stays
                            // active in Shiprocket even though our DB marks it cancelled,
                            // risking accidental shipment. Log loudly so ops can act.
                            if (shipCancelRes && !shipCancelRes.ok) {
                                const errText = await shipCancelRes.text().catch(() => "(unreadable)");
                                console.error(`[Webhook] Shiprocket cancel FAILED for order ${order._id} (status ${shipCancelRes.status}): ${errText}. Order may still be active in Shiprocket — manual cancel required.`);
                            }
                        }
                    }

                    // 2. Restore Stock
                    if (!order.isStockRestored && order.items && order.items.length > 0) {
                        const claimedOrder = await Order.findOneAndUpdate(
                            { _id: order._id, isStockRestored: false },
                            { $set: { isStockRestored: true } }
                        );

                        if (claimedOrder) {
                            try {
                                const bulkOps = order.items.map(item => ({
                                    updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
                                }));
                                await Product.bulkWrite(bulkOps);
                                order.isStockRestored = true;
                            } catch (stockErr) {
                                console.error("Webhook cancel: Failed to restore stock:", stockErr.message);
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
                } catch (err) {
                    console.error("Webhook side effects failed:", err.message);
                } finally {
                    await Order.updateOne({ _id: order._id }, {
                        $set: {
                            orderStatus: order.orderStatus,
                            statusHistory: order.statusHistory,
                            paymentStatus: order.paymentStatus,
                            refundStatus: order.refundStatus,
                            refundId: refund.id || order.refundId || null,
                            refundAmount: order.refundAmount ?? null,
                            isStockRestored: order.isStockRestored
                        }
                    });
                }
                
                await logAction(req, "refund_confirmed", "order", order._id.toString(), {
                    refundId: refund.id,
                    amount: refund.amount / 100,
                    autoCancelled: true
                }, { source: "razorpay-webhook" }).catch(err => console.error("Refund Confirmed Audit Failed:", err));
            }
        }

        return res.status(200).json({ success: true, message: "Webhook processed" });

    } catch (err) {
        console.error("Webhook processing error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

/* =========================================================
   GENERATE PAYMENT LINK (Admin Draft Orders)
   POST /api/v1/admin/orders/:id/payment-link
========================================================= */
export const generatePaymentLink = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate("user", "name email phone");
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (order.paymentStatus === "paid") {
            return res.status(400).json({ success: false, message: "Order is already paid" });
        }

        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        if (order.paymentLink && order.paymentLinkExpiresAt && new Date() < order.paymentLinkExpiresAt) {
            // Verify link status via Razorpay
            if (order.paymentLinkId) {
                try {
                    const link = await razorpayInstance.paymentLink.fetch(order.paymentLinkId);
                    if (link.status === "paid") {
                        return res.status(400).json({ success: false, message: "Order is already paid via Razorpay link" });
                    }
                } catch (err) {
                    console.error("Failed to verify payment link status:", err.message);
                }
            }
            return res.status(200).json({ success: true, data: { paymentLink: order.paymentLink } });
        }

        // Expiry time: 24 hours from now
        const expireBy = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

        const paymentLinkReq = {
            amount: toRazorpayMinorUnits(order.totalAmount, order.currency || "INR"),
            currency: order.currency || "INR",
            accept_partial: false,
            description: `Payment for Bodilicious Order ${order._id}`,
            customer: {
                name: order.user?.name || order.shippingDetails?.name || "Customer",
                email: order.user?.email || order.shippingDetails?.email,
                contact: order.user?.phone || order.shippingDetails?.phone
            },
            notify: {
                sms: true,
                email: true
            },
            reminder_enable: true,
            notes: {
                orderId: order._id.toString()
            },
            expire_by: expireBy
        };

        const paymentLinkRes = await razorpayInstance.paymentLink.create(paymentLinkReq);

        await Order.findByIdAndUpdate(order._id, {
            $set: {
                paymentLinkId: paymentLinkRes.id,
                paymentLink: paymentLinkRes.short_url,
                paymentLinkExpiresAt: new Date(expireBy * 1000)
            }
        });

        logAction(req, "PAYMENT_LINK_GENERATED", "order", order._id.toString(), {
            paymentLink: paymentLinkRes.short_url
        });

        return res.status(200).json({ success: true, data: { paymentLink: paymentLinkRes.short_url } });
    } catch (err) {
        console.error("Generate Payment Link Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
