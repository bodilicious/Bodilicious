/**
 * IndexNow — pushes new/updated URLs to Bing, Yandex and every other
 * IndexNow-participating engine the instant content is published, instead of
 * waiting for their next scheduled crawl. Google does not consume IndexNow
 * directly; getting Google to re-crawl fast still depends on Search Console
 * having the sitemap (already submitted) plus this signal feeding the same
 * shared endpoint other engines use.
 *
 * Key file must be reachable at https://bodilicious.in/<key>.txt — served as
 * a static asset from frontend/public/, which the Cloudflare worker passes
 * through to origin for any path it doesn't specifically intercept.
 */

const INDEXNOW_KEY = "0f41573de31c9865fb2a2873d3052885";
const HOST = "bodilicious.in";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Fire-and-forget notification. Never throws — a failed ping must not break
 * the blog/product save it's attached to.
 * @param {string[]} urls Absolute https:// URLs on bodilicious.in
 */
export async function pingIndexNow(urls) {
  const urlList = (urls || []).filter(Boolean);
  if (urlList.length === 0) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 202) {
      console.warn(`[IndexNow] Non-OK response ${res.status} for`, urlList);
    }
  } catch (err) {
    console.warn("[IndexNow] Ping failed:", err.message);
  }
}
