import mongoose from 'mongoose';
import AuditLogV2 from './backend/audit/models.js';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/bodilicious');
  const paymentFails = await AuditLogV2.countDocuments({ event_type: "PAYMENT_FAILED" });
  const errors = await AuditLogV2.countDocuments({ severity: "ERROR" });
  console.log({ paymentFails, errors });
  
  const sampleFail = await AuditLogV2.findOne({ event_type: "PAYMENT_FAILED" });
  console.log('Sample payment fail:', sampleFail);
  process.exit(0);
}
main().catch(console.error);
