import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI + process.env.DB_NAME);
    const Order = (await import('./tracker/models.js')).default;
    const { getShiprocketToken } = await import('./tracker/shiprocketservice.js');

    // Find newest order with a shiprocketOrderId
    const order = await Order.findOne({ shiprocketOrderId: { $ne: null } }).sort({ createdAt: -1 });
    if (!order) {
        console.log('No order found with shiprocketOrderId');
        process.exit(0);
    }

    console.log('Found order:', order._id, 'with shiprocketOrderId:', order.shiprocketOrderId);

    const token = await getShiprocketToken();
    const res = await fetch('https://apiv2.shiprocket.in/v1/external/orders/cancel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids: [order.shiprocketOrderId] })
    });

    console.log('Shiprocket Response Status:', res.status);
    const text = await res.text();
    console.log('Shiprocket Response Body:', text);

    process.exit(0);
};

run().catch(console.error);
