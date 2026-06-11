import { Router } from "express";
import { initRazorpayOrder, verifyPayment, razorpayWebhook, getOrderQuote } from "./controller.js";
import { runPaymentReconciliation } from "./reconciliation.js";
import { protect, tryProtect } from "../middleware/auth.js";
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
router.post("/admin/reconcile", protect, async (req, res) => {
    try {
        const result = await runPaymentReconciliation();
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("[Admin Reconcile] Error:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
