import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { logAuditEvent } from '../audit/logger.js';
import AuditLogV2 from '../audit/models.js';

async function verifyAuditLogs() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  
  console.log("Publishing test audit event...", { maxPoolSize: 3,  maxPoolSize: 3 });
  await logAuditEvent({
    event_type: "TEST_VERIFICATION",
    user_id: null,
    session_id: "test-session-123",
    severity: "INFO",
    source_system: "backend-api",
    network: { ip_address: "127.0.0.1" },
    metadata: { reason: "verification script" }
  });

  // Give BullMQ / In-memory fallback a moment to process
  console.log("Waiting 2 seconds for worker...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Querying database...");
  const logs = await AuditLogV2.find({ event_type: "TEST_VERIFICATION" });
  
  if (logs.length > 0) {
    console.log("✅ SUCCESS: Found inserted event:", logs[0].event_id);
    
    // Cleanup
    await AuditLogV2.deleteMany({ event_type: "TEST_VERIFICATION" });
    console.log("Cleaned up test logs.");
  } else {
    console.log("❌ FAILED: Event was not inserted into database.");
  }
  
  await mongoose.disconnect();
  process.exit(0);
}

verifyAuditLogs().catch(err => {
  console.error(err);
  process.exit(1);
});
