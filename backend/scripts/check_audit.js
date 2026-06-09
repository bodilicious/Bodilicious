import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const logs = await db.collection('auditlogv2s').find({ event_type: { $regex: 'CART' } }).limit(5).toArray();
  console.log(JSON.stringify(logs, null, 2));
  mongoose.disconnect();
});
