import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../products/models.js';
import AuditLogV2 from '../audit/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const rawLogs = await AuditLogV2.find({ event_type: { $in: ["CART_ITEM_ADDED", "CART_ITEM_REMOVED"] } })
        .sort({ timestamp_utc: -1 })
        .limit(10)
        .lean();
    
    console.log("Raw logs found:", rawLogs.length);
    const productIds = rawLogs.map(l => l.metadata?.targetId).filter(Boolean);
    console.log("Product IDs:", productIds);
    
    const products = await Product.find({ _id: { $in: productIds } }, "name").lean();
    console.log("Products found:", products.length);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    mongoose.disconnect();
  }
});
