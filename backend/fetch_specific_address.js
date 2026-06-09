import mongoose from "mongoose";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import { existsSync } from "fs";

const envFile = existsSync(".env.production") ? ".env.production" : ".env";
dotenv.config({ path: envFile });

const orderId = "order_SzCNMHaTg3Bol2";

async function run() {
  let rzpOrder;
  let rzpPayments;
  
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    console.log(`Fetching Razorpay Order: ${orderId}...`);
    rzpOrder = await razorpay.orders.fetch(orderId);
    console.log("Razorpay Order Data:", JSON.stringify(rzpOrder, null, 2));
    
    console.log(`\nFetching Payments for Order: ${orderId}...`);
    rzpPayments = await razorpay.orders.fetchPayments(orderId);
    console.log("Payments Data:", JSON.stringify(rzpPayments, null, 2));

  } catch (err) {
    console.error("Error fetching from Razorpay:", err.message);
    return;
  }

  const userId = rzpOrder.notes?.userId;
  if (!userId) {
    console.log("\nNo userId found in Razorpay order notes.");
    return;
  }

  try {
    console.log(`\nConnecting to DB to find User: ${userId}...`);
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    
    const UserProfile = mongoose.model("UserProfile", new mongoose.Schema({}, { strict: false }), "userprofiles");
    const user = await UserProfile.findById(userId).lean();
    
    if (user) {
      console.log("\n=== USER FOUND ===");
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Phone: ${user.phone}`);
      if (user.addresses && user.addresses.length > 0) {
        console.log("\nSaved Addresses:");
        user.addresses.forEach((addr, i) => {
          console.log(`[${i+1}] ${addr.houseNumber || ''} ${addr.addressLine}, ${addr.city}, ${addr.state} - ${addr.pincode} (Phone: ${addr.phone})`);
        });
      } else {
        console.log("No saved addresses found for this user.");
      }
    } else {
      console.log("User ID not found in database.");
    }
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    mongoose.disconnect();
  }
}

run();
