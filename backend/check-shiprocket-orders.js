import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './tracker/models.js';

dotenv.config();

const checkOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI + process.env.DB_NAME);
    console.log('Connected to MongoDB');

    const ordersWithShiprocket = await Order.find({ shiprocketOrderId: { $ne: null } });
    console.log(`Found ${ordersWithShiprocket.length} orders with Shiprocket Order ID`);

    if (ordersWithShiprocket.length > 0, { maxPoolSize: 3,  maxPoolSize: 3 }) {
      console.log('Sample Order:', ordersWithShiprocket[0]._id, 'Status:', ordersWithShiprocket[0].orderStatus);
    }

    const allOrders = await Order.countDocuments();
    console.log(`Total orders in DB: ${allOrders}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

checkOrders();
