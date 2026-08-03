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
import mongoose from "mongoose";
import Order from "../tracker/models.js";
import { processPaidOrder } from "./controller.js";
import { logAction } from "../admin/controller.js";

const systemLockSchema = new mongoose.Schema({
  _id: String,
  lockedAt: Date
});
systemLockSchema.index({ lockedAt: 1 }, { expireAfterSeconds: 600 });
const SystemLock = mongoose.models.SystemLock || mongoose.model("SystemLock", systemLockSchema);

// How old a pending order must be before we check it (avoid racing the verify call)
const MIN_AGE_MINUTES = 3;
// Maximum age to check — beyond 24h Razorpay won't have outstanding captures anyway
const MAX_AGE_HOURS = 24;
// Safety: never process more than this many orders per cron tick
const MAX_ORDERS_PER_RUN = 20;

// ── Idle-skip: when no stale orders exist, avoid a DB round-trip every 30 min.
// After a quiet run we wait 4 hours before hitting MongoDB again.
// Any non-zero find resets this so we stay responsive.
const QUIET_SKIP_MS = 4 * 60 * 60 * 1000; // 4 hours
let lastQuietAt = null; // timestamp of last run that found 0 orders

/**
 * Core reconciliation logic — exported for manual triggering from admin routes.
 *
 * @param {object}  [options]
 * @param {boolean} [options.force] Bypass the idle-skip window. Manual admin
 *   triggers MUST pass this: the quiet window is up to 4 hours long, so without it
 *   the "customer paid but has no order" recovery button was a silent no-op for
 *   most of the day — exactly the situation it exists to fix.
 */
export async function runPaymentReconciliation({ force = false } = {}) {
    // ── Idle-skip: if the last run found nothing and we're still within the
    // quiet window, skip the entire function to avoid pointless DB round-trips.
    // Only scheduled cron ticks are eligible to skip.
    if (!force && lastQuietAt !== null && (Date.now() - lastQuietAt) < QUIET_SKIP_MS) {
        console.log(`[Reconcile] Quiet skip — no stale orders found in last run. Next full check in ${Math.round((QUIET_SKIP_MS - (Date.now() - lastQuietAt)) / 60000)} min.`);
        return { skipped: true, reason: 'quiet' };
    }

    // A forced run means someone is actively chasing a missing order. Clear the
    // quiet marker so subsequent cron ticks resume checking every 30 minutes.
    if (force) lastQuietAt = null;

    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    let lock;
    try {
        lock = await SystemLock.findOneAndUpdate(
            { _id: "reconciliation", $or: [{ lockedAt: null }, { lockedAt: { $lt: staleThreshold } }] },
            { $set: { lockedAt: new Date() } },
            { upsert: true, returnDocument: "after" }
        );
    } catch (err) {
        if (err.code === 11000) {
            console.log("[Reconcile] Lock contention — another process is running.");
            return { skipped: true };
        }
        throw err;
    }
    
    if (!lock) {
        console.log("[Reconcile] Previous run still in progress — skipping.");
        return { skipped: true };
    }

    const startedAt = Date.now();
    let checked = 0;
    let recovered = 0;
    let errors = 0;


    try {
        const now = new Date();
        const minAge = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000);
        const maxAge = new Date(now.getTime() - MAX_AGE_HOURS * 60 * 60 * 1000);

        // Find pending or failed Razorpay orders created within the recoverable window.
        // Including lastClaimFailedAt ensures we pick up reverted claims too.

    const stalePendingOrders = await Order.find({
            $or: [
                {
                    paymentStatus: { $in: ["pending", "failed"] },
                    createdAt: { $lte: minAge, $gte: maxAge }
                },
                {
                    paymentStatus: "paid",
                    invoiceGenerated: { $ne: true },
                    createdAt: { $lte: minAge }
                }
            ],
            orderStatus: { $ne: "abandoned" },
            paymentMethod: "razorpay",
            razorpayOrderId: { $exists: true, $ne: null }
        })
            .select("_id razorpayOrderId user createdAt")
            .limit(MAX_ORDERS_PER_RUN)
            .lean();

        if (stalePendingOrders.length === 0) {
            // Record quiet timestamp so the next ticks can skip the DB call —
            // but NEVER off the back of a forced run. An admin forces this while
            // actively chasing a missing order, and an order younger than
            // MIN_AGE_MINUTES is invisible to this query. Re-arming the 4-hour
            // window here would hide that order from the cron for another 4 hours,
            // right when we most need to keep looking.
            if (!force) lastQuietAt = Date.now();
            return { checked: 0, recovered: 0, errors: 0, durationMs: Date.now() - startedAt };
        }

        console.log(`[Reconcile] Checking ${stalePendingOrders.length} stale pending orders…`);
        // Reset quiet-skip: orders exist, keep checking on every tick until drained.
        lastQuietAt = null;


        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        for (const order of stalePendingOrders) {
            checked++;
            try {
                // Fetch all payments associated with this Razorpay order
                const payments = await razorpay.orders.fetchPayments(order.razorpayOrderId);

                // Find a fully captured payment — "authorized" is intentionally excluded:
                // authorized payments have not yet been settled to the merchant account.
                // Calling processPaidOrder on them would mark the order as paid before
                // Razorpay actually transfers the funds. Only "captured" is safe to process.
                const capturedPayment = (payments.items || []).find(
                    (p) => p.status === "captured"
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
                const syntheticReq = {
                    user: { _id: null, email: "system@reconciliation" },
                    ip: "127.0.0.1",
                    headers: {},
                    body: {}
                };
                await processPaidOrder(
                    order._id,
                    capturedPayment.id,
                    null, // no signature when coming from reconciliation
                    syntheticReq
                );

                // Clear the manual review flag if it was set during a failed verifyPayment attempt
                await Order.updateOne({ _id: order._id }, { $set: { needsManualReview: false } });

                recovered++;

                await logAction(
                    syntheticReq,
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
        await SystemLock.updateOne({ _id: "reconciliation" }, { $set: { lockedAt: null } }).catch(err => console.error("[Reconcile] Failed to release lock:", err.message));
    }
}

/**
 * Schedules the reconciliation cron.
 * Called once from server.js after DB connects.
 */
export function initPaymentReconciliationCron() {
    if (process.env.NODE_ENV === "test") return;

    // Run every 30 minutes — webhook handles instant recovery, this is only the fallback.
    // Was every 5 min (288 Razorpay API calls/day) → now 48 calls/day.
    cron.schedule("*/30 * * * *", () => {
        runPaymentReconciliation().catch((err) =>
            console.error("[Reconcile] Unhandled error:", err.message)
        );
    });

    console.log("[Reconcile] Payment reconciliation cron scheduled (every 30 mins).");

    // Run once shortly after startup to catch anything from a previous server crash
    setTimeout(() => {
        runPaymentReconciliation().catch((err) =>
            console.error("[Reconcile] Initial run failed:", err.message)
        );
    }, 15_000); // 15s after startup — give DB connections time to warm up
}
