import mongoose from "mongoose";
import dotenv from "dotenv";
import { runETL } from "../analytics/etl.js";
import { DailySalesView, ProductVelocityView, CustomerCohortView } from "../analytics/models.js";

dotenv.config();

async function verifyETL() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 3,  dbName: process.env.DB_NAME });

    console.log("Running Analytics ETL Job...");
    await runETL();

    console.log("\n--- Verification Results ---");

    const sales = await DailySalesView.find().sort({ date_string: -1 }).limit(1);
    console.log("Latest Daily Sales:", sales.length ? sales[0] : "None");

    const velocity = await ProductVelocityView.find().sort({ purchases: -1 }).limit(1);
    console.log("Top Product Velocity:", velocity.length ? velocity[0] : "None");

    const cohorts = await CustomerCohortView.find().sort({ cohort_month: -1, month_index: 1 }).limit(1);
    console.log("Latest Cohort Data:", cohorts.length ? cohorts[0] : "None");

  } catch (err) {
    console.error("ETL Verification failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

verifyETL();
