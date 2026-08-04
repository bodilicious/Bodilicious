import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const getShiprocketToken = async () => {
    const response = await fetch(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD,
        }),
      }
    );
    const data = await response.json();
    return data.token;
};

const testInternationalRate = async () => {
    try {
        const token = await getShiprocketToken();
        console.log("Token received");

        let response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/international/serviceability?pickup_postcode=600081&delivery_country=US&delivery_postcode=10001&weight=0.5&cod=0`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        console.log("Status:", response.status);
        let data = await response.json();
        console.log("Response data:", JSON.stringify(data, null, 2));
    } catch(err) {
        console.error(err);
    }
}

testInternationalRate();
