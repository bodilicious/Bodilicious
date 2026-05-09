import mongoose from "mongoose";
import dotenv from "dotenv";
import UserProfile from "../profile/models.js";
import Order from "../tracker/models.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  console.log("Connected to MongoDB.");
  
  const users = await UserProfile.find({ email: /test_welcome/ }).lean();
  console.log("Found Test Users:", users.length);
  for (let u of users) {
    const activeOrdersCount = await Order.countDocuments({
      user: u._id,
      orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
    });
    console.log(`User: ${u.email}`);
    console.log(` - ID: ${u._id}`);
    console.log(` - Orders Array Length: ${u.orders?.length}`);
    console.log(` - Active Orders Count in Tracker: ${activeOrdersCount}`);
    console.log(` - isEligible: ${activeOrdersCount === 0}`);
  }
  process.exit(0);
}

run().catch(console.error);
