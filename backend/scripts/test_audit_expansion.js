import mongoose from "mongoose";
import dotenv from "dotenv";
import UserProfile from "../profile/models.js";
import AuditLog from "../admin/models.js";
import Order from "../tracker/models.js";
import { logAction } from "../admin/controller.js";

// Load env vars
dotenv.config();

async function runTest() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/bodilicious";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const testUserId = new mongoose.Types.ObjectId();
    const testOrderId = new mongoose.Types.ObjectId();
    const mockReq = { 
      ip: "127.0.0.1",
      headers: {},
      connection: { remoteAddress: "127.0.0.1" }
    };

    console.log("\n🚀 Triggering Test Events...");

    // 1. New Customer
    console.log("--- Logging new_customer");
    await logAction(mockReq, "new_customer", "user", testUserId.toString(), {
      email: "test_audit@example.com",
      name: "Audit Test User"
    }, { source: "system", userId: testUserId });

    // 2. Order Placed
    console.log("--- Logging order_placed");
    await logAction(mockReq, "order_placed", "order", testOrderId.toString(), {
      total: 1499,
      itemCount: 3,
      paymentMethod: "cod"
    }, { source: "customer", userId: testUserId });

    // 3. Order Cancelled
    console.log("--- Logging order_cancelled");
    await logAction(mockReq, "order_cancelled", "order", testOrderId.toString(), {
      reason: "Unit test cancellation"
    }, { source: "customer", userId: testUserId });

    // 4. Refund Confirmed
    console.log("--- Logging refund_confirmed");
    await logAction(mockReq, "refund_confirmed", "order", testOrderId.toString(), {
      refundId: "rfnd_test_12345",
      amount: 1499
    }, { source: "system" });

    console.log("\n🧐 Verifying Database Entries...");

    const actions = ["new_customer", "order_placed", "order_cancelled", "refund_confirmed"];
    const logs = await AuditLog.find({ action: { $in: actions } })
      .sort({ createdAt: -1 })
      .limit(4);

    if (logs.length === 4) {
      console.log("✅ Successfully verified 4/4 new event types in AuditLog");
    } else {
      console.warn(`⚠️ Only found ${logs.length}/4 events. Check if action names match.`);
    }

    logs.forEach(log => {
      const actor = log.admin ? "Admin" : (log.user ? "Customer" : "System");
      console.log(`[${log.action.toUpperCase()}] Source: ${log.meta.source} | Actor: ${actor} | IP: ${log.ip}`);
    });

    // Cleanup
    console.log("\n🧹 Cleaning up test logs...");
    await AuditLog.deleteMany({ action: { $in: actions } });
    console.log("✅ Cleanup complete");

    process.exit(0);
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  }
}

runTest();
