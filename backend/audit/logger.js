import { nanoid } from 'nanoid';
import { emitLiveEvent } from '../analytics/live.js'; 
import { processAuditBatch } from './worker.js';

let batchBuffer = [];
let flushTimer = null;

function flushBatch() {
  if (batchBuffer.length === 0) return;
  const eventsToProcess = [...batchBuffer];
  batchBuffer = [];
  processAuditBatch(eventsToProcess).catch(e => console.error('Audit Batch Process Error:', e));
}

/**
 * Mask PII from payloads before enqueuing
 */
function maskPII(payload) {
  const masked = { ...payload };
  if (masked.email) {
    const [name, domain] = masked.email.split('@');
    if (name && domain) {
      masked.email = `${name.charAt(0)}***@${domain}`;
    }
  }
  if (masked.phone) {
    masked.phone = masked.phone.replace(/.(?=.{4})/g, '*');
  }
  return masked;
}

/**
 * Enqueue an audit event in-memory and flush periodically
 * @param {Object} event
 */
export async function logAuditEvent(event) {
  try {
    const event_id = nanoid();
    const timestamp_utc = new Date();
    const timestamp_ist = timestamp_utc.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const payload = {
      schema_version: 1,
      event_id,
      event_type: event.event_type,
      user_id: event.user_id || null,
      session_id: event.session_id || nanoid(),
      timestamp_utc,
      timestamp_ist,
      environment: process.env.NODE_ENV || 'development',
      severity: event.severity || 'INFO',
      source_system: event.source_system || 'backend-api',
      correlation_id: event.correlation_id || null,
      request_id: event.request_id || null,
      network: event.network || {},
      metadata: maskPII(event.metadata || {}),
      flags: {
        is_error: event.is_error || false,
        is_anomaly: false,
        is_pii_masked: true
      }
    };

    // Emit live event for real-time dashboard
    emitLiveEvent(payload.event_type, payload.metadata);

    // Buffer in-memory
    batchBuffer.push(payload);
    
    // Flush if batch is full
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

  } catch (err) {
    console.error('CRITICAL: Audit logger failed completely', err);
  }
}

