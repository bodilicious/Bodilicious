import mongoose from 'mongoose';
import Order from './tracker/models.js';
import UserProfile from './profile/models.js';
import dotenv from 'dotenv';
dotenv.config();

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 3,  dbName: process.env.DB_NAME });
        const user = await UserProfile.findOne({});
        if (!user) {
            console.log('No user found');
            process.exit(0);
        }
        const activeOrdersCount = await Order.countDocuments({
            user: user._id,
            orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
        });
        
        console.log('User:', user.name || user.email);
        console.log('Active Orders Count:', activeOrdersCount);
        console.log('Welcome Offer Eligible:', activeOrdersCount === 0 && !user.welcomeOfferUsed);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

verify();
