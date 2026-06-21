import mongoose from "mongoose";
import dotenv from "dotenv";
import { initRazorpayOrder, processPaidOrder } from "../backend/payment/controller.js";
import { createOrder } from "../backend/tracker/controller.js";
import UserProfile from "../backend/profile/models.js";
import Product from "../backend/products/models.js";
import Order from "../backend/tracker/models.js";
import * as emailService from "../backend/email/emailService.js";

dotenv.config({ path: "../backend/.env" });

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
};

const runTests = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for testing.");

    // Setup Test Data
    const testUser = await UserProfile.create({
        firebaseUID: "TEST_USER_" + Date.now(),
        name: "Test User",
        email: "test" + Date.now() + "@example.com",
        welcomeOfferUsed: false,
    });
    
    const testProduct = await Product.create({
        name: "Test Product",
        price: 1000,
        stock: 1,
        pid: "TEST_PROD_" + Date.now(),
        isDraft: false,
    });

    try {
        console.log("\n--- TEST 1: Welcome Offer Race ---");
        // Create 2 concurrent Razorpay init requests
        const req1 = {
            user: { _id: testUser._id },
            body: {
                items: [{ productId: testProduct._id, quantity: 1 }],
                shippingDetails: { address: "123 Test St", pincode: "123456", country: "India" },
                marketing: {},
                payload: { isWelcomeOfferApplied: true, country: "India", quoteId: "test_quote" }
            }
        };
        const req2 = JSON.parse(JSON.stringify(req1)); // clone
        req2.user = req1.user; // keep object id

        const crypto = await import("crypto");
        const generateMockQuote = (items, isWelcomeOfferApplied) => {
            const secret = process.env.QUOTE_SECRET || "fallback_secret_for_tests";
            const payload = JSON.stringify({ items, isWelcomeOfferApplied, country: "India", ts: Date.now() });
            const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
            return Buffer.from(JSON.stringify({ p: payload, h: hmac })).toString("base64");
        };
        
        req1.body.payload.quoteId = generateMockQuote([{ productId: testProduct._id.toString(), quantity: 1 }], true);
        req2.body.payload.quoteId = req1.body.payload.quoteId;

        const res1 = mockRes();
        const res2 = mockRes();

        // Run concurrently
        await Promise.all([
            initRazorpayOrder(req1, res1).catch(e => ({ error: e.message })),
            initRazorpayOrder(req2, res2).catch(e => ({ error: e.message }))
        ]);

        const statuses = [res1.statusCode, res2.statusCode];
        console.log("Responses:", statuses);
        
        if (statuses.includes(201) && statuses.includes(400)) {
            console.log("✅ TEST 1 PASSED: Exactly one request succeeded, the other was rejected.");
        } else {
            console.error("❌ TEST 1 FAILED: Unexpected statuses.");
        }

        console.log("\n--- TEST 2: COD Oversell Race ---");
        // Reset stock to 1
        await Product.updateOne({ _id: testProduct._id }, { $set: { stock: 1 } });
        
        const req3 = {
            user: { _id: testUser._id },
            body: {
                items: [{ productId: testProduct._id, quantity: 1 }],
                shippingDetails: { address: "123 Test St", pincode: "123456", country: "India" },
                paymentMethod: "cod"
            }
        };
        const req4 = JSON.parse(JSON.stringify(req3));
        req4.user = req3.user;

        const res3 = mockRes();
        const res4 = mockRes();

        await Promise.all([
            createOrder(req3, res3).catch(e => { res3.statusCode = 400; res3.body = { message: e.message }; }),
            createOrder(req4, res4).catch(e => { res4.statusCode = 400; res4.body = { message: e.message }; })
        ]);

        const prodAfter = await Product.findById(testProduct._id);
        console.log(`Final stock: ${prodAfter.stock}`);
        const successCount = [res3.statusCode, res4.statusCode].filter(c => c === 201 || c === 200).length;
        console.log("Responses:", [res3.statusCode, res4.statusCode]);
        
        if (successCount === 1 && prodAfter.stock === 0) {
            console.log("✅ TEST 2 PASSED: Exactly one order succeeded, stock is 0 (not -1).");
        } else {
            console.error("❌ TEST 2 FAILED: Oversell occurred or neither succeeded.");
        }

        console.log("\n--- TEST 3: Idempotency & Revert Fault Injection ---");
        // Create a pending order
        const pendingOrder = await Order.create({
            user: testUser._id,
            items: [{ product: testProduct._id, quantity: 1, priceAtPurchase: 1000 }],
            totalAmount: 1000,
            paymentMethod: "razorpay",
            paymentStatus: "pending",
            orderStatus: "pending",
            isStockRestored: false
        });

        // Mock emailService to throw error to simulate mid-transaction failure
        const originalSend = emailService.sendOrderConfirmationEmail;
        emailService.sendOrderConfirmationEmail = async () => { throw new Error("Injected mid-transaction fault!"); };

        try {
            await processPaidOrder(pendingOrder._id.toString(), "pay_mock123", { source: "test" });
        } catch (err) {
            console.log("Caught expected fault:", err.message);
        }

        // Restore mock
        emailService.sendOrderConfirmationEmail = originalSend;

        const orderAfterFault = await Order.findById(pendingOrder._id);
        console.log(`Payment Status after fault: ${orderAfterFault.paymentStatus}`);
        console.log(`lastClaimFailedAt populated: ${!!orderAfterFault.lastClaimFailedAt}`);
        
        if (orderAfterFault.paymentStatus === "pending" && orderAfterFault.lastClaimFailedAt) {
            console.log("✅ TEST 3 PASSED: Order safely reverted to pending with lastClaimFailedAt set.");
        } else {
            console.error("❌ TEST 3 FAILED: Order stuck in paid or claim not reverted.");
        }

    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        // Cleanup
        await UserProfile.deleteOne({ _id: testUser._id });
        await Product.deleteOne({ _id: testProduct._id });
        await Order.deleteMany({ user: testUser._id });
        await mongoose.disconnect();
        console.log("\nDone.");
    }
};

runTests();
