import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import Product, { initProductCollection } from "./products/models.js";
import { initAnalyticsCron } from "./analytics/etl.js";
import { initSupportCleanupCron } from "./support/cleanup.js";
import { shutdownPosthog } from "./utils/posthog.js";
import { startWhatsAppWorker } from "./whatsapp/worker.js";
import { initWhatsAppCrons } from "./whatsapp/cron.js";
import { initPaymentReconciliationCron } from "./payment/reconciliation.js";
import { initExchangeRateCron } from "./cron/exchangeRates.js";
import { initDraftOrderCleanupCron } from "./cron/draftOrders.js";
import { runSettingsMigration } from "./settings/migration.js";
import { initAuditWorker } from "./audit/worker.js";
import { getSettings } from "./settings/cache.js";

import Order from "./tracker/models.js";
import NotificationService from "./procurement/notificationService.js";

const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  try {
    await shutdownPosthog();

    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME,
    maxPoolSize: 50, // Safe limit for M0 (500 max) when running separate web/worker dynos
  })
  .then(async () => {
    console.log("MongoDB connected");

    await runSettingsMigration();
    await initProductCollection();
    initAnalyticsCron(); // Start background aggregations
    initSupportCleanupCron(); // Start orphaned Cloudinary upload cleanup
    
    // Since this is a free tier and we only have one process, we MUST run 
    // the background workers inside the main Express web server process.
    console.log("Starting background workers in main process (Free Tier Setup)...");

    // Only start WhatsApp worker + crons if WhatsApp is enabled in settings.
    // BullMQ workers generate ~1,000+ idle Redis commands/day just by existing
    // (BLPOP polling + stalled-job checks). Skip entirely when not in use.
    const settings = await getSettings();
    if (settings.waAllEnabled) {
      startWhatsAppWorker();
      initWhatsAppCrons();
      console.log("[WhatsApp] Worker and crons started (waAllEnabled=true)");
    } else {
      console.log("[WhatsApp] Worker skipped — waAllEnabled is false. No Redis connections opened for WhatsApp.");
    }

    initAuditWorker();
    initPaymentReconciliationCron(); // Recover payments captured but never verified
    initExchangeRateCron(); // Fetch exchange rates periodically
    initDraftOrderCleanupCron(); // Delete abandoned draft orders

    // ── Startup: alert on stuck manual-review orders ─────────────────────────
    // Orders with needsManualReview: true have captured money but were never
    // fully processed (all 3 verify retries + webhook both failed). Fire one
    // notification per stuck order so ops can action them immediately after a
    // server restart instead of finding them hours later via manual DB query.
    // Runs after 5 seconds to avoid racing the payment reconciliation warmup.
    setTimeout(async () => {
      try {
        const stuckOrders = await Order.find({ needsManualReview: true })
          .select("_id totalAmount currency razorpayPaymentId reviewReason createdAt")
          .lean();

        if (stuckOrders.length > 0) {
          console.warn(`[Startup] ⚠️  ${stuckOrders.length} order(s) need manual review.`);
          for (const o of stuckOrders) {
            await NotificationService.emit({
              title: `⚠️ Manual Review Required — Order ${o._id.toString().slice(-6).toUpperCase()}`,
              body: `Order ${o._id} (${o.currency} ${o.totalAmount}) was paid (payment: ${o.razorpayPaymentId || "unknown"}) but was never fully processed. Reason: ${o.reviewReason || "unknown"}. Created: ${new Date(o.createdAt).toISOString()}`,
              type: "critical",
              sourceModule: "orders",
              sourceModel: "Order",
              sourceId: o._id.toString()
            }).catch(e => console.error("[Startup] Failed to emit manual review alert:", e.message));
          }
        }
      } catch (err) {
        console.error("[Startup] Failed to check needsManualReview orders:", err.message);
      }
    }, 5_000); // 5 seconds — after DB is warm, before the 15s reconciliation run

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });
