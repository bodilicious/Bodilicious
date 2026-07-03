import AuditLogV2 from './models.js';
import { checkAnomaly } from './anomalyEngine.js';

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
    // Given 'eventually consistent' is acceptable, we log and drop to avoid stalling.
  }
}

// initAuditWorker is no longer needed since we handle batching directly in logger.js
export function initAuditWorker() {
  console.log("[Audit Worker] BullMQ removed. Using in-memory batch processing.");
  return null;
}
