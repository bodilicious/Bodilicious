import { Router } from "express";
import { initRazorpayOrder, verifyPayment, razorpayWebhook } from "./controller.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema, verifyPaymentSchema } from "../tracker/schema.js";

const router = Router();

// Init Razorpay order (creates only a Razorpay order, no DB record)
router.post("/razorpay/init", protect, validate(createOrderSchema), initRazorpayOrder);

// Verify Razorpay payment and create DB order
router.post("/verify", protect, validate(verifyPaymentSchema), verifyPayment);

// Webhook endpoint for Razorpay to hit
router.post("/webhook", razorpayWebhook);

export default router;
