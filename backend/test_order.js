import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "./tracker/models.js";
import UserProfile from "./profile/models.js";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const orders = await Order.find().sort({ createdAt: -1 }).limit(5);
    console.log("Recent 5 Orders:");
    orders.forEach(o => {
      console.log(`ID: ${o._id}, User: ${o.user}, Amount: ${o.totalAmount}, Status: ${o.orderStatus}, Created: ${o.createdAt}`);
    });
    const users = await UserProfile.find().sort({ createdAt: -1 }).limit(1);
    console.log("Recent User:");
    if(users.length > 0) {
      console.log(`User: ${users[0].email}, Orders: ${users[0].orders.length}`);
    }
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error(err);
  });
