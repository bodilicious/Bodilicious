import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import Product, { initProductCollection } from "./products/models.js";
import { initAnalyticsCron } from "./analytics/etl.js";
import { initSupportCleanupCron } from "./support/cleanup.js";
import { shutdownPosthog } from "./utils/posthog.js";
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  try {
    const version = new Date().getTime();
    console.log(`🧹 Cache-busting images with version v=${version}...`);

    const products = await Product.find({});
    let updatedCount = 0;

    for (const product of products) {
      if (!product.images || product.images.length === 0) continue;

      const newImages = product.images.map(img => {
        const baseUrl = img.split('?')[0];
        return `${baseUrl}?v=${version}`;
      });

      product.images = newImages;
      await product.save();
      updatedCount++;
    }

    console.log(`✅ Successfully updated ${updatedCount} products.`);
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
  })
  .then(async () => {
    console.log("MongoDB connected");

    await initProductCollection();
    initAnalyticsCron(); // Start background aggregations
    initSupportCleanupCron(); // Start orphaned Cloudinary upload cleanup

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });
