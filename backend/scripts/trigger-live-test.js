import dotenv from "dotenv";
import { sendOrderConfirmationEmail } from "../email/emailService.js";
dotenv.config();

const triggerLiveTest = async () => {
    const targetEmail = "jacksonrajhehe@gmail.com";
    const targetName = "Jackson (Live Test)";
    const targetPhone = "8248372395"; // 10 digit Indian number

    try {
        const email = process.env.SHIPROCKET_EMAIL;
        const password = process.env.SHIPROCKET_PASSWORD;

        if (!email || !password) {
            console.error("❌ ERROR: Shiprocket credentials missing in .env");
            return;
        }

        console.log("1. Authenticating with Shiprocket...");
        const authRes = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (!authRes.ok) {
            console.error("Auth Failed:", await authRes.text());
            return;
        }
        const authData = await authRes.json();
        const token = authData.token;
        console.log("✅ Authentication successful.");

        const payload = {
            order_id: "LIVE_TEST_" + Date.now(),
            order_date: new Date().toISOString().split("T")[0],
            pickup_location: "Primary",
            billing_customer_name: "Jackson",
            billing_last_name: "Test",
            billing_address: "123 Test Street",
            billing_city: "Chennai",
            billing_pincode: "600001",
            billing_state: "Tamil Nadu",
            billing_country: "India",
            billing_email: targetEmail,
            billing_phone: targetPhone,
            shipping_is_billing: true,
            order_items: [
                {
                    name: "Bodilicious Test Product",
                    sku: "TEST-LIVE-001",
                    units: 1,
                    selling_price: 1, // Minimum price
                    discount: 0,
                    tax: 0,
                    hsn: "33049910"
                }
            ],
            payment_method: "Prepaid",
            sub_total: 1,
            length: 10,
            breadth: 10,
            height: 10,
            weight: 0.5,
        };

        console.log(`2. Creating Live Test Order for ${targetEmail} / ${targetPhone}...`);
        const createRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const createData = await createRes.json();
        const shipmentId = createData.shipment_id;
        const shiprocketOrderId = createData.order_id;

        if (!shipmentId) {
            console.error("❌ Order Creation Failed:", JSON.stringify(createData, null, 2));
            return;
        }
        console.log(`✅ Order Created! ID: ${shiprocketOrderId}, Shipment ID: ${shipmentId}`);

        console.log("3. Assigning AWB (This usually triggers the notification)...");
        const awbRes = await fetch(
            "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ shipment_id: shipmentId }),
            }
        );

        const awbData = await awbRes.json();
        console.log("AWB Response:", JSON.stringify(awbData, null, 2));

        if (awbData.status_code === 200 || awbData.awb_assign_status === 1) {
            console.log("✅ SUCCESS: AWB Assigned. Notifications should be triggered.");
        } else {
            console.warn("⚠️ AWB assignment returned non-200. Check Shiprocket dashboard.");
        }

        console.log("4. Triggering Order Confirmation Email via emailService...");
        // Mock order object for email service
        const mockOrderForEmail = {
            _id: shiprocketOrderId,
            createdAt: new Date(),
            paymentMethod: "Prepaid",
            totalAmount: 1,
            shippingDetails: {
                name: targetName,
                address: "123 Test Street",
                city: "Chennai",
                state: "Tamil Nadu",
                pincode: "600001",
                phone: targetPhone
            },
            items: [
                {
                    product: { name: "Bodilicious Test Product" },
                    quantity: 1,
                    priceAtPurchase: 1
                }
            ]
        };

        try {
            await sendOrderConfirmationEmail(mockOrderForEmail, targetEmail, targetName);
            console.log("✅ Confirmation email sent via emailService.");
        } catch (emailErr) {
            console.error("❌ Email service failure:", emailErr.message);
        }

        console.log("\n--- TEST COMPLETE ---");
        console.log("Please check your email and SMS.");
        console.log("Note: This test order will remain in your Shiprocket dashboard as a 'Ready to Ship' order.");

    } catch (err) {
        console.error("❌ Execution failed:", err);
    }
};

triggerLiveTest();
