import cron from "node-cron";
import Order from "../tracker/models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";

export const initDraftOrderCleanupCron = () => {
    // Run every 30 minutes — synced with 30-min quote lock expiry. No point running faster.
    cron.schedule("*/30 * * * *", async () => {
        try {
            // Quote expiry is 30 minutes, so lock should be 30 minutes.
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            
            // ── Widen query to include "failed" ───────────────────────────────────
            // When Razorpay fires payment.failed, the webhook sets paymentStatus → "failed".
            // The previous query only swept "pending", so "failed" orders leaked permanently.
            // isStockRestored guard prevents double-restore if the webhook already ran
            // (webhook sets isStockRestored: true immediately after restoring).
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            const abandonedOrders = await Order.find({
                paymentMethod: "razorpay",
                paymentStatus: { $in: ["pending", "failed"] },
                isStockRestored: { $ne: true },
                orderStatus: { $ne: "abandoned" },
                createdAt: { $lt: thirtyMinutesAgo },
                $or: [
                    { lastClaimFailedAt: null },
                    { lastClaimFailedAt: { $exists: false } },
                    { lastClaimFailedAt: { $lt: fifteenMinutesAgo } }
                ]
            });

            if (abandonedOrders.length === 0) return;

            // ── Race fix ─────────────────────────────────────────────────────────
            // The query above is a snapshot. Between this .find() and the writes
            // below, a payment for one of these orders could be captured and
            // processPaidOrder() could flip paymentStatus → "paid" concurrently
            // (webhook or reconciliation cron racing this tick). The old code did
            // a blind bulk stock-restore + unconditional updateMany(abandoned) on
            // every ID from this stale snapshot — which could:
            //   1. Restore stock for an order that's mid-payment-confirmation,
            //      letting another customer buy inventory that's about to be sold,
            //      which then surfaces as a stock-exhaustion failure for the
            //      paying customer (see processPaidOrder's auto-refund path).
            //   2. Worse: mark an order that just became "paid" as "abandoned",
            //      directly corrupting a successful customer's order status.
            //
            // Fix: claim each order individually with an atomic findOneAndUpdate
            // that re-checks paymentStatus is STILL pending/failed at write time.
            // Only orders that win this claim get their stock restored and get
            // marked abandoned — anything that flipped to "paid" in the gap is
            // automatically skipped, with zero risk of clobbering it.
            const claimedOrders = [];

            for (const order of abandonedOrders) {
                const claimed = await Order.findOneAndUpdate(
                    {
                        _id: order._id,
                        paymentStatus: { $in: ["pending", "failed"] },
                        isStockRestored: { $ne: true }
                    },
                    { $set: { orderStatus: "abandoned", isStockRestored: true } },
                    { new: true }
                );
                if (claimed) {
                    claimedOrders.push(claimed);
                }
            }

            if (claimedOrders.length === 0) return;

            const bulkProductOps = [];
            const claimedIds = [];

            for (const order of claimedOrders) {
                claimedIds.push(order._id);
                for (const item of order.items) {
                    bulkProductOps.push({
                        updateOne: {
                            filter: { _id: item.product },
                            update: { $inc: { stock: item.quantity } }
                        }
                    });
                }

                // Release welcome offer lock if they haven't used it successfully elsewhere
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
            }

            if (bulkProductOps.length > 0) {
                await Product.bulkWrite(bulkProductOps);
            }

            console.log(`[Cron] Marked ${claimedIds.length} Razorpay drafts as abandoned and restored inventory.`);
        } catch (err) {
            console.error("[Cron] Failed to clean up draft orders:", err);
        }
    });
};
