/**
 * Tiny in-memory cache for hot, public, non-personalised GET responses.
 *
 * Every storefront page load hit MongoDB for the same product list, filters and
 * homepage layout. On a free M0 cluster and a 0.1-CPU instance, serving those from
 * memory for a short window removes most read traffic without any staleness that
 * matters: any write that could change them (admin edits, reviews, orders changing
 * stock) clears the whole cache — see `invalidateOnWrite` in index.js.
 *
 * Only responses to requests WITHOUT an Authorization header are cached, so nothing
 * user-specific can ever be served to someone else. Bounded by entry count and total
 * bytes; oldest entries are evicted first.
 */

const MAX_ENTRIES = 300;
const MAX_BYTES = 16 * 1024 * 1024; // 16 MB of serialized JSON, well inside a 512 MB instance

const store = new Map(); // key -> { body, size, expires }
let totalBytes = 0;

const evict = (key) => {
  const entry = store.get(key);
  if (!entry) return;
  totalBytes -= entry.size;
  store.delete(key);
};

export const clearResponseCache = () => {
  store.clear();
  totalBytes = 0;
};

/**
 * Express middleware. `ttlMs` is how long a response may be reused. Pass
 * `skip(req)` to bypass the cache for specific requests (e.g. searches that must
 * reach the handler so they get logged).
 */
export const cacheResponse = (ttlMs, { skip } = {}) => (req, res, next) => {
  if (req.method !== "GET" || req.headers.authorization || (skip && skip(req))) return next();

  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit) {
    if (hit.expires > Date.now()) {
      res.set("X-Cache", "HIT");
      // The handler didn't run, so replay the browser-cache policy it set.
      if (hit.cacheControl) res.set("Cache-Control", hit.cacheControl);
      res.type("application/json");
      return res.send(hit.body);
    }
    evict(key);
  }

  // Capture the JSON the handler sends; cache only successful responses.
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode === 200 && payload && payload.success !== false) {
      try {
        const body = JSON.stringify(payload);
        const size = Buffer.byteLength(body);
        if (size < MAX_BYTES / 4) {
          evict(key);
          while ((store.size >= MAX_ENTRIES || totalBytes + size > MAX_BYTES) && store.size) {
            evict(store.keys().next().value); // Map iterates in insertion order → oldest first
          }
          store.set(key, { body, size, expires: Date.now() + ttlMs, cacheControl: res.getHeader("Cache-Control") });
          totalBytes += size;
        }
      } catch { /* non-serializable payload — just don't cache it */ }
    }
    res.set("X-Cache", "MISS");
    return originalJson(payload);
  };
  next();
};
