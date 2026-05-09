import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './tracker/models.js';
import { shiprocketWebhook } from './tracker/controller.js';

dotenv.config();

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI + process.env.DB_NAME);
        console.log('Connected to MongoDB for testing...');

        // 1. Create a dummy order
        const dummyShiprocketOrderId = "99999999999" + Date.now();
        const dummyOrder = await Order.create({
            user: new mongoose.Types.ObjectId(), // fake user
            items: [],
            totalAmount: 1000,
            originalAmount: 1000,
            paymentMethod: "cod",
            paymentStatus: "pending",
            orderStatus: "pending", // Initial state
            shippingDetails: {
                name: "Test User",
                address: "123 Test St",
                city: "Test",
                state: "Test",
                pincode: "111111",
                phone: "9999999999"
            },
            shiprocketOrderId: dummyShiprocketOrderId, 
            shipmentId: "88888888888",
            // Note: awb is intentionally null, this what happens in the new flow
        });

        console.log(`\n✅ Step 1: Created Mock Order in DB.`);
        console.log(`   Internal ID: ${dummyOrder._id}`);
        console.log(`   Shiprocket Order ID: ${dummyOrder.shiprocketOrderId}`);
        console.log(`   Current AWB: ${dummyOrder.awb}`);
        console.log(`   Current Status: ${dummyOrder.orderStatus}`);

        // 2. Simulate Webhook
        console.log(`\n⏳ Step 2: Simulating Shiprocket Webhook...`);
        const mockReq = {
            query: { token: process.env.SHIPROCKET_WEBHOOK_TOKEN }, // bypass auth
            headers: {},
            body: {
                awb: "AWB1234567890",
                status: "AWB Assigned",
                current_status: "AWB Assigned",
                order_id: dummyShiprocketOrderId, // The key linkage
                channel_order_id: dummyOrder._id.toString()
            }
        };

        const mockRes = {
            status: function() { return this; },
            json: function() { return this; }
        };

        await shiprocketWebhook(mockReq, mockRes);

        // 3. Verify Database
        console.log(`\n⏳ Step 3: Verifying Database Updates...`);
        const updatedOrder = await Order.findById(dummyOrder._id);

        console.log(`   Updated AWB: ${updatedOrder.awb}`);
        console.log(`   Updated Status: ${updatedOrder.orderStatus}`);

        if (updatedOrder.awb === "AWB1234567890" && updatedOrder.orderStatus === "processing") {
            console.log(`\n🎉 TEST PASSED! The webhook perfectly found the order and attached the AWB.`);
        } else {
            console.log(`\n❌ TEST FAILED! The webhook did not update the order as expected.`);
        }

        // Cleanup
        await Order.findByIdAndDelete(dummyOrder._id);
        console.log(`\n🧹 Cleaned up mock order.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

runTest();
