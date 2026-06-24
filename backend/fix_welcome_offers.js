import mongoose from "mongoose";
import dotenv from "dotenv";
import UserProfile from "./profile/models.js";
import Order from "./tracker/models.js";

dotenv.config();

const fixWelcomeOffers = async () => {
    try {
        console.log(`Connecting to MongoDB... Database: ${process.env.DB_NAME}`);
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
        console.log("Connected successfully.");

        // Find all users who have welcomeOfferUsed set to true
        const usersWithOfferUsed = await UserProfile.find({ welcomeOfferUsed: true }).select("_id email");
        console.log(`Found ${usersWithOfferUsed.length} users with welcomeOfferUsed: true`);

        let fixedCount = 0;

        for (const user of usersWithOfferUsed) {
            // Check if they have any order that is NOT cancelled, abandoned, or returned
            const hasValidOrder = await Order.exists({
                user: user._id,
                orderStatus: { $nin: ["abandoned", "cancelled", "returned"] },
                $or: [
                    { paymentMethod: "cod" },
                    { paymentStatus: { $in: ["paid", "refunded"] } }
                ]
            });

            if (!hasValidOrder) {
                console.log(`User ${user.email} (${user._id}) has no valid past orders. Resetting welcomeOfferUsed to false.`);
                await UserProfile.updateOne({ _id: user._id }, { $set: { welcomeOfferUsed: false } });
                fixedCount++;
            }
        }

        console.log(`\nDone! Successfully fixed ${fixedCount} stuck accounts.`);
        process.exit(0);
    } catch (err) {
        console.error("Error fixing welcome offers:", err);
        process.exit(1);
    }
};

fixWelcomeOffers();
