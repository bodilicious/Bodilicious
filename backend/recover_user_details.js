import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const orderId = "order_SzCNMHaTg3Bol2";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const AuditLog = mongoose.model("AuditLogV2", new mongoose.Schema({}, { strict: false }), "audit_logs_v2");
    const UserProfile = mongoose.model("UserProfile", new mongoose.Schema({}, { strict: false }), "userprofiles");
    
    // Check audit logs for payment initiated
    const logs = await AuditLog.find({ 
      action: { $in: ["payment_initiated", "payment_success_no_order", "payment_captured"] }
    }).sort({ createdAt: -1 }).limit(10).lean();

    console.log(`Found ${logs.length} recent payment-related audit logs.`);
    
    for (const log of logs) {
      console.log(`\n- Action: ${log.action} | Date: ${log.createdAt}`);
      console.log(`  Target ID (Razorpay Order ID): ${log.targetId || (log.metadata && log.metadata.targetId)}`);
      console.log(`  Performed By (User ID): ${log.performedBy}`);
      
      if (log.performedBy) {
         const user = await UserProfile.findById(log.performedBy).lean();
         if (user) {
            console.log(`  -> User: ${user.name} | ${user.email} | ${user.phone}`);
            console.log(`  -> Cart Items: ${user.cart ? user.cart.length : 0}`);
            if (user.addresses && user.addresses.length > 0) {
              console.log(`  -> Latest Address: ${JSON.stringify(user.addresses[0])}`);
            }
         } else {
            console.log(`  -> User not found in DB!`);
         }
      }
    }

    if (userId) {
       console.log(`\nFound User ID: ${userId}`);
       const user = await UserProfile.findById(userId).lean();
       if (user) {
          console.log("User Profile Details:");
          console.log("- Name:", user.name);
          console.log("- Email:", user.email);
          console.log("- Phone:", user.phone);
          console.log("- Cart Items:", user.cart ? user.cart.length : 0);
          console.log("- Saved Addresses:", JSON.stringify(user.addresses || []));
       } else {
          console.log("User profile not found for this ID.");
       }
    } else {
       console.log("Could not determine User ID from audit logs.");
    }

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
