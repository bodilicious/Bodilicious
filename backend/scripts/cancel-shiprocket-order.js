import dotenv from "dotenv";
dotenv.config();

const cancelOrder = async (orderId) => {
    try {
        const email = process.env.SHIPROCKET_EMAIL;
        const password = process.env.SHIPROCKET_PASSWORD;

        console.log("1. Authenticating...");
        const authRes = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const authData = await authRes.json();
        const token = authData.token;

        console.log(`2. Cancelling order ${orderId}...`);
        const cancelRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ ids: [orderId] })
        });

        const cancelData = await cancelRes.json();
        console.log("Cancel Response:", JSON.stringify(cancelData, null, 2));

        if (cancelRes.ok) {
            console.log("✅ Order cancelled successfully.");
        } else {
            console.error("❌ Cancellation failed.");
        }
    } catch (err) {
        console.error("❌ Error:", err.message);
    }
};

// Cancel the last successful order ID
cancelOrder(1231834630);
