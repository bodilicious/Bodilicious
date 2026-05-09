import mongoose from "mongoose";
import { pushOrderToShiprocket } from "../tracker/shiprocketservice.js";
import dotenv from "dotenv";

dotenv.config();

// Ensure env vars are set for the test
process.env.SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || "test@example.com";
process.env.SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || "test_password";

// Global fetch mock to inspect the payload
const originalFetch = global.fetch;
let lastPayload = null;

global.fetch = async (url, options) => {
    if (url.includes("/orders/create/adhoc")) {
        lastPayload = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({ shipment_id: 12345, order_id: 67890 })
        };
    }
    if (url.includes("/auth/login")) {
        return {
            ok: true,
            json: async () => ({ token: "mock_token" })
        };
    }
    return { ok: true, json: async () => ({}) };
};

const runTest = async () => {
    console.log("Starting Shiprocket Payload Verification...");

    const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        totalAmount: 1250,
        paymentMethod: "cod",
        shippingDetails: {
            name: "John Doe",
            phone: "9123456789",
            address: "123 Green Street",
            city: "Chennai",
            state: "Tamil Nadu",
            pincode: "600001",
            email: "john@example.com"
        },
        items: [
            {
                product: {
                    _id: new mongoose.Types.ObjectId(),
                    name: "Aloe Vera Gel",
                    pid: "AV-001",
                    price: 600,
                    product_weight_g: 250
                },
                quantity: 2,
                priceAtPurchase: 600
            }
        ]
    };

    try {
        await pushOrderToShiprocket(mockOrder);

        if (lastPayload) {
            console.log("Payload captured successfully!");
            console.log("Order ID:", lastPayload.order_id);
            console.log("Items:", JSON.stringify(lastPayload.order_items, null, 2));
            console.log("Total Weight:", lastPayload.weight);
            console.log("Sub Total:", lastPayload.sub_total);

            // Assertions
            const item = lastPayload.order_items[0];
            if (item.name === "Aloe Vera Gel" && item.sku === "AV-001" && lastPayload.weight === 0.5) {
                console.log("✅ VERIFICATION SUCCESS: Product name, SKU, and weight are correct.");
            } else {
                console.error("❌ VERIFICATION FAILED: Payload data mismatch.");
                console.log("Expected: Aloe Vera Gel, AV-001, 0.5");
                console.log(`Actual: ${item.name}, ${item.sku}, ${lastPayload.weight}`);
            }
        } else {
            console.error("❌ VERIFICATION FAILED: No payload captured.");
        }
    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        global.fetch = originalFetch;
        process.exit();
    }
};

runTest();
