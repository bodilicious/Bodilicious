import cron from "node-cron";
import Order from "../tracker/models.js";
import Product from "../products/models.js";

export const initDraftOrderCleanupCron = () => {
    // Run every 10 minutes (synced with quote lock)
    cron.schedule("*/10 * * * *", async () => {
        try {
            // Quote expiry is 30 minutes, so lock should be 30 minutes.
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            
            const abandonedOrders = await Order.find({
                paymentMethod: "razorpay",
                paymentStatus: "pending",
                orderStatus: { $ne: "abandoned" },
                createdAt: { $lt: thirtyMinutesAgo }
            });

            if (abandonedOrders.length === 0) return;

            const bulkProductOps = [];
            const abandonedIds = [];

            for (const order of abandonedOrders) {
                abandonedIds.push(order._id);
                for (const item of order.items) {
                    bulkProductOps.push({
                        updateOne: {
                            filter: { _id: item.product },
                            update: { $inc: { stock: item.quantity } }
                        }
                    });
                }
            }

            if (bulkProductOps.length > 0) {
                await Product.bulkWrite(bulkProductOps);
            }

            await Order.updateMany(
                { _id: { $in: abandonedIds } },
                { $set: { orderStatus: "abandoned", isStockRestored: true } }
            );

            console.log(`[Cron] Marked ${abandonedIds.length} Razorpay drafts as abandoned and restored inventory.`);
        } catch (err) {
            console.error("[Cron] Failed to clean up draft orders:", err);
        }
    });
};
