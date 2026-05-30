import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { nanoid } from 'nanoid';


// In-memory fallback
import { processAuditBatch } from './worker.js'; 
import { emitLiveEvent } from '../analytics/live.js'; 

const redisUrl = process.env.REDIS_URL || null;
let auditQueue = null;

if (redisUrl) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  auditQueue = new Queue('audit_queue', { connection });
} else {
  console.warn('⚠️ No REDIS_URL found. Audit logs will be processed synchronously in-memory as a fallback.');
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

    if (auditQueue) {
      // Fire and forget, completely non-blocking
      auditQueue.add('log_event', payload, {
        removeOnComplete: true,
        removeOnFail: 100 // Keep last 100 failed for DLQ
      }).catch(err => {
        console.error('Failed to enqueue audit log:', err.message);
        // Fallback to synchronous
        processAuditBatch([payload]).catch(e => console.error('Fallback audit log failed:', e.message));
      });
    } else {
      // Synchronous fallback
      processAuditBatch([payload]).catch(err => console.error('Fallback audit log failed:', err.message));
    }
  } catch (err) {
    console.error('CRITICAL: Audit logger failed completely', err);
  }
}
