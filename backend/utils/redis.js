import Redis from "ioredis";

/**
 * Shared Redis singleton.
 *
 * Free-tier Redis (Render / Upstash) limits concurrent connections.
 * BullMQ already consumes ~2 connections per Queue + ~2 per Worker.
 * By sharing a single ioredis client for all non-BullMQ uses
 * (caching, dedup, pub/sub) we keep the connection count low.
 *
 * BullMQ must use its own connection objects (it manages their lifecycle
 * internally), so do NOT pass this client to Queue / Worker constructors.
 *
 * Usage:
 *   import redis from "../utils/redis.js";
 *   if (redis) await redis.get("key");   // redis is null when REDIS_URL unset
 */

let _redis = null;

if (process.env.REDIS_URL) {
  _redis = new Redis(process.env.REDIS_URL, {
    // Reconnect with exponential backoff, capped at 30 s.
    // Prevents hammering the free-tier host on transient drops.
    retryStrategy: (times) => Math.min(times * 200, 30_000),
    // Free tiers often enforce a max-idle timeout; keep the connection alive.
    keepAlive: 30_000,
    // Don't let a dropped connection crash the process — just log and retry.
    lazyConnect: false,
  });

  _redis.on("error", (err) => {
    // Log but never throw — callers must handle null gracefully.
    console.error("[Redis] Connection error:", err.message);
  });

  _redis.on("connect", () => console.log("[Redis] Connected (shared client)"));
}

export default _redis;
