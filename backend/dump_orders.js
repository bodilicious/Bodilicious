import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "./tracker/models.js";

dotenv.config();

const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const orders = await Order.find({}).lean();
        console.log(`Found ${orders.length} total orders in the database.`);
        for (const order of orders) {
            console.log(`Order ${order._id}: user=${order.user}, status=${order.orderStatus}, payment=${order.paymentStatus}, welcomeOffer=${order.isWelcomeOfferApplied}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
