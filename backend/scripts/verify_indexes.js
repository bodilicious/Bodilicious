import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import Product from "../products/models.js";
import Order from "../tracker/models.js";
import UserProfile from "../profile/models.js";
import { CouponUse } from "../coupons/models.js";

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log("✅ Connected to MongoDB.");

    console.log("⏳ Syncing indexes (this may take a moment if building in background)...");
    await Product.syncIndexes();
    await Order.syncIndexes();
    await UserProfile.syncIndexes();
    await CouponUse.syncIndexes();
    console.log("✅ Indexes synced successfully.");

    const dummyUserId = new mongoose.Types.ObjectId();

    console.log("\n============================================");
    console.log("EXPLAIN: Razorpay Order Lookup");
    console.log("============================================");
    const rzpExplain = await Order.find({ razorpayOrderId: "rzp_test_123" }).explain("executionStats");
    const rzpPlan = Array.isArray(rzpExplain) ? rzpExplain[0] : rzpExplain;
    console.log("Query Planner Output Stage:", rzpPlan?.queryPlanner?.winningPlan?.stage);
    console.log("Index Used:", rzpPlan?.queryPlanner?.winningPlan?.inputStage?.indexName || rzpPlan?.queryPlanner?.winningPlan?.inputStage?.inputStage?.indexName || "NONE");
    console.log("Total Docs Examined:", rzpPlan?.executionStats?.totalDocsExamined);

    console.log("\n============================================");
    console.log("EXPLAIN: Get My Orders");
    console.log("============================================");
    const myOrdersExplain = await Order.find({
      user: dummyUserId,
      orderStatus: { $ne: "abandoned" },
      $or: [
        { paymentMethod: { $ne: "razorpay" } },
        { paymentStatus: { $ne: "pending" } }
      ]
    }).sort({ createdAt: -1 }).explain("executionStats");
    
    const myOrdersPlan = Array.isArray(myOrdersExplain) ? myOrdersExplain[0] : myOrdersExplain;
    console.log("Query Planner Output Stage:", myOrdersPlan?.queryPlanner?.winningPlan?.stage);
    console.log("Index Used:", myOrdersPlan?.queryPlanner?.winningPlan?.inputStage?.indexName || myOrdersPlan?.queryPlanner?.winningPlan?.inputStage?.inputStage?.indexName || "NONE");
    console.log("Total Docs Examined:", myOrdersPlan?.executionStats?.totalDocsExamined);
    
    console.log("\n✅ Verification complete.");
  } catch (error) {
    console.error("❌ Verification failed:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

verify();
