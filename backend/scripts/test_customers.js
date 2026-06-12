import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { getCustomerAnalytics } from '../admin/analyticsController.js';

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bodilicious')
  .then(async () => {
    const req = { query: {} };
    const res = {
      json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)),
      status: (code) => ({ json: (data) => console.log('STATUS:', code, 'JSON:', data) })
    };
    try {
      await getCustomerAnalytics(req, res);
    } catch (e) {
      console.error('ERROR:', e);
    }
    process.exit(0);
  });
