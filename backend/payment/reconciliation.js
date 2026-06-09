/**
 * Payment Reconciliation Cron
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 5 minutes. Finds orders stuck in `paymentStatus: "pending"` that
 * have a `razorpayOrderId` and were created more than 3 minutes ago (to avoid
 * racing with a verify call still in-flight).
 *
 * For each such order it calls the Razorpay API to get the actual payment
 * status. If a payment exists in state "captured" or "authorized", it calls
 * processPaidOrder — which has its own atomic idempotency so it's safe to
 * call even if the webhook already ran first.
 *
 * This is the LAST LINE OF DEFENCE after:
 *   1. Frontend verify call  (fails if tab is closed)
 *   2. Razorpay webhook      (fails if server was down or webhook not configured)
 */

import cron from "node-cron";
import Razorpay from "razorpay";
import Order from "../tracker/models.js";
import { processPaidOrder } from "./controller.js";
import { logAction } from "../admin/controller.js";

// How old a pending order must be before we check it (avoid racing the verify call)
const MIN_AGE_MINUTES = 3;
// Maximum age to check — beyond 24h Razorpay won't have outstanding captures anyway
const MAX_AGE_HOURS = 24;
// Safety: never process more than this many orders per cron tick
const MAX_ORDERS_PER_RUN = 20;

let isReconciling = false; // prevent overlapping runs

/**
 * Core reconciliation logic — exported for manual triggering from admin routes.
 */
export async function runPaymentReconciliation() {
    if (isReconciling) {
        console.log("[Reconcile] Previous run still in progress — skipping.");
        return { skipped: true };
    }
    isReconciling = true;

    const startedAt = Date.now();
    let checked = 0;
    let recovered = 0;
    let errors = 0;

    try {
        const now = new Date();
        const minAge = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000);
        const maxAge = new Date(now.getTime() - MAX_AGE_HOURS * 60 * 60 * 1000);

        // Find pending or failed Razorpay orders created within the recoverable window
        const stalePendingOrders = await Order.find({
            paymentStatus: { $in: ["pending", "failed"] },
            paymentMethod: "razorpay",
            razorpayOrderId: { $exists: true, $ne: null },
            createdAt: {
                $lte: minAge,  // at least 3 min old
                $gte: maxAge,  // no older than 24h
            },
        })
            .select("_id razorpayOrderId user createdAt")
            .limit(MAX_ORDERS_PER_RUN)
            .lean();

        if (stalePendingOrders.length === 0) {
            return { checked: 0, recovered: 0, errors: 0, durationMs: Date.now() - startedAt };
        }

        console.log(`[Reconcile] Checking ${stalePendingOrders.length} stale pending orders…`);

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        for (const order of stalePendingOrders) {
            checked++;
            try {
                // Fetch all payments associated with this Razorpay order
                const payments = await razorpay.orders.fetchPayments(order.razorpayOrderId);

                // Find any captured or authorized payment
                const capturedPayment = (payments.items || []).find(
                    (p) => p.status === "captured" || p.status === "authorized"
                );

                if (!capturedPayment) {
                    // No captured payment — this order was genuinely abandoned or failed
                    // Don't touch it; let the max-age window expire naturally
                    continue;
                }

                console.log(
                    `[Reconcile] Found captured payment ${capturedPayment.id} for order ${order._id}. Processing…`
                );

                // processPaidOrder has atomic idempotency — safe to call even if webhook already ran
                await processPaidOrder(
                    order._id,
                    capturedPayment.id,
                    null, // no signature when coming from reconciliation
                    {}   // dummy req object — audit log will mark source as "reconciliation"
                );

                recovered++;

                await logAction(
                    {},
                    "payment_reconciled",
                    "order",
                    order._id.toString(),
                    {
                        razorpayOrderId: order.razorpayOrderId,
                        razorpayPaymentId: capturedPayment.id,
                        ageMinutes: Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000),
                    },
                    { source: "reconciliation-cron", severity: "WARNING" }
                ).catch((e) => console.error("[Reconcile] Audit log failed:", e.message));

            } catch (err) {
                errors++;
                console.error(
                    `[Reconcile] Error processing order ${order._id}:`,
                    err.message
                );
            }
        }

        const durationMs = Date.now() - startedAt;
        console.log(
            `[Reconcile] Done — checked: ${checked}, recovered: ${recovered}, errors: ${errors}, took: ${durationMs}ms`
        );
        return { checked, recovered, errors, durationMs };

    } catch (err) {
        console.error("[Reconcile] Fatal error in reconciliation run:", err.message);
        return { checked, recovered, errors: errors + 1, durationMs: Date.now() - startedAt };
    } finally {
        isReconciling = false;
    }
}

/**
 * Schedules the reconciliation cron.
 * Called once from server.js after DB connects.
 */
export function initPaymentReconciliationCron() {
    if (process.env.NODE_ENV === "test") return;

    // Run every 5 minutes
    cron.schedule("*/5 * * * *", () => {
        runPaymentReconciliation().catch((err) =>
            console.error("[Reconcile] Unhandled error:", err.message)
        );
    });

    console.log("[Reconcile] Payment reconciliation cron scheduled (every 5 mins).");

    // Run once shortly after startup to catch anything from a previous server crash
    setTimeout(() => {
        runPaymentReconciliation().catch((err) =>
            console.error("[Reconcile] Initial run failed:", err.message)
        );
    }, 15_000); // 15s after startup — give DB connections time to warm up
}
