import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

(async () => {
    try {
        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: 100 * 100, // paise
            currency: "INR",
            receipt: `rp_${Date.now()}`,
            notes: {
                userId: "123456",
                itemCount: 1, // NUMBER!
            },
        });
        console.log("Success!", razorpayOrder.id);
    } catch (e) {
        console.error("Razorpay Error:", e.message || e.error || e);
    }
})();
