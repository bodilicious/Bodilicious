import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initRazorpayOrder } from './payment/controller.js';
import UserProfile from './profile/models.js';
import Product from './products/models.js';
import Order from './tracker/models.js';

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

        console.log(`\n⏳ Step 1: Simulating initRazorpayOrder for User: ${user.name}...`);
        
        const mockReq = {
            user: { _id: user._id },
            body: {
                items: [
                    { productId: product._id.toString(), quantity: 1 }
                ],
                shippingDetails: {
                    name: "Test User",
                    phone: "9999999999",
                    address: "123 Test St",
                    city: "Test",
                    state: "Test",
                    pincode: "111111"
                }
            }
        };

        let responseData = null;
        const mockRes = {
            status: function(code) { 
                this.statusCode = code; 
                return this; 
            },
            json: function(data) { 
                responseData = data; 
                return this; 
            }
        };

        await initRazorpayOrder(mockReq, mockRes);

        console.log(`\nResponse Code: ${mockRes.statusCode}`);
        if (responseData && responseData.success) {
            console.log(`✅ initRazorpayOrder Succeeded! Razorpay Order ID: ${responseData.data.razorpayOrder.id}`);
            
            // Step 2: Verify Draft Order in DB
            console.log(`\n⏳ Step 2: Verifying Draft Order exists in database...`);
            const draftOrder = await Order.findOne({ razorpayOrderId: responseData.data.razorpayOrder.id });
            
            if (draftOrder) {
                console.log(`✅ Draft Order Found in DB! ID: ${draftOrder._id}`);
                console.log(`   Payment Status: ${draftOrder.paymentStatus}`);
                console.log(`   Order Status: ${draftOrder.orderStatus}`);
                console.log(`   Total Amount: ₹${draftOrder.totalAmount}`);
                
                // Cleanup
                await Order.findByIdAndDelete(draftOrder._id);
                console.log(`\n🧹 Cleaned up test draft order.`);
                console.log(`\n🎉 ALL TESTS PASSED! The new draft order flow is working perfectly.`);
            } else {
                console.log(`❌ FAILED! Draft Order was not created in the DB.`);
            }
        } else {
            console.log(`❌ FAILED! initRazorpayOrder returned error:`, responseData);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

runTest();
