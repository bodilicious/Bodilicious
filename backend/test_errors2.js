import mongoose from 'mongoose';
import AuditLog from './admin/models.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bodilicious');

  const paymentFailureTotal = await AuditLog.countDocuments({ eventType: "PAYMENT_FAILED" });
  const paymentFailureWithDate = await AuditLog.findOne({ eventType: "PAYMENT_FAILED" }).sort({ createdAt: -1 }).lean();
  
  console.log('TOTAL PAYMENT_FAILED (V1):', paymentFailureTotal);
  if (paymentFailureWithDate) console.log('Latest PAYMENT_FAILED:', paymentFailureWithDate.createdAt);

  const errorTotal = await AuditLog.countDocuments({ severity: "ERROR" });
  console.log('TOTAL ERROR (V1):', errorTotal);

  process.exit(0);
}
main().catch(console.error);
