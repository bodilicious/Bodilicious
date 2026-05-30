import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../tracker/models.js";
import UserProfile from "../profile/models.js";
import Product from "../products/models.js";
import { getShiprocketToken, getEstimatedDeliveryDate, pushOrderToShiprocket } from "../tracker/shiprocketservice.js";
import { sendOrderConfirmationEmail, sendOrderConfirmationAfterInvoice } from "../email/emailService.js";
import Razorpay from "razorpay";
import { logAction } from "../admin/controller.js";
import { trackServerEvent } from "../utils/posthog.js";
import StoreSettings from "../settings/models.js";

/* =========================================================
   INIT RAZORPAY ORDER
   POST /api/payment/razorpay/init
   Creates ONLY a Razorpay order — no DB order, no stock change.
   Backend calculates price from DB to prevent manipulation.
========================================================= */
export const initRazorpayOrder = async (req, res) => {
    try {
        const { items, shippingDetails } = req.body;
        const userId = req.user._id;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }
        if (!shippingDetails?.address) {
            return res.status(400).json({ success: false, message: "Shipping details required" });
        }

        // Calculate price from DB — never trust the frontend
        let totalAmount = 0;
        for (const item of items) {
            console.log("Processing item during checkout:", item);
            let product;
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                product = await Product.findById(item.productId);
            }
            if (!product) {
                const searchPid = item.pid || item.productId;
                product = await Product.findOne({ pid: searchPid });
            }
            if (!product) {
                console.error("Product not found for item:", item);
                return res.status(400).json({ success: false, message: "Product not found" });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
            }
            totalAmount += product.price * item.quantity;
        }

        // Welcome offer check (read-only, no DB write yet)
        const existingOrdersCount = await Order.countDocuments({
            user: userId,
            orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
        });
        let discountAmount = 0;
        if (existingOrdersCount === 0) {
            discountAmount = Math.round(totalAmount * 0.10);
        }

        const settings = await StoreSettings.findOne() || { shippingThreshold: 999, shippingCost: 99 };
        const shippingCost = totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost;
        const finalAmount = Math.max(0, totalAmount + shippingCost - discountAmount);

        // Create Razorpay order only
        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: finalAmount * 100, // paise
            currency: "INR",
            receipt: `rp_${Date.now()}`,
            notes: {
                userId: userId.toString(),
                itemCount: items.length,
            },
        });

        // 🚀 Audit Payment Initiated
        logAction(req, "payment_initiated", "order", razorpayOrder.id, {
            amount: finalAmount,
            itemCount: items.length
        }).catch(err => console.error("Payment Initiated Audit Failed:", err));

        return res.status(201).json({
            success: true,
            data: {
                razorpayOrder,
                calculatedAmount: finalAmount,
            },
        });

    } catch (err) {
        console.error("Init Razorpay Order error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};


/* =========================================================
   VERIFY PAYMENT & CREATE ORDER
   POST /api/payment/verify
   After payment success: verify signature → create DB order atomically
========================================================= */
export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items, shippingDetails, marketing } = req.body;
        const userId = req.user._id;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing Razorpay details" });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided" });
        }
        if (!shippingDetails?.address) {
            return res.status(400).json({ success: false, message: "Shipping details required" });
        }

        // Duplicate payment protection
        const existingOrder = await Order.findOne({ razorpayPaymentId: razorpay_payment_id });
        if (existingOrder) {
            return res.status(200).json({
                success: true,
                message: "Payment already processed",
                data: existingOrder,
            });
        }

        // Verify Razorpay signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            // 🚀 Audit Verification Failed
            logAction(req, "payment_verification_failed", "order", razorpay_order_id, {
                paymentId: razorpay_payment_id
            }, { severity: "CRITICAL" }).catch(err => console.error("Payment Verification Failed Audit Failed:", err));
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        // Atomic order creation with transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        let order;
        try {
            let totalAmount = 0;
            let totalWeightGrams = 0;
            const orderItems = [];

            // Re-calculate from DB (never trust frontend prices)
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
                if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

                totalAmount += product.price * item.quantity;
                const itemWeightG = product.product_weight_g || (product.product_weight_ml ? product.product_weight_ml * 1.05 : 200);
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
            const originalAmount = totalAmount + shippingCost;

            // Welcome offer
            const existingOrdersCount = await Order.countDocuments({
                user: userId,
                orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
            }).session(session);
            let isWelcomeOfferApplied = false;
            let discountAmount = 0;
            if (existingOrdersCount === 0) {
                isWelcomeOfferApplied = true;
                discountAmount = Math.round(originalAmount * 0.10);
            }
            const finalAmount = Math.max(0, originalAmount - discountAmount);

            // EDD
            const totalWeight = Math.max(0.5, totalWeightGrams / 1000);
            let eddData = { estimatedDeliveryDate: null, estimatedDeliveryDays: null, estimatedCourierName: null, eddCalculatedAt: null };
            try {
                const eddResponse = await getEstimatedDeliveryDate(shippingDetails.pincode, totalWeight, false);
                if (eddResponse) {
                    eddData = {
                        estimatedDeliveryDate: eddResponse.estimatedDeliveryDate,
                        estimatedDeliveryDays: eddResponse.estimatedDeliveryDays,
                        estimatedCourierName: eddResponse.estimatedCourierName,
                        eddCalculatedAt: new Date(),
                    };
                }
            } catch (e) {
                console.error("EDD fetch failed:", e.message);
            }

            // Create the DB order
            const [newOrder] = await Order.create([{
                user: userId,
                items: orderItems,
                totalAmount: finalAmount,
                discountAmount,
                isWelcomeOfferApplied,
                originalAmount,
                paymentMethod: "razorpay",
                paymentStatus: "paid",
                orderStatus: "pending",
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                shippingDetails,
                marketing: marketing || undefined,
                ...eddData,
            }], { session });

            await UserProfile.findByIdAndUpdate(userId, { $push: { orders: newOrder._id } }, { session });

            // Clear the user's cart in the DB
            await UserProfile.findByIdAndUpdate(userId, { $set: { cart: [] } }, { session });
            
            // 🚀 Audit Order Placement (Razorpay)
            logAction(req, "order_placed", "order", newOrder._id.toString(), {
                total: finalAmount,
                itemCount: orderItems.length,
                paymentMethod: "razorpay"
            }).catch(err => console.error("Order Placed Audit Failed (Razorpay):", err));

            // 🚀 PostHog Server-Side Tracking
            trackServerEvent(userId, 'Order Completed', {
              orderId: newOrder._id.toString(),
              revenue: finalAmount,
              shipping: shippingCost,
              tax: 0,
              paymentMethod: "razorpay",
              products: orderItems.map(item => ({
                productId: item.product.toString(),
                price: item.priceAtPurchase,
                quantity: item.quantity
              }))
            });

            await session.commitTransaction();
            session.endSession();

            order = await Order.findById(newOrder._id).populate("items.product");

        } catch (txErr) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            
            // 🚀 Audit Order Creation Failed
            logAction(req, "order_creation_failed", "order", razorpay_order_id, {
                error: txErr.message
            }, { severity: "ERROR" }).catch(err => console.error("Order Creation Failed Audit Failed:", err));

            throw txErr;
        }

        // Non-blocking Shiprocket integration
        pushOrderToShiprocket(order).catch(shipErr => {
            console.error("Shiprocket error after payment:", shipErr.message);
        });

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
        if (invoiceNumber) {
            const user = await UserProfile.findById(userId);
            const populatedOrder = await Order.findById(order._id).populate("items.product");
            sendOrderConfirmationAfterInvoice(populatedOrder, user?.email);
        } else {
            console.warn("⚠️ Invoice generation failed or missing, skipping email trigger after payment.");
        }

        return res.status(200).json({
            success: true,
            message: "Payment verified and order created successfully",
            data: order,
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
        const signature = req.headers["x-razorpay-signature"];

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(req.rawBody) // Use raw body Buffer — HMAC must be verified on exact bytes sent by Razorpay
            .digest("hex");

        if (expectedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        const { event, payload } = req.body;

        if (event === "payment.captured") {
            const payment = payload.payment.entity;
            // If the order already exists (verifyPayment succeeded), just mark it paid
            const existing = await Order.findOne({ razorpayOrderId: payment.order_id });
            if (existing && existing.paymentStatus !== "paid") {
                existing.paymentStatus = "paid";
                existing.razorpayPaymentId = payment.id;
                await existing.save();
                
                // 🚀 Audit Payment Captured
                logAction(req, "payment_captured", "order", existing._id.toString(), {
                    paymentId: payment.id,
                    amount: payment.amount / 100
                }, { source: "razorpay-webhook" }).catch(err => console.error("Payment Captured Audit Failed:", err));

                const populated = await Order.findById(existing._id).populate("items.product");
                await pushOrderToShiprocket(populated);
                
                // ── Generate Invoice ──────────────────────────────────────────────
                let invoiceNumber = null;
                try {
                    invoiceNumber = `INV-${Date.now()}-${populated._id.toString().slice(-4).toUpperCase()}`;
                    await Order.findByIdAndUpdate(populated._id, {
                        invoiceNumber,
                        invoiceGenerated: true
                    });
                    console.log(`🧾 Webhook Invoice generated for order ${populated._id}: ${invoiceNumber}`);
                } catch (invErr) {
                    console.error("❌ Webhook Invoice generation failed:", invErr.message);
                }

                // ── Trigger Order Confirmation Email
                if (invoiceNumber) {
                    const user = await UserProfile.findById(existing.user);
                    const freshPopulated = await Order.findById(populated._id).populate("items.product");
                    sendOrderConfirmationAfterInvoice(freshPopulated, user?.email);
                }
            } else if (!existing) {
                // 🚀 Audit Payment Success No Order
                logAction(req, "payment_success_no_order", "order", payment.order_id, {
                    paymentId: payment.id,
                    amount: payment.amount / 100
                }, { source: "razorpay-webhook", severity: "CRITICAL" }).catch(err => console.error("Payment Success No Order Audit Failed:", err));
            }
        } else if (event === "payment.failed") {
            const payment = payload.payment.entity;
            // If there's somehow a pending order, mark it failed
            await Order.findOneAndUpdate(
                { razorpayOrderId: payment.order_id, paymentStatus: "pending" },
                { paymentStatus: "failed" }
            );

            // 🚀 Audit Payment Failed
            logAction(req, "payment_failed", "order", payment.order_id, {
                paymentId: payment.id,
                reason: payment.error_description
            }, { source: "razorpay-webhook", severity: "WARNING" }).catch(err => console.error("Payment Failed Audit Failed:", err));
        } else if (event === "refund.processed") {
            const refund = payload.refund.entity;
            const paymentId = refund.payment_id;
            
            const order = await Order.findOne({ razorpayPaymentId: paymentId });
            if (order) {
                order.paymentStatus = "refunded";
                order.refundStatus = "processed";
                await order.save();
                
                // 🚀 Audit Refund Confirmed
                logAction(req, "refund_confirmed", "order", order._id.toString(), {
                    refundId: refund.id,
                    amount: refund.amount / 100
                }, { source: "system" }).catch(err => console.error("Refund Confirmed Audit Failed:", err));
            }
        }

        return res.status(200).json({ success: true, message: "Webhook processed" });

    } catch (err) {
        console.error("Webhook processing error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

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

        if (order.paymentLink) {
            return res.status(200).json({ success: true, data: { paymentLink: order.paymentLink } });
        }

        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Expiry time: 24 hours from now
        const expireBy = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

        const paymentLinkReq = {
            amount: Math.round(order.totalAmount * 100),
            currency: "INR",
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

        order.paymentLinkId = paymentLinkRes.id;
        order.paymentLink = paymentLinkRes.short_url;
        await order.save();

        logAction(req, "PAYMENT_LINK_GENERATED", "order", order._id.toString(), {
            paymentLink: paymentLinkRes.short_url
        });

        return res.status(200).json({ success: true, data: { paymentLink: paymentLinkRes.short_url } });
    } catch (err) {
        console.error("Generate Payment Link Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
