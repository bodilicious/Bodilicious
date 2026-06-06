import { nanoid } from 'nanoid';

// In-memory fallback
import { processAuditBatch } from './worker.js'; 
import { emitLiveEvent } from '../analytics/live.js'; 

let buffer = [];
let timer = null;

export const flushBuffer = async () => {
  if (buffer.length === 0) return;
  const eventsToProcess = [...buffer];
  buffer = [];
  try {
    await processAuditBatch(eventsToProcess);
  } catch(err) {
    console.error('Background batch flush failed:', err);
  }
};

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
 * Enqueue an audit event asynchronously
 * @param {Object} event
 */
export async function logAuditEvent(event) {
  try {
    const event_id = nanoid();
    const timestamp_utc = new Date();
    // derived IST string
    const timestamp_ist = timestamp_utc.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const payload = {
      schema_version: 1,
      event_id,
      event_type: event.event_type,
      user_id: event.user_id || null,
      session_id: event.session_id || nanoid(), // Fallback session id
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
        is_anomaly: false, // Calculated by worker
        is_pii_masked: true
      }
    };

    // Emit live event for real-time dashboard
    emitLiveEvent(payload.event_type, payload.metadata);

    // In-memory batching without Redis
    buffer.push(payload);
    if (buffer.length >= 100) {
      if (timer) clearTimeout(timer);
      timer = null;
      flushBuffer();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        flushBuffer();
      }, 500);
    }
  } catch (err) {
    console.error('CRITICAL: Audit logger failed completely', err);
  }
}
