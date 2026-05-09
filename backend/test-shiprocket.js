import dotenv from "dotenv";
dotenv.config();

const testShiprocketOrder = async () => {
    try {
        const email = process.env.SHIPROCKET_EMAIL;
        const password = process.env.SHIPROCKET_PASSWORD;

        if (!email || !password) {
            console.error("Missing Shiprocket credentials in .env");
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
        console.log("Authentication successful.");

        const payload = {
            order_id: "TEST_ORDER_" + Date.now(),
            order_date: new Date().toISOString().split("T")[0],
            pickup_location: "Home",
            billing_customer_name: "Test User",
            billing_last_name: "",
            billing_address: "123 Test Street",
            billing_city: "New Delhi",
            billing_pincode: "110001",
            billing_state: "Delhi",
            billing_country: "India",
            billing_email: "test@example.com",
            billing_phone: "9876543210",
            shipping_is_billing: true,
            order_items: [
                {
                    name: "Test Product 1",
                    sku: "TEST-001",
                    units: 1,
                    selling_price: 100,
                    discount: 0,
                    tax: 0,
                    hsn: "33049910"
                },
                {
                    name: "Test Product 2",
                    sku: "TEST-002",
                    units: 2,
                    selling_price: 150,
                    discount: 0,
                    tax: 0,
                    hsn: "33049910"
                }
            ],
            payment_method: "Prepaid",
            sub_total: 400,
            length: 10,
            breadth: 10,
            height: 10,
            weight: 0.5,
        };

        console.log("2. Creating Adhoc Order...");
        const createRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const createText = await createRes.text();
        console.log("Create Order Response Status:", createRes.status);
        console.log("Create Order Response Body:", createText);

        const data = JSON.parse(createText);
        const shipmentId = data.shipment_id;

        if (shipmentId) {
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

            console.log("AWB Response Status:", awbRes.status);
            console.log("AWB Response Body:", await awbRes.text());
        }

    } catch (err) {
        console.error("Test failed:", err);
    }
};

testShiprocketOrder();
