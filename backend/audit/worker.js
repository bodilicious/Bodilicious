import { Worker } from 'bullmq';
import Redis from 'ioredis';
import AuditLogV2 from './models.js';
import { checkAnomaly } from './anomalyEngine.js';


const redisUrl = process.env.REDIS_URL || null;

export async function processAuditBatch(events) {
  try {
    // 1. Evaluate Anomalies
    for (const event of events) {
      const isAnomaly = await checkAnomaly(event);
      if (isAnomaly) {
        event.flags.is_anomaly = true;
      }
    }

    // 2. Insert Batch
    if (events.length > 0) {
      console.log('Inserting audit batch:', events.length, 'events');
      // Use insertMany to efficiently batch writes to MongoDB
      const res = await AuditLogV2.insertMany(events, { ordered: false });
      console.log('InsertMany result:', res ? res.length : 'none');
    }
  } catch (err) {
    console.error('Audit Batch Insert Failed:', err);
    throw err; // Re-throw to trigger BullMQ retries or DLQ
  }
}

// BullMQ and Redis removed to save Redis quotas. Using in-memory batching from logger.js instead.
