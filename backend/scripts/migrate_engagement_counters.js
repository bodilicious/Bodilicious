import mongoose from "mongoose";
import dotenv from "dotenv";
import UserProfile from "../profile/models.js";
import AuditLogV2 from "../audit/models.js";
import UserSession from "../audit/sessionModel.js";

dotenv.config({ path: "../.env" });

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await UserProfile.find({}, "_id").lean();
    console.log(`Found ${users.length} users. Starting migration...`);

    let processedCount = 0;

    for (const user of users) {
      const userId = user._id;

      // 1. Lifetime Sessions
      const sessionCount = await UserSession.countDocuments({ user_id: userId });

      // 2. Engagement from AuditLogV2
      const auditLogs = await AuditLogV2.find({
        user_id: userId,
        event_type: { $in: ["CART_ITEM_ADDED", "CART_ITEM_REMOVED", "PRODUCT_VIEWED"] }
      }).lean();

      const productViewsMap = new Map();
      const cartHistoryMap = new Map();

      for (const log of auditLogs) {
        const type = log.event_type;
        const pidStr = log.metadata?.product_id || log.metadata?.productId || (log.metadata?.product ? log.metadata.product.toString() : null);
        
        if (!pidStr) continue;

        if (type === "PRODUCT_VIEWED") {
          const entry = productViewsMap.get(pidStr) || { count: 0, lastViewedAt: log.timestamp_utc };
          entry.count += 1;
          if (new Date(log.timestamp_utc) > new Date(entry.lastViewedAt)) {
            entry.lastViewedAt = log.timestamp_utc;
          }
          productViewsMap.set(pidStr, entry);
        } else if (type === "CART_ITEM_ADDED" || type === "CART_ITEM_REMOVED") {
          const entry = cartHistoryMap.get(pidStr) || { timesAdded: 0, timesRemoved: 0, lastAddedAt: null, lastRemovedAt: null };
          
          if (type === "CART_ITEM_ADDED") {
            const qtyAdded = log.metadata?.quantity_added || 1;
            entry.timesAdded += qtyAdded;
            if (!entry.lastAddedAt || new Date(log.timestamp_utc) > new Date(entry.lastAddedAt)) {
              entry.lastAddedAt = log.timestamp_utc;
            }
          } else {
            const qtyRemoved = log.metadata?.quantity_removed || 1;
            entry.timesRemoved += qtyRemoved;
            if (!entry.lastRemovedAt || new Date(log.timestamp_utc) > new Date(entry.lastRemovedAt)) {
              entry.lastRemovedAt = log.timestamp_utc;
            }
          }
          cartHistoryMap.set(pidStr, entry);
        }
      }

      // Format arrays
      const productViewCounts = Array.from(productViewsMap.entries()).map(([productId, data]) => ({
        productId,
        count: data.count,
        lastViewedAt: data.lastViewedAt
      }));

      const cartHistory = Array.from(cartHistoryMap.entries()).map(([productId, data]) => ({
        productId,
        timesAdded: data.timesAdded,
        timesRemoved: data.timesRemoved,
        lastAddedAt: data.lastAddedAt,
        lastRemovedAt: data.lastRemovedAt
      }));

      // Update UserProfile
      await UserProfile.updateOne(
        { _id: userId },
        {
          $set: {
            lifetimeSessions: sessionCount,
            productViewCounts: productViewCounts,
            cartHistory: cartHistory
          }
        }
      );

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`Processed ${processedCount}/${users.length} users...`);
      }
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

runMigration();
