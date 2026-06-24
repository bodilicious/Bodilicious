import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { getShiprocketToken } = await import('./tracker/shiprocketservice.js');
  const token = await getShiprocketToken();
  const orderId = '1411559975';
  const detailRes = await fetch(
    `https://apiv2.shiprocket.in/v1/external/orders/show/${orderId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const detailData = await detailRes.json();
  console.log('Shiprocket API Response:', JSON.stringify(detailData.data, null, 2));
}
run().catch(console.error);
