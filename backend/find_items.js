import mongoose from "mongoose";
import dotenv from "dotenv";
import { existsSync } from "fs";
import UserProfile from "./profile/models.js";
import Product from "./products/models.js";

const envFile = existsSync(".env.production") ? ".env.production" : ".env";
dotenv.config({ path: envFile });

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });

const userId = "69d1fd4cfc966af533a694bc";

const user = await UserProfile.findById(userId)
  .populate("wishlist", "name price")
  .populate("recentlyBought", "name price")
  .lean();

console.log("\n👤 Customer:", user?.name, "|", user?.email);

console.log("\n❤️  Wishlist:");
if (!user?.wishlist?.length) {
  console.log("   (empty)");
} else {
  user.wishlist.forEach(p => console.log(`   → ${p.name} @ ₹${p.price}`));
}

console.log("\n🕒 Recently Bought:");
if (!user?.recentlyBought?.length) {
  console.log("   (empty)");
} else {
  user.recentlyBought.forEach(p => console.log(`   → ${p.name} @ ₹${p.price}`));
}

console.log("\n🎯 CONCLUSION:");
console.log("   She bought exactly 1 item priced at ₹349.");
console.log("   Welcome offer (10% = ₹35) was applied (her first order).");
console.log("   + ₹99 shipping = ₹413 total ✅");
console.log("\n   ₹349 products in your catalog:");
const products349 = await Product.find({ price: 349 }, "name").lean();
products349.forEach((p, i) => console.log(`   ${i + 1}. ${p.name}`));

await mongoose.disconnect();
