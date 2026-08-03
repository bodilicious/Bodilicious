import { Router } from "express";
import { initRazorpayOrder, verifyPayment, razorpayWebhook, getOrderQuote } from "./controller.js";
import { runPaymentReconciliation } from "./reconciliation.js";
import { protect, tryProtect, adminOnly } from "../middleware/auth.js";
import Order from "../tracker/models.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema, verifyPaymentSchema } from "../tracker/schema.js";

const router = Router();

// Get order quote (subtotal, shipping, HMAC signed quoteId) - Supports guests via tryProtect
router.post("/quote", tryProtect, getOrderQuote);

// Init Razorpay order (creates only a Razorpay order, no DB record)
router.post("/razorpay/init", protect, validate(createOrderSchema), initRazorpayOrder);

// Verify Razorpay payment and create DB order
router.post("/verify", protect, validate(verifyPaymentSchema), verifyPayment);

// Webhook endpoint for Razorpay to hit
router.post("/webhook", razorpayWebhook);

// ── Admin: manually trigger payment reconciliation ─────────────────────────
// POST /api/v1/payment/admin/reconcile
// Runs the same job the cron runs every 5 min. Use when a customer reports
// a missing order after payment — no need to wait for the next cron tick.
// ── Admin: manually trigger payment reconciliation ─────────────────────────
// POST /api/v1/payment/admin/reconcile
// adminOnly guard added — any authenticated user could otherwise trigger processPaidOrder.
router.post("/admin/reconcile", protect, adminOnly, async (req, res) => {
    try {
        // force: bypass the idle-skip window — an admin hitting this is chasing a
        // specific missing order and must never get a silent no-op.
        const result = await runPaymentReconciliation({ force: true });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("[Admin Reconcile] Error:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ── Payment Order Status ────────────────────────────────────────────────────
// GET /api/v1/payment/order-status/:orderId
// Returns minimal payment/order status for a pending order.
// Used by the 202 pollUrl so the frontend can poll without hitting the 404 that
// getSingleOrder returns while paymentStatus is still "pending" or "paid"+invoiceGenerated=false.
router.get("/order-status/:orderId", protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.orderId,
            user: req.user._id
        }).select("orderStatus paymentStatus invoiceGenerated invoiceNumber").lean();

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        return res.json({
            success: true,
            data: {
                orderId: order._id,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
                // true only once processPaidOrder committed fully (invoice generated)
                isConfirmed: order.invoiceGenerated === true,
                invoiceNumber: order.invoiceNumber || null
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
