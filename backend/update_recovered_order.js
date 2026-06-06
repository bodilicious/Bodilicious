import mongoose from "mongoose";
import dotenv from "dotenv";
import { existsSync } from "fs";
import Order from "./tracker/models.js";
import Product from "./products/models.js";

const envFile = existsSync(".env.production") ? ".env.production" : ".env";
dotenv.config({ path: envFile });

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 3,  dbName: process.env.DB_NAME });

  const orderId = "69d3c0d0178e8365106cce79";
  
  // 1. Find the physical sunscreen product
  const product = await Product.findOne({ name: { $regex: /Physical Sunscreen with SPF 50/i } });
  if (!product) {
    console.error("❌ Physical Sunscreen product not found in the DB.");
    process.exit(1);
  }

  console.log(`Found Product: ${product.name} (Price: ₹${product.price})`);

  // 2. Load the order
  const order = await Order.findById(orderId);
  if (!order) {
    console.error("❌ Order not found.");
    process.exit(1);
  }

  // 3. Update the order items
  order.items = [{
    product: product._id,
    quantity: 1,
    priceAtPurchase: product.price
  }];

  // 4. Update the admin note to show it was resolved
  order.adminNote = order.adminNote + "\n✅ [UPDATED BY SCRIPT]: Confirmed with customer, added Physical Sunscreen to items.";

  // 5. Save the order
  await order.save();
  console.log(`✅ Order ${orderId} updated successfully with 1x ${product.name}.`);

  // 6. Deduct stock from the product
  product.stock -= 1;
  await product.save();
  console.log(`✅ Deducted 1 from stock. New stock: ${product.stock}.`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
