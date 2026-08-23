#!/usr/bin/env node
/**
 * ping-indexnow.js
 *
 * Post-build step. Reads every URL from public/sitemap.xml and bulk-submits
 * them to IndexNow so Bing (and every other IndexNow-participating engine)
 * re-crawls the entire site after each deploy.
 *
 * Why this exists:
 *   The backend already calls pingIndexNow() when individual products/blogs
 *   are saved — but that only fires for NEW/UPDATED content. After a full
 *   redeploy (new prerendered HTML for every page), Bing needs to be told
 *   that ALL pages have changed, not just the ones saved today.
 *
 * Usage (called automatically by npm run build via render.yaml):
 *   PRERENDER=true npm run build   (render.yaml build command)
 *
 * Or manually:
 *   node scripts/ping-indexnow.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');

const INDEXNOW_KEY  = '0f41573de31c9865fb2a2873d3052885';
const HOST          = 'bodilicious.in';
const KEY_LOCATION  = `https://${HOST}/${INDEXNOW_KEY}.txt`;

// Ping both the shared endpoint (notifies all engines) AND Bing directly.
// Sending to Bing directly ensures the ping is processed even if api.indexnow.org
// has propagation delays to Bing specifically.
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
];

// IndexNow accepts up to 10,000 URLs per request — batch just in case.
const BATCH_SIZE = 10_000;

// Only run when PRERENDER=true (i.e. on Render builds) — skip local dev.
if (process.env.PRERENDER !== 'true' && !process.env.RENDER) {
  console.log('[indexnow] Skipping — not a Render build. Set PRERENDER=true to run locally.');
  process.exit(0);
}

async function getUrlsFromSitemap() {
  let xml;
  try {
    xml = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  } catch {
    console.warn('[indexnow] Could not read sitemap.xml — skipping ping.');
    process.exit(0);
  }

  const parsed = await parseStringPromise(xml);
  const entries = parsed?.urlset?.url || [];

  return entries
    .map(u => u?.loc?.[0]?.trim())
    .filter(u => u && u.startsWith(`https://${HOST}`));
}

async function pingEndpoint(endpoint, urls) {
  const body = JSON.stringify({
    host:        HOST,
    key:         INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList:     urls,
  });

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  // 200 and 202 are both success responses for IndexNow
  if (res.ok || res.status === 202) {
    return { ok: true, status: res.status };
  }
  const text = await res.text().catch(() => '');
  return { ok: false, status: res.status, body: text };
}

async function main() {
  console.log('[indexnow] Reading sitemap...');
  const urls = await getUrlsFromSitemap();

  if (urls.length === 0) {
    console.warn('[indexnow] No URLs found in sitemap — nothing to ping.');
    return;
  }

  console.log(`[indexnow] Found ${urls.length} URL(s) to submit.`);

  // Batch into chunks of BATCH_SIZE
  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }

  for (const [batchIdx, batch] of batches.entries()) {
    const batchLabel = batches.length > 1 ? ` (batch ${batchIdx + 1}/${batches.length})` : '';
    console.log(`[indexnow] Pinging ${batch.length} URL(s)${batchLabel}...`);

    const results = await Promise.allSettled(
      ENDPOINTS.map(ep => pingEndpoint(ep, batch))
    );

    ENDPOINTS.forEach((ep, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        const { ok, status, body } = r.value;
        if (ok) {
          console.log(`[indexnow] ✓ ${ep} → HTTP ${status}`);
        } else {
          console.warn(`[indexnow] ✗ ${ep} → HTTP ${status}${body ? ': ' + body.slice(0, 120) : ''}`);
        }
      } else {
        console.warn(`[indexnow] ✗ ${ep} → ${r.reason?.message || 'network error'}`);
      }
    });
  }

  console.log('[indexnow] Done.');
}

main().catch(err => {
  // Non-fatal — a failed ping must never break the build.
  console.warn('[indexnow] WARNING: Unexpected error —', err.message);
  process.exit(0);
});
