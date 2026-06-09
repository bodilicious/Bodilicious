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
import { runSettingsMigration } from "./settings/migration.js";
import { flushBuffer as flushAuditBuffer } from "./audit/logger.js";

const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  try {
    const version = new Date().getTime();
    console.log(`🧹 Cache-busting images with version v=${version}...`);

    const cursor = Product.find({ images: { $exists: true, $not: { $size: 0 } } }).cursor();
    const bulkOps = [];
    let updatedCount = 0;

    for await (const product of cursor) {
      const newImages = product.images.map(img => {
        const baseUrl = img.split('?')[0];
        return `${baseUrl}?v=${version}`;
      });

      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { images: newImages } }
        }
      });

      updatedCount++;

      if (bulkOps.length === 500) {
        await Product.bulkWrite(bulkOps);
        bulkOps.length = 0;
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    console.log(`✅ Successfully updated ${updatedCount} products.`);
    await shutdownPosthog();
    await flushAuditBuffer();
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
    maxPoolSize: 20, // Strict limit for M0 free tier
  })
  .then(async () => {
    console.log("MongoDB connected");

    await runSettingsMigration();
    await initProductCollection();
    initAnalyticsCron(); // Start background aggregations
    initSupportCleanupCron(); // Start orphaned Cloudinary upload cleanup
    startWhatsAppWorker(); // Start BullMQ worker for WhatsApp jobs
    initWhatsAppCrons(); // Start WhatsApp scheduled tasks
    initPaymentReconciliationCron(); // Recover payments captured but never verified

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });
