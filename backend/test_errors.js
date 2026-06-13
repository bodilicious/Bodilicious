import mongoose from 'mongoose';
import AuditLogV2 from './audit/models.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });;

  const paymentFailureTotal = await AuditLogV2.countDocuments({ event_type: "PAYMENT_FAILED" });
  const paymentFailureWithDate = await AuditLogV2.findOne({ event_type: "PAYMENT_FAILED" }).sort({ timestamp_utc: -1 }).lean();
  
  console.log('TOTAL PAYMENT_FAILED:', paymentFailureTotal);
  if (paymentFailureWithDate) console.log('Latest PAYMENT_FAILED:', paymentFailureWithDate.timestamp_utc);

  const errorTotal = await AuditLogV2.countDocuments({ severity: "ERROR" });
  const errorWithDate = await AuditLogV2.findOne({ severity: "ERROR" }).sort({ timestamp_utc: -1 }).lean();
  
  console.log('TOTAL ERROR:', errorTotal);
  if (errorWithDate) console.log('Latest ERROR:', errorWithDate.timestamp_utc);

  process.exit(0);
}
main().catch(console.error);
