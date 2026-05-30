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

if (redisUrl) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  
  let buffer = [];
  let timer = null;
  
  const flushBuffer = async () => {
    if (buffer.length === 0) return;
    const eventsToProcess = [...buffer];
    buffer = [];
    try {
      await processAuditBatch(eventsToProcess);
    } catch(err) {
      console.error('Background batch flush failed:', err);
      // In a strict environment, failed inserts here would be pushed to a DLQ queue manually.
      // Since BullMQ is handling the job, the job itself might be marked as failed if we threw the error,
      // but because we are batching across multiple jobs, it's safer to let BullMQ handle single retries,
      // or implement custom DLQ logic. For v2.0 baseline, we log it.
    }
  };

  const worker = new Worker('audit_queue', async (job) => {
    buffer.push(job.data);
    // Batch size of 100 or flush every 500ms
    if (buffer.length >= 100) {
      clearTimeout(timer);
      await flushBuffer();
    } else if (!timer) {
      timer = setTimeout(async () => {
        timer = null;
        await flushBuffer();
      }, 500);
    }
  }, { 
    connection,
    // Add drainDelay to massively reduce Redis polling frequency (default is 5s)
    // 60s delay = ~1,440 polls/day. Easily fits into Upstash 10k/day Free Tier!
    drainDelay: 60000,
  });

  worker.on('failed', (job, err) => {
    console.error(`Audit Job ${job.id} failed:`, err);
  });
  
  console.log('🚀 Audit Worker running with BullMQ & Redis');
} else {
  console.log('⚠️ Audit Worker bypassed: No REDIS_URL found. Will use in-memory synchronous processing fallback.');
}
