import mongoose from "mongoose";
import dotenv from "dotenv";
import { existsSync } from "fs";
import Order from "./tracker/models.js";
import UserProfile from "./profile/models.js";
import Product from "./products/models.js"; // must be imported to register schema


const envFile = existsSync(".env.production") ? ".env.production" : ".env";
dotenv.config({ path: envFile });

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });

const recovered = await Order.find({
  adminNote: { $regex: /RECOVERED/i }
}).populate("items.product", "name price").lean();

if (recovered.length === 0) {
  console.log("No recovered orders found.");
} else {
  for (const order of recovered) {
    console.log("\n══════════════════════════════════════════════");
    console.log(`🔁 RECOVERED ORDER`);
    console.log(`══════════════════════════════════════════════`);
    console.log(`Order ID        : ${order._id}`);
    console.log(`Razorpay Pay ID : ${order.razorpayPaymentId}`);
    console.log(`Razorpay Ord ID : ${order.razorpayOrderId}`);
    console.log(`Amount Paid     : ₹${order.totalAmount}`);
    console.log(`Payment Status  : ${order.paymentStatus}`);
    console.log(`Order Status    : ${order.orderStatus}`);
    console.log(`Created At      : ${order.createdAt}`);
    console.log(`\n📦 Items:`);
    if (order.items.length === 0) {
      console.log("  ⚠️  No items recovered (cart was empty)");
    } else {
      order.items.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.product?.name || "Unknown"} × ${item.quantity} @ ₹${item.priceAtPurchase}`);
      });
    }
    console.log(`\n📍 Shipping:`);
    console.log(`  Name    : ${order.shippingDetails?.name}`);
    console.log(`  Phone   : ${order.shippingDetails?.phone}`);
    console.log(`  Address : ${order.shippingDetails?.address}`);
    console.log(`  City    : ${order.shippingDetails?.city}`);
    console.log(`  State   : ${order.shippingDetails?.state}`);
    console.log(`  Pincode : ${order.shippingDetails?.pincode}`);
    console.log(`  Email   : ${order.shippingDetails?.email}`);

    // Also show which user this belongs to
    const user = await UserProfile.findById(order.user).lean();
    console.log(`\n👤 Customer:`);
    console.log(`  Name  : ${user?.name}`);
    console.log(`  Email : ${user?.email}`);
    console.log(`  Phone : ${user?.phone || "Not saved"}`);
    console.log(`══════════════════════════════════════════════\n`);
  }
}

await mongoose.disconnect();
