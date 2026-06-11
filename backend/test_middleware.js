import mongoose from "mongoose";
import { createOrderSchema } from "./tracker/schema.js";
import { validate } from "./middleware/validate.js";
import { initRazorpayOrder } from "./payment/controller.js";
import dotenv from "dotenv";
dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const req = {
            body: {
                items: [{ productId: "661234567890123456789012", quantity: 1, pid: "test" }],
                shippingDetails: {
                    name: "Jack Test",
                    phone: "+919876543210",
                    address: "123 Test",
                    city: "Test",
                    state: "Test",
                    pincode: "110001",
                    country: "India" // NOTE: will be stripped!
                },
                quoteId: Buffer.from(JSON.stringify({
                    payload: {
                        subtotal: 100,
                        shippingCost: 0,
                        discountAmount: 0,
                        finalAmount: 100,
                        originalAmount: 100,
                        isWelcomeOfferApplied: false,
                        expiry: Date.now() + 100000,
                        country: "India"
                    },
                    signature: "dummy_signature" // Will fail signature validation
                })).toString('base64')
            },
            user: { _id: "661234567890123456789012" }
        };

        const res = {
            status: (code) => ({
                json: (data) => console.log(`Response ${code}:`, data)
            })
        };

        const next = async () => {
            console.log("Validation passed! Body:", req.body);
            await initRazorpayOrder(req, res);
        };

        validate(createOrderSchema)(req, res, next);
        
    } catch (e) {
        console.error("Test crash:", e);
    } finally {
        mongoose.disconnect();
    }
})();
