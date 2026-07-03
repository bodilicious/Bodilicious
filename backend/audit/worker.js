import { Worker } from 'bullmq';
import Redis from 'ioredis';
import AuditLogV2 from './models.js';
import { checkAnomaly } from './anomalyEngine.js';

const redisUrl = process.env.REDIS_URL || null;

let batchBuffer = [];
let flushTimer = null;

export async function processAuditBatch(events) {
  if (events.length === 0) return;
  try {
    // 1. Evaluate Anomalies
    for (const event of events) {
      const isAnomaly = await checkAnomaly(event);
      if (isAnomaly) {
        event.flags.is_anomaly = true;
      }
    }

    // 2. Insert Batch
    console.log('[Audit Worker] Inserting audit batch:', events.length, 'events');
    const res = await AuditLogV2.insertMany(events, { ordered: false });
    console.log('[Audit Worker] InsertMany result:', res ? res.length : 'none');
  } catch (err) {
    console.error('[Audit Worker] Batch Insert Failed:', err);
    // If it fails here, jobs are already completed in BullMQ.
    // Given 'eventually consistent' is acceptable, we log and drop to avoid stalling.
  }
}

function flushBatch() {
  if (batchBuffer.length === 0) return;
  const eventsToProcess = [...batchBuffer];
  batchBuffer = [];
  processAuditBatch(eventsToProcess).catch(e => console.error(e));
}

export function initAuditWorker() {
  if (!redisUrl) {
    console.warn("⚠️ REDIS_URL not set. Audit worker not started.");
    return null;
  }

  // Dedicated connection per user instructions
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker('auditQueue', async (job) => {
    try {
      const payload = job.data;
      batchBuffer.push(payload);

      if (batchBuffer.length >= 100) {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = null;
        flushBatch();
      } else if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flushBatch();
        }, 5000); // 5 seconds window
      }

      return { status: "buffered" };
    } catch (err) {
      console.error(`[Audit Worker] Job ${job.id} failed:`, err);
      throw err;
    }
  }, { 
    connection,
    drainDelay: 60000,
    stalledInterval: 300000,
    metrics: { maxDataPoints: 0 }
  });

  worker.on('failed', (job, err) => {
    console.error(`[Audit Worker] Job ${job?.id} failed in queue: ${err.message}`);
  });

  console.log("[Audit Worker] Started successfully.");
  return worker;
}
