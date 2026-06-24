import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "./tracker/models.js";
import UserProfile from "./profile/models.js";

dotenv.config();

const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await UserProfile.find({});
        for (const user of users) {
            const orders = await Order.find({ user: user._id }).select("orderStatus paymentStatus totalAmount isWelcomeOfferApplied");
            if (orders.length > 0) {
                console.log(`User: ${user.email} (welcomeOfferUsed: ${user.welcomeOfferUsed})`);
                for (const order of orders) {
                    console.log(` - Order ${order._id}: status=${order.orderStatus}, payment=${order.paymentStatus}, welcomeOffer=${order.isWelcomeOfferApplied}`);
                }
                
                const existingOrdersCount = await Order.countDocuments({
                    user: user._id,
                    orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
                    $or: [
                        { paymentMethod: "cod" },
                        { paymentMethod: "razorpay", paymentStatus: { $in: ["paid", "refunded"] } }
                    ]
                });
                console.log(`   -> Calculated existingOrdersCount: ${existingOrdersCount}\n`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
