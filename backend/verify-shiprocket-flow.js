import dotenv from "dotenv";
dotenv.config();

const verifyShiprocketFlow = async () => {
    try {
        const email = process.env.SHIPROCKET_EMAIL;
        const password = process.env.SHIPROCKET_PASSWORD;

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
        console.log("Authentication successful.");

        const payload = {
            order_id: "VERIFY_FLOW_" + Date.now(),
            order_date: new Date().toISOString().split("T")[0],
            pickup_location: "Primary",
            billing_customer_name: "Flow Verify",
            billing_last_name: "Test",
            billing_address: "123 Test Street",
            billing_city: "New Delhi",
            billing_pincode: "110001",
            billing_state: "Delhi",
            billing_country: "India",
            billing_email: "verify@example.com",
            billing_phone: "9876543210",
            shipping_is_billing: true,
            order_items: [
                {
                    name: "Verify Product",
                    sku: "VERIFY-001",
                    units: 1,
                    selling_price: 150,
                    discount: 0,
                    tax: 0,
                    hsn: "33049910"
                }
            ],
            payment_method: "Prepaid",
            sub_total: 150,
            length: 10,
            breadth: 10,
            height: 10,
            weight: 0.5,
        };

        console.log("2. Creating Test Order (Adhoc)...");
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
            console.error("Order Creation Failed:", JSON.stringify(createData, null, 2));
            return;
        }
        console.log(`Order Created! ID: ${shiprocketOrderId}, Shipment ID: ${shipmentId}`);

        console.log("3. Assigning AWB...");
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
            console.log("SUCCESS: AWB Assigned successfully.");
        } else {
            console.warn("AWB assignment may have failed or requires manual action.");
        }

        console.log("4. Cleaning up (Cancelling test order)...");
        const cancelRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ ids: [shiprocketOrderId] })
        });
        console.log("Cancel Response Status:", cancelRes.status);

    } catch (err) {
        console.error("Verification failed:", err);
    }
};

verifyShiprocketFlow();
