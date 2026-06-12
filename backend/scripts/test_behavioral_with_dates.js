import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { getBehavioralAnalytics } from '../admin/analyticsController.js';

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bodilicious', { dbName: process.env.DB_NAME })
  .then(async () => {
    const req = { query: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2026-12-31T23:59:59.999Z' } };
    const res = {
      json: (data) => console.log('JSON:', JSON.stringify(data, null, 2)),
      status: (code) => ({ json: (data) => console.log('STATUS:', code, 'JSON:', data) })
    };
    try {
      await getBehavioralAnalytics(req, res);
    } catch (e) {
      console.error('ERROR:', e);
    }
    process.exit(0);
  });
