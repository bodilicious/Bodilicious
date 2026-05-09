/**
 * Nightly segment computation script.
 * Run directly: node backend/scripts/computeSegments.js
 * Or import and call computeSegmentsForUsers() from a cron scheduler.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import { computeSegmentsForUsers } from "../admin/segmentController.js";

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const count = await computeSegmentsForUsers(null);
    console.log(`✅ Segment compute complete. Updated ${count} users.`);
  } catch (err) {
    console.error("❌ Segment compute failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
};

run();
