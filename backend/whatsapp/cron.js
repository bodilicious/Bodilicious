import cron from "node-cron";
import UserProfile from "../profile/models.js";
import { ProductVelocityView } from "../analytics/models.js";
import Product from "../products/models.js";
import Order from "../tracker/models.js";
import { enqueueWhatsApp } from "./queue.js";
import { getSettings } from "../settings/cache.js";

const BATCH = 200;

// Small sleep helper to spread Redis commands over time instead of bursting
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const initWhatsAppCrons = () => {
  // 1. Stale Cart Cron (10:00 AM daily)
  cron.schedule("0 10 * * *", async () => {
    try {
      const settings = await getSettings();
      if (!settings.waAllEnabled || !settings.waStaleCartEnabled) return;

      console.log("[WhatsApp Cron] Running stale cart trigger...");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const filter = {
        "cart.0": { $exists: true },
        whatsappOptIn: true,
        phone: { $exists: true, $ne: null, $ne: "" },
        $or: [
          { cartUpdatedAt: { $lt: thirtyDaysAgo } },
          { cartUpdatedAt: null }
        ]
      };

      let lastId = null;
      while (true) {
        const currentSettings = await getSettings();
        if (!currentSettings.waAllEnabled || !currentSettings.waStaleCartEnabled) break;

        const currentFilter = lastId ? { ...filter, _id: { $gt: lastId } } : filter;
        const users = await UserProfile.find(currentFilter).sort({ _id: 1 }).limit(BATCH).lean();
        
        if (!users.length) break;
        
        for (const u of users) {
          await enqueueWhatsApp("stale_cart", { userId: u._id.toString() });
        }
        lastId = users[users.length - 1]._id;
      }
    } catch (err) {
      console.error("[WhatsApp Cron] Stale cart error:", err);
    }
  });

  // 2. Re-engagement Cron (11:00 AM daily)
  cron.schedule("0 11 * * *", async () => {
    try {
      const settings = await getSettings();
      if (!settings.waAllEnabled || !settings.waReEngagementEnabled) return;

      console.log("[WhatsApp Cron] Running re-engagement trigger...");
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      // Find users who have ordered in the last 60 days
      const recentOrderUsers = await Order.distinct("user", {
        createdAt: { $gte: sixtyDaysAgo }
      });

      const filter = {
        _id: { $nin: recentOrderUsers },
        whatsappOptIn: true,
        phone: { $exists: true, $ne: null, $ne: "" },
        $or: [
          { lastReEngagementSentAt: null },
          { lastReEngagementSentAt: { $lt: fourteenDaysAgo } }
        ]
      };

      let lastId = null;
      while (true) {
        const currentSettings = await getSettings();
        if (!currentSettings.waAllEnabled || !currentSettings.waReEngagementEnabled) break;

        const currentFilter = lastId ? { ...filter, _id: { $gt: lastId, $nin: recentOrderUsers } } : filter;
        const users = await UserProfile.find(currentFilter).sort({ _id: 1 }).limit(BATCH).lean();
        
        if (!users.length) break;
        
        for (const u of users) {
          await enqueueWhatsApp("reengagement", { userId: u._id.toString() });
        }
        lastId = users[users.length - 1]._id;
      }
    } catch (err) {
      console.error("[WhatsApp Cron] Re-engagement error:", err);
    }
  });

  // 3. Trending Broadcast Cron
  // Calculate peak hour at 00:01 daily, then set a timeout for the actual broadcast
  cron.schedule("1 0 * * *", async () => {
    try {
      console.log("[WhatsApp Cron] Calculating peak hour for trending broadcast...");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const orders = await Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $hour: "$createdAt" },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);

      const peakHour = orders.length > 0 ? orders[0]._id : 14; // default 2 PM
      console.log(`[WhatsApp Cron] Peak hour is ${peakHour}. Scheduling broadcast.`);

      const now = new Date();
      let targetTime = new Date();
      targetTime.setHours(peakHour, 0, 0, 0);

      if (targetTime < now) {
         targetTime.setDate(targetTime.getDate() + 1);
      }
      const delay = targetTime.getTime() - now.getTime();

      setTimeout(async () => {
         console.log("[WhatsApp Cron] Running trending broadcast...");
         
         const settings = await getSettings();
         if (!settings.waAllEnabled || !settings.waTrendingProductsEnabled) return;

         const sevenDaysAgo = new Date();
         sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
         const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

         const topProductsAgg = await ProductVelocityView.aggregate([
           { $match: { date_string: { $gte: sevenDaysStr } } },
           { $group: { _id: "$product_id", totalPurchases: { $sum: "$purchases" } } },
           { $sort: { totalPurchases: -1 } },
           { $limit: 1 }
         ]);
         
         if (!topProductsAgg.length) return;
         const product = await Product.findById(topProductsAgg[0]._id).lean();
         if (!product) return;

         const filter = {
           whatsappOptIn: true,
           phone: { $exists: true, $ne: null, $ne: "" },
         };

         let lastId = null;
         while (true) {
           const currentFilter = lastId ? { ...filter, _id: { $gt: lastId } } : filter;
           const users = await UserProfile.find(currentFilter).sort({ _id: 1 }).limit(BATCH).lean();
           
           if (!users.length) break;

           const currentSettings = await getSettings();
           if (!currentSettings.waAllEnabled || !currentSettings.waTrendingProductsEnabled) break;

           for (const u of users) {
             await enqueueWhatsApp("trending", { userId: u._id.toString(), productId: product._id.toString() });
           }
           lastId = users[users.length - 1]._id;
         }
      }, delay);

    } catch (err) {
      console.error("[WhatsApp Cron] Trending setup error:", err);
    }
  });
};
