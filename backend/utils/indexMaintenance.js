/**
 * One-shot, idempotent index maintenance, run once per server start. It NEVER
 * deletes documents — it only adjusts indexes.
 *
 * Mongoose's autoIndex only ever CREATES indexes: it can't change an existing index's
 * options and never drops anything. Two things are handled here:
 *
 *  1. Logs are kept permanently (owner's requirement). The schemas used to declare
 *     TTL (auto-delete) indexes on audit_logs_v2 (90 days) and user_sessions
 *     (180 days); they never applied on the existing database because plain indexes
 *     on the same keys already existed, but a fresh database would have created them
 *     and started deleting logs. The declarations are gone; this step also strips a
 *     TTL from any log index where one does exist, so no environment deletes logs.
 *  2. Redundant indexes (single-field prefixes of compound indexes, boolean flags,
 *     multikey indexes on per-user arrays) cost storage and are rewritten on every
 *     insert/update. They've been removed from the schemas; this drops them from
 *     databases that already have them. Dropping an index never touches the data.
 *
 * Every step is best-effort: a failure is logged and never blocks startup. Once a
 * database is clean, each run is a handful of cheap listIndexes calls.
 */

// Indexes on log collections that must never carry a TTL. [collection, keyPattern,
// recreate]: `recreate` re-adds the index without TTL (it's used for queries);
// otherwise the TTL-only index is simply dropped.
const NEVER_EXPIRE = [
  ["audit_logs_v2", { timestamp_utc: 1 }, true],
  ["user_sessions", { start_time: -1 }, true],
  ["analytics_interaction_logs", { createdAt: 1 }, false],
  ["notifications", { readAt: 1 }, false],
  ["auditlogs", { createdAt: -1 }, true],
];

// Indexes no longer declared in any schema.
const REDUNDANT_INDEXES = {
  audit_logs_v2: ["event_type_1", "user_id_1", "environment_1", "correlation_id_1", "flags.is_anomaly_1", "environment_1_timestamp_utc_-1"],
  user_sessions: ["user_id_1"],
  analytics_interaction_logs: ["userId_1", "productId_1", "eventType_1", "userId_1_createdAt_-1"],
  productvelocityviews: ["product_id_1"],
  analytics_cohort_view: ["cohort_month_1"],
  customercohortviews: ["cohort_month_1"],
  blogcomments: ["blog_1"],
  couponuses: ["coupon_1", "user_1"],
  products: ["category_1", "stock_1", "isActive_1"],
  orders: ["user_1", "source_1", "shippedAt_1", "isDeleted_1"],
  userprofiles: ["cartHistory.productId_1", "productViewCounts.productId_1"],
};

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function listIndexesSafe(db, name) {
  try {
    return await db.collection(name).indexes();
  } catch (err) {
    // NamespaceNotFound: the collection doesn't exist yet — nothing to maintain.
    if (err?.code === 26 || /ns does not exist|NamespaceNotFound/i.test(err?.message || "")) return null;
    throw err;
  }
}

async function removeTtl(db, collection, key, recreate, dryRun) {
  const indexes = await listIndexesSafe(db, collection);
  if (!indexes) return;
  const ttl = indexes.find(i => sameKey(i.key, key) && i.expireAfterSeconds !== undefined);
  if (!ttl) return;
  if (dryRun) {
    console.log(`[IndexMaintenance] (dry run) ${collection}: would remove TTL (${ttl.expireAfterSeconds}s) from ${ttl.name}`);
    return;
  }
  // A TTL can't be switched off in place, so drop the index and (if it serves
  // queries) recreate it without expiry. Only the index changes — no documents.
  await db.collection(collection).dropIndex(ttl.name);
  if (recreate) await db.collection(collection).createIndex(key);
  console.log(`[IndexMaintenance] ${collection}: removed auto-delete (TTL) from ${ttl.name} — logs are kept permanently`);
}

export async function runIndexMaintenance(db, { dryRun = false } = {}) {
  // First, so no log can expire while the rest of this runs.
  for (const [collection, key, recreate] of NEVER_EXPIRE) {
    try {
      await removeTtl(db, collection, key, recreate, dryRun);
    } catch (err) {
      console.error(`[IndexMaintenance] TTL removal on ${collection} failed:`, err.message);
    }
  }

  for (const [collection, names] of Object.entries(REDUNDANT_INDEXES)) {
    try {
      const indexes = await listIndexesSafe(db, collection);
      if (!indexes) continue;
      const present = new Set(indexes.map(i => i.name));
      for (const name of names) {
        if (!present.has(name)) continue;
        if (dryRun) {
          console.log(`[IndexMaintenance] (dry run) ${collection}: would drop ${name}`);
          continue;
        }
        await db.collection(collection).dropIndex(name);
        console.log(`[IndexMaintenance] ${collection}: dropped redundant index ${name}`);
      }
    } catch (err) {
      console.error(`[IndexMaintenance] cleanup on ${collection} failed:`, err.message);
    }
  }
}
