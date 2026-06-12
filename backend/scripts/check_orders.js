import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import Order from '../tracker/models.js';

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bodilicious')
  .then(async () => {
    try {
      const count = await Order.countDocuments();
      console.log('Total Orders:', count);
      const sample = await Order.findOne();
      console.log('Sample Order createdAt:', sample?.createdAt);
    } catch (e) {
      console.error('ERROR:', e);
    }
    process.exit(0);
  });
