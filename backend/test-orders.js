import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './tracker/models.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const allOrders = await Order.find({}).lean();
  console.log('Total orders:', allOrders.length);
  
  const validOrders = await Order.find({ paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' } }).lean();
  console.log('Valid orders:', validOrders.length);
  
  const users = await Order.aggregate([
    { $match: { paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' } } },
    { $group: { _id: '$user', orderCount: { $sum: 1 }, lifetimeSpend: { $sum: '$totalAmount' }, lastOrderAt: { $max: '$createdAt' } } }
  ]);
  
  console.log('Users with valid orders:', users.length);
  console.log(users.slice(0, 10));
  process.exit(0);
}).catch(console.error);
