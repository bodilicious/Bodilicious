import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { getOrderQuote, initRazorpayOrder, verifyPayment } from './payment/controller.js';
import UserProfile from './profile/models.js';
import Product from './products/models.js';
import Order from './tracker/models.js';
import StoreSettings from './settings/models.js';

dotenv.config();

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
        console.log('Connected to MongoDB for testing...');

        // Find a random user and product
        const user = await UserProfile.findOne();
        const product = await Product.findOne({ stock: { $gt: 0 } });

        if (!user || !product) {
            console.log("Need at least 1 user and 1 product in DB to test.");
            process.exit(1);
        }

        console.log(`\n⏳ Step 1: Getting Quote for User: ${user.name || user._id}...`);
        
        const reqPayload = {
            items: [
                { productId: product._id.toString(), quantity: 1 }
            ],
            shippingDetails: {
                name: "Test User",
                phone: "9999999999",
                address: "123 Test St",
                city: "Test",
                state: "Test",
                pincode: "111111",
                country: "India"
            }
        };

        const mockReq1 = {
            user: { _id: user._id },
            body: reqPayload
        };

        let responseData1 = null;
        const mockRes1 = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { responseData1 = data; return this; }
        };

        await getOrderQuote(mockReq1, mockRes1);
        
        if (!responseData1 || !responseData1.success) {
            console.log(`❌ FAILED! getOrderQuote returned error:`, responseData1);
            process.exit(1);
        }
        console.log(`✅ getOrderQuote Succeeded! Quote ID generated.`);
        const quoteId = responseData1.data.quoteId;

        console.log(`\n⏳ Step 2: Simulating initRazorpayOrder...`);
        const mockReq2 = {
            user: { _id: user._id },
            body: {
                ...reqPayload,
                quoteId
            }
        };

        let responseData2 = null;
        const mockRes2 = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { responseData2 = data; return this; }
        };

        await initRazorpayOrder(mockReq2, mockRes2);

        if (!responseData2 || !responseData2.success) {
            console.log(`❌ FAILED! initRazorpayOrder returned error:`, responseData2);
            process.exit(1);
        }
        
        const razorpayOrderId = responseData2.data.razorpayOrder.id;
        console.log(`✅ initRazorpayOrder Succeeded! Razorpay Order ID: ${razorpayOrderId}`);
        
        // Step 3: Verify Draft Order in DB
        console.log(`\n⏳ Step 3: Verifying Draft Order exists in database...`);
        let draftOrder = await Order.findOne({ razorpayOrderId: razorpayOrderId });
        
        if (!draftOrder) {
            console.log(`❌ FAILED! Draft Order was not created in the DB.`);
            process.exit(1);
        }

        console.log(`✅ Draft Order Found in DB! ID: ${draftOrder._id}`);
        
        // Step 4: Verify Payment (Mocking Razorpay Success)
        console.log(`\n⏳ Step 4: Simulating verifyPayment...`);
        const mockPaymentId = `pay_mock_${Date.now()}`;
        
        const bodyStr = razorpayOrderId + "|" + mockPaymentId;
        const mockSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(bodyStr.toString())
            .digest("hex");

        const mockReq3 = {
            user: { _id: user._id },
            body: {
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: mockPaymentId,
                razorpay_signature: mockSignature
            }
        };

        let responseData3 = null;
        const mockRes3 = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { responseData3 = data; return this; }
        };

        // We should skip shiprocket creation during tests if possible, but let's just see if it runs
        await verifyPayment(mockReq3, mockRes3);

        if (!responseData3 || !responseData3.success) {
            console.log(`❌ FAILED! verifyPayment returned error:`, responseData3);
            process.exit(1);
        }
        
        console.log(`✅ verifyPayment Succeeded! Order marked as paid.`);

        const finalOrder = await Order.findById(draftOrder._id);
        console.log(`\n Final Order Status:`);
        console.log(`   Payment Status: ${finalOrder.paymentStatus}`);
        console.log(`   Order Status: ${finalOrder.orderStatus}`);
        console.log(`   Total Amount: ₹${finalOrder.totalAmount}`);
        console.log(`   Razorpay Payment ID: ${finalOrder.razorpayPaymentId}`);
        
        // Cleanup
        await Order.findByIdAndDelete(finalOrder._id);
        console.log(`\n🧹 Cleaned up test order.`);
        console.log(`\n🎉 ALL TESTS PASSED! The ordering and Razorpay workflow is working perfectly.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

runTest();
