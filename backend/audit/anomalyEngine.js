import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let redis = null;
if (false && process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

/**
 * Lightweight rule-engine running in the background worker
 * Evaluates events in real-time before MongoDB insertion
 */
export async function checkAnomaly(event) {
  if (!redis) return false; // Can't detect velocity anomalies without Redis state

  try {
    // Rule: Credential Stuffing
    if (event.event_type === 'LOGIN_FAILED' && event.network?.ip_address) {
      const key = `anomaly:failed_login:${event.network.ip_address}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 300); // 5 minutes
      if (count >= 5) {
        console.warn(`🚨 ANOMALY DETECTED: Credential stuffing from IP ${event.network.ip_address}`);
        return true;
      }
    }

    // Rule: Inventory-locking bot
    if ((event.event_type === 'CART_ITEM_ADDED' || event.event_type === 'CART_ITEM_REMOVED') && event.session_id) {
      const itemId = event.metadata?.product_id || 'unknown';
      const key = `anomaly:cart_add:${event.session_id}:${itemId}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 60); // 60 seconds
      if (count >= 5) {
        console.warn(`🚨 ANOMALY DETECTED: Inventory locking bot on session ${event.session_id}`);
        return true;
      }
    }
    
    // Rule: Duplicate Webhook Storms
    if (event.source_system === 'razorpay-webhook' && event.metadata?.razorpay_event_id) {
      const key = `anomaly:webhook_lock:${event.metadata.razorpay_event_id}`;
      const acquired = await redis.setnx(key, '1');
      if (acquired) {
        await redis.expire(key, 86400); // Lock for 24 hours
      } else {
        console.warn(`🚨 ANOMALY DETECTED: Duplicate webhook storm ${event.metadata.razorpay_event_id}`);
        return true;
      }
    }

    // Rule: Excessive failed payments
    if (event.event_type === 'PAYMENT_FAILED' && event.user_id) {
      const key = `anomaly:failed_payment:${event.user_id}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 600); // 10 minutes
      if (count >= 3) {
        console.warn(`🚨 ANOMALY DETECTED: Excessive failed payments for user ${event.user_id}`);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Anomaly Engine Error:', err);
    return false; // Fail open to ensure log still gets written
  }
}
