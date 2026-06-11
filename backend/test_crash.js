import mongoose from "mongoose";
import crypto from "crypto";
import { initRazorpayOrder } from "./payment/controller.js";
import dotenv from "dotenv";
dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const payload = {
            subtotal: 100,
            shippingCost: 0,
            discountAmount: 0,
            finalAmount: 100,
            originalAmount: 100,
            isWelcomeOfferApplied: false,
            expiry: Date.now() + 100000,
            country: "India"
        };
        const signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "fallback_secret")
            .update(JSON.stringify(payload))
            .digest("hex");
        
        const quoteId = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

        const req = {
            body: {
                // We use a valid object ID for product 
                items: [{ productId: "6657662c6488d9c0e2908f5d", quantity: 1, pid: "test" }], 
                shippingDetails: {
                    name: "Jack Test",
                    phone: "+919876543210",
                    address: "123 Test",
                    city: "Test",
                    state: "Test",
                    pincode: "110001",
                    country: "India"
                },
                quoteId
            },
            user: { _id: new mongoose.Types.ObjectId() }
        };

        const res = {
            status: function(code) {
                return {
                    json: function(data) {
                        console.log(`Response ${code}:`, data);
                        return data;
                    }
                }
            }
        };

        console.log("Calling initRazorpayOrder...");
        await initRazorpayOrder(req, res);
        
    } catch (e) {
        console.error("Test crash:", e);
    } finally {
        await mongoose.disconnect();
    }
})();
