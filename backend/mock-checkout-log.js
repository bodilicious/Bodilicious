import mongoose from 'mongoose';
import Product from './products/models.js';
import UserProfile from './profile/models.js';
import { createOrder } from './tracker/controller.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || 'test' });
        let user = await UserProfile.findOne();
        if (!user) {
            user = { _id: new mongoose.Types.ObjectId() };
        }

        const products = await Product.find().limit(2);

        if (products.length < 2) {
            console.error("Need at least 2 products in DB");
            process.exit(1);
        }

        console.log("User found:", user ? "Yes" : "No");

        const req = {
            user: { _id: user._id },
            body: {
                items: [
                    { productId: products[0]._id, quantity: 1 }
                ],
                shippingDetails: {
                    name: "Test User",
                    phone: "9876543210",
                    address: "123 Test Street",
                    city: "New Delhi",
                    state: "Delhi",
                    pincode: "110001",
                    email: "test@example.com"
                }
            }
        };

        const res = {
            status: (code) => {
                console.log("Status Code:", code);
                return {
                    json: (data) => console.log("Response:", JSON.stringify(data, null, 2))
                };
            }
        };

        console.log("Calling createOrder...");
        await createOrder(req, res);
        console.log("Checkout complete.");
        process.exit(0);

    } catch (err) {
        console.error("Test failed with error:", err.message);
        console.error(err);
        process.exit(1);
    }
};

run();
