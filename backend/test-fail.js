import dotenv from "dotenv";

const testShiprocketFail = async () => {
    dotenv.config();
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;
    const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const { token } = await authRes.json();

    // Simulate invalid phone/address that frontend might send
    const payload = {
        order_id: 'TEST_FAIL_' + Date.now(),
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: 'Home',
        billing_customer_name: 'Test',
        billing_last_name: '',
        billing_address: 'short', // invalid
        billing_city: 'DL',
        billing_pincode: '111', // invalid
        billing_state: 'DL',
        billing_country: 'India',
        billing_email: 'test@example.com',
        billing_phone: '1234', // invalid
        shipping_is_billing: true,
        order_items: [{ name: 'Test', sku: 'TEST', units: 1, selling_price: 100, hsn: '1234' }],
        payment_method: 'Prepaid', sub_total: 100, length: 1, breadth: 1, height: 1, weight: 0.1
    };

    const res = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST', headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
    console.log(res.status, await res.text());
};
testShiprocketFail();
