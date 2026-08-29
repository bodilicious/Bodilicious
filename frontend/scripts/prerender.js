#!/usr/bin/env node
/**
 * prerender.js
 *
 * Post-build SSG script. Reads all URLs from public/sitemap.xml, visits each
 * one in a headless Chromium browser, waits for the React app to fully
 * hydrate and for all API calls to settle, then writes the baked HTML to the
 * matching path in dist/ so Render serves it as a real static file to bots.
 *
 * Key design decisions:
 *  - networkidle2: allows ≤2 in-flight connections so analytics/beacon calls
 *    don't block forever, while still waiting for real data fetches.
 *  - 15s hard timeout per page with graceful fallback: if a page hangs (e.g.,
 *    a WebSocket or polling connection), we save whatever HTML exists at that
 *    point and move on — one flaky page never stalls the whole build.
 *  - Batched concurrency: processes CONCURRENCY pages at a time (default 5)
 *    to keep memory usage and build time predictable regardless of catalog size.
 *  - Only runs on Render (or when PRERENDER=true) to avoid slowing down local builds.
 *
 * Local usage:
 *   PRERENDER=true node scripts/prerender.js
 *   PRERENDER=true PRERENDER_CONCURRENCY=10 node scripts/prerender.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';
import express from 'express';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR     = path.join(__dirname, '..', 'dist');
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');
const PORT         = 5173; // Must match backend CORS allowed origins
const BASE_URL     = `http://localhost:${PORT}`;
const CONCURRENCY  = parseInt(process.env.PRERENDER_CONCURRENCY || '5', 10);
const PAGE_TIMEOUT = 15_000; // 15 seconds max per page
const SITE_ORIGIN  = 'https://bodilicious.in';

// Only run on Render or when explicitly enabled locally
if (!process.env.RENDER && process.env.PRERENDER !== 'true') {
  console.log('[prerender] Not running on Render — skipping prerender. Use PRERENDER=true to run locally.');
  process.exit(0);
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('[prerender] ERROR: dist/ folder not found. Run `vite build` first.');
  process.exit(1);
}

// ── Parse sitemap and extract URL paths ─────────────────────────────────────

async function getPathsFromSitemap() {
  let xml;
  try {
    xml = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  } catch {
    console.error('[prerender] ERROR: Could not read public/sitemap.xml.');
    process.exit(1);
  }

  const parsed = await parseStringPromise(xml);
  const urls = parsed?.urlset?.url || [];

  const paths = urls
    .map(u => {
      const loc = u?.loc?.[0] || '';
      if (!loc.startsWith(SITE_ORIGIN)) return null;
      const pathPart = loc.slice(SITE_ORIGIN.length) || '/';
      // Skip query parameters since we can't save them as static files on standard hosts
      if (pathPart.includes('?')) {
        console.warn(`[prerender] Skipping parameterized URL (cannot be statically generated): ${pathPart}`);
        return null;
      }
      return pathPart;
    })
    .filter(Boolean);

  console.log(`[prerender] Found ${paths.length} URL(s) in sitemap to prerender.`);
  return paths;
}

// ── Write HTML to dist matching the URL path ─────────────────────────────────

function writeHtml(urlPath, html) {
  // /product/BD-SER-NIA → dist/product/BD-SER-NIA/index.html
  // /                   → dist/index.html
  const cleanPath = urlPath === '/' ? '' : urlPath;
  const outputDir = path.join(DIST_DIR, cleanPath);
  const outputFile = path.join(outputDir, 'index.html');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, html, 'utf-8');
}

// ── Process a single URL with Puppeteer ──────────────────────────────────────

async function renderPage(browser, urlPath) {
  const fullUrl = `${BASE_URL}${urlPath}`;
  const page = await browser.newPage();

  try {
    // Block non-essential third-party requests to speed up rendering and
    // prevent analytics/tracking calls from keeping networkidle2 open.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const BLOCKED = [
        'posthog.com', 'googletagmanager.com', 'google-analytics.com',
        'analytics.ahrefs.com', 'hotjar.com', 'facebook.net', 'razorpay.com',
        'lumberjack.razorpay.com',
      ];
      if (BLOCKED.some(blocked => url.includes(blocked))) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Wait for networkidle0 to ensure all API fetches complete.
    // If it hangs due to long-polling, the 15s timeout will catch it.
    await page.goto(fullUrl, {
      waitUntil: 'networkidle0',
      timeout: PAGE_TIMEOUT,
    });

    // Extra safety: also wait for #root to have child elements (React mounted)
    await page.waitForSelector('#root > *', { timeout: PAGE_TIMEOUT }).catch(() => {
      console.warn(`[prerender]   ⚠ #root remained empty after timeout on ${urlPath} — saving shell HTML`);
    });

    // Wait for useSEO() to update the canonical link away from the static
    // index.html default (https://bodilicious.in/). React's useEffect fires
    // after paint — networkidle0 + #root check above don't guarantee it has
    // run yet. Without this, Puppeteer can capture page.content() while the
    // canonical still points to the homepage, causing Google to treat every
    // blog post and product page as a duplicate of the homepage.
    // Skipped for '/' since the homepage canonical IS bodilicious.in/.
    if (urlPath !== '/') {
      await page.waitForFunction(
        (origin) => {
          const el = document.querySelector('link[rel="canonical"]');
          return el && el.href && !el.href.endsWith(origin + '/') && el.href !== origin;
        },
        { timeout: 8000 },
        SITE_ORIGIN
      ).catch(() => {
        console.warn(`[prerender]   ⚠ Canonical did not update on ${urlPath} — saving with current canonical`);
      });
    }

    const html = await page.content();
    writeHtml(urlPath, html);
    return { path: urlPath, ok: true };
  } catch (err) {
    // Timeout or navigation error: try to save whatever we have
    try {
      const html = await page.content();
      if (html && html.includes('<div id="root">')) {
        writeHtml(urlPath, html);
        console.warn(`[prerender]   ⚠ Timeout on ${urlPath} — saved partial HTML (${err.message})`);
        return { path: urlPath, ok: true, partial: true };
      }
    } catch { /* ignore secondary errors */ }
    console.error(`[prerender]   ✗ Failed ${urlPath}: ${err.message}`);
    return { path: urlPath, ok: false, error: err.message };
  } finally {
    await page.close();
  }
}

// ── Process paths in batches ─────────────────────────────────────────────────

async function processBatch(browser, batch) {
  return Promise.all(batch.map(p => renderPage(browser, p)));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[prerender] Starting prerender step...');
  const startTime = Date.now();

  // 1. Parse sitemap
  const paths = await getPathsFromSitemap();
  if (paths.length === 0) {
    console.log('[prerender] No URLs to prerender. Exiting.');
    return;
  }

  // 2. Start local Express server serving dist/
  const app = express();
  // Serve static files; fall back to index.html for SPA routing
  app.use(express.static(DIST_DIR));
  app.use((_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
  const server = app.listen(PORT);
  console.log(`[prerender] Local server started on ${BASE_URL}`);

  // 3. Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Required in Render/Docker environments
      '--disable-gpu',
    ],
  });

  console.log(`[prerender] Processing ${paths.length} page(s) with concurrency ${CONCURRENCY}...`);

  // 4. Process in batches
  const results = [];
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(paths.length / CONCURRENCY);
    console.log(`[prerender] Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
    const batchResults = await processBatch(browser, batch);
    results.push(...batchResults);

    batchResults.forEach(r => {
      if (r.ok && !r.partial) console.log(`[prerender]   ✓ ${r.path}`);
    });
  }

  // 5. Teardown
  await browser.close();
  server.close();

  // 6. Report
  const succeeded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[prerender] ═══════════════════════════════════`);
  console.log(`[prerender] Done in ${elapsed}s`);
  console.log(`[prerender] ✓ Success: ${succeeded}/${results.length}`);
  if (failed > 0) {
    console.log(`[prerender] ✗ Failed:  ${failed}/${results.length}`);
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.path}: ${r.error}`));
  }
  console.log(`[prerender] ═══════════════════════════════════\n`);
}

main().catch(err => {
  console.error(`[prerender] FATAL: ${err.message}`);
  process.exit(1);
});
