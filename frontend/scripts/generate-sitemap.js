#!/usr/bin/env node
/**
 * generate-sitemap.js
 *
 * Runs as a prebuild step on Render. Fetches all active products and all
 * published blog posts from the Bodilicious API and injects their URLs into
 * public/sitemap.xml, replacing the previously hand-coded product list and
 * the BLOG_START/BLOG_END section.
 *
 * This makes the sitemap — and thus the prerendering pipeline — self-updating.
 * Any new product added in the admin panel will appear in the sitemap on the
 * next deploy, and will be automatically prerendered.
 *
 * Safety guarantees:
 *  - Only runs on Render (guarded by process.env.RENDER); skips cleanly otherwise.
 *  - Reads API_URL from process.env, falls back to parsing .env for local dev.
 *  - Validates that the resolved URL is https:// before any requests.
 *  - On any fetch error: warns and exits 0 (build continues with last committed sitemap).
 *  - Paginates until all products/posts are fetched.
 *  - Atomic write: writes to sitemap.xml.tmp then renames — a failed fetch never
 *    corrupts the live sitemap.
 *  - XML-escapes all string values.
 *
 * Required env var (set in Render dashboard):
 *   API_URL=https://bodilicious-cxow.onrender.com
 *
 * Local dev usage:
 *   RENDER=true API_URL=https://bodilicious-cxow.onrender.com node scripts/generate-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');
const SITEMAP_TMP  = SITEMAP_PATH + '.tmp';

// ── Environment guard ────────────────────────────────────────────────────────
if (!process.env.RENDER) {
  console.log('[sitemap] Not running on Render — skipping sitemap generation.');
  process.exit(0);
}

// ── Resolve API URL ──────────────────────────────────────────────────────────
function resolveApiUrl() {
  if (process.env.API_URL) return process.env.API_URL.trim();
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^API_URL\s*=\s*(.+)$/);
      if (match) return match[1].trim().replace(/^[\"']|[\"']$/g, '');
    }
  } catch { /* .env not present — fine on Render */ }
  return null;
}

const apiUrl = resolveApiUrl();

if (!apiUrl) {
  console.warn('[sitemap] WARNING: API_URL is not set. Skipping sitemap generation.');
  process.exit(0);
}

if (!apiUrl.startsWith('https://')) {
  console.warn(`[sitemap] WARNING: API_URL "${apiUrl}" is not an https:// URL. Refusing to generate.`);
  process.exit(0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeSlug(slug) {
  return encodeURIComponent(String(slug));
}

function toLastmod(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  return new Date(dateStr).toISOString().slice(0, 10);
}

// ── Fetch all active products (paginated) ────────────────────────────────────

async function fetchAllProducts() {
  const products = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${apiUrl}/api/v1/products?page=${page}&limit=100&slim=true`;
    console.log(`[sitemap] Fetching products page ${page}/${totalPages === 1 ? '?' : totalPages} from ${url}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Products API returned HTTP ${res.status} for page ${page}`);

    const data = await res.json();
    if (!data.success) throw new Error(`Products API error: ${data.message || 'Unknown error'}`);

    for (const product of data.data || []) {
      // Only include products with a pid and that are not archived/hidden
      if (product.pid && product.status !== 'archived') {
        products.push({ pid: product.pid, updatedAt: product.updatedAt });
      }
    }

    totalPages = data.pages || 1;
    page++;
  }

  console.log(`[sitemap] Fetched ${products.length} active product(s).`);
  return products;
}

// ── Fetch all published blog posts (paginated) ───────────────────────────────

async function fetchAllBlogSlugs() {
  const slugs = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${apiUrl}/api/v1/blogs?page=${page}&limit=100`;
    console.log(`[sitemap] Fetching blog page ${page}/${totalPages === 1 ? '?' : totalPages} from ${url}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Blog API returned HTTP ${res.status} for page ${page}`);

    const data = await res.json();
    if (!data.success) throw new Error(`Blog API error: ${data.message || 'Unknown error'}`);

    for (const post of data.data || []) {
      if (post.slug) slugs.push({ slug: post.slug, publishedAt: post.publishedAt });
    }

    totalPages = data.pages || 1;
    page++;
  }

  console.log(`[sitemap] Fetched ${slugs.length} published blog post(s).`);
  return slugs;
}

// ── Build XML for dynamic sections ───────────────────────────────────────────

function buildProductEntries(products) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`  <!-- PRODUCTS_START — auto-generated by scripts/generate-sitemap.js on ${today} -->`];

  for (const { pid, updatedAt } of products) {
    const loc = `https://bodilicious.in/product/${encodeURIComponent(pid)}`;
    const lastmod = toLastmod(updatedAt);
    lines.push(`  <url>`);
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>weekly</changefreq>`);
    lines.push(`    <priority>0.90</priority>`);
    lines.push(`  </url>`);
  }

  lines.push(`  <!-- PRODUCTS_END -->`);
  return lines.join('\n');
}

function buildBlogEntries(slugs) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`  <!-- BLOG_START — auto-generated by scripts/generate-sitemap.js on ${today} -->`];

  for (const { slug, publishedAt } of slugs) {
    const loc = `https://bodilicious.in/blogs/${encodeSlug(slug)}`;
    const lastmod = toLastmod(publishedAt);
    lines.push(`  <url>`);
    lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>monthly</changefreq>`);
    lines.push(`    <priority>0.75</priority>`);
    lines.push(`  </url>`);
  }

  lines.push(`  <!-- BLOG_END -->`);
  return lines.join('\n');
}

// ── Refresh lastmod on all static hand-coded URLs ────────────────────────────
// Replaces every <lastmod> date that is NOT inside the auto-generated
// PRODUCTS_START...PRODUCTS_END or BLOG_START...BLOG_END blocks with today's
// ISO date. This keeps the homepage, shop, about, policy, etc. dates fresh on
// every deploy so crawlers don't deprioritize them as stale.

function refreshStaticLastmods(sitemapXml) {
  const today = new Date().toISOString().slice(0, 10);

  // Split around the auto-generated blocks so we only touch the static parts
  const dynamicBlockRe =
    /(<!--\s*(?:PRODUCTS|BLOG)_START[\s\S]*?<!--\s*(?:PRODUCTS|BLOG)_END\s*-->)/g;

  const parts = sitemapXml.split(dynamicBlockRe);

  return parts
    .map((part, idx) => {
      // Odd-indexed parts are the captured dynamic blocks — leave untouched
      if (idx % 2 === 1) return part;
      // Even-indexed parts are static sections — update their lastmod dates
      return part.replace(
        /(<lastmod>)\d{4}-\d{2}-\d{2}(<\/lastmod>)/g,
        `$1${today}$2`
      );
    })
    .join('');
}

// ── Inject into sitemap.xml ───────────────────────────────────────────────────

function injectSection(sitemapXml, startMarkerRegex, endMarkerRegex, fullRegex, newXml, fallbackAnchor) {
  if (startMarkerRegex.test(sitemapXml) && endMarkerRegex.test(sitemapXml)) {
    return sitemapXml.replace(fullRegex, newXml);
  }
  // Fallback: inject before the closing tag
  return sitemapXml.replace(fallbackAnchor, newXml + '\n' + fallbackAnchor);
}

function injectProductEntries(sitemapXml, productXml) {
  // Replace static TIER 4 product block with the dynamic one
  // Matches everything from the TIER 4 comment down to (but not including) TIER 5
  const tier4Block = /[ \t]*<!-- ═+[^>]*?TIER 4[^>]*-->[\s\S]*?(?=[ \t]*<!-- ═+[^>]*?TIER 5|<!-- BLOG_START|<\/urlset)/;
  if (tier4Block.test(sitemapXml)) {
    return sitemapXml.replace(tier4Block, productXml + '\n\n  ');
  }
  // If PRODUCTS_START/END markers already exist, replace between them
  const startRe = /[ \t]*<!-- PRODUCTS_START[^>]*-->/;
  const endRe = /<!-- PRODUCTS_END -->/;
  const fullRe = /[ \t]*<!-- PRODUCTS_START[\s\S]*?<!-- PRODUCTS_END -->/;
  if (startRe.test(sitemapXml) && endRe.test(sitemapXml)) {
    return sitemapXml.replace(fullRe, productXml);
  }
  // Last resort: inject before </urlset>
  return sitemapXml.replace('</urlset>', productXml + '\n</urlset>');
}

function injectBlogEntries(sitemapXml, blogXml) {
  const startMarker = /[ \t]*<!--\s*BLOG_START[^>]*-->/;
  const endMarker   = /<!--\s*BLOG_END\s*-->/;
  if (startMarker.test(sitemapXml) && endMarker.test(sitemapXml)) {
    return sitemapXml.replace(
      /[ \t]*<!--\s*BLOG_START[^>]*-->[\s\S]*?<!--\s*BLOG_END\s*-->/,
      blogXml
    );
  }
  return sitemapXml.replace('</urlset>', blogXml + '\n</urlset>');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let products, slugs;

  try {
    [products, slugs] = await Promise.all([fetchAllProducts(), fetchAllBlogSlugs()]);
  } catch (err) {
    console.warn(`[sitemap] WARNING: Failed to fetch data — ${err.message}`);
    console.warn('[sitemap] Skipping sitemap update. Last committed sitemap preserved.');
    process.exit(0);
  }

  let existing;
  try {
    existing = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  } catch {
    console.warn('[sitemap] WARNING: Could not read sitemap.xml. Skipping.');
    process.exit(0);
  }

  let updated = existing;

  if (products.length > 0) {
    const productXml = buildProductEntries(products);
    updated = injectProductEntries(updated, productXml);
    console.log(`[sitemap] ✓ Injected ${products.length} product URL(s).`);
  } else {
    console.log('[sitemap] No active products found. Product URLs unchanged.');
  }

  if (slugs.length > 0) {
    const blogXml = buildBlogEntries(slugs);
    updated = injectBlogEntries(updated, blogXml);
    console.log(`[sitemap] ✓ Injected ${slugs.length} blog URL(s).`);
  } else {
    console.log('[sitemap] No published blog posts found. Blog URLs unchanged.');
  }

  // Sanity check
  if (!updated || !updated.includes('<url>')) {
    console.warn('[sitemap] WARNING: Sitemap injection produced an invalid result. Skipping write.');
    process.exit(0);
  }

  // Refresh lastmod dates on static hand-coded sections to today
  updated = refreshStaticLastmods(updated);
  console.log('[sitemap] ✓ Refreshed lastmod dates on static URL entries.');

  // Atomic write
  fs.writeFileSync(SITEMAP_TMP, updated, 'utf-8');
  fs.renameSync(SITEMAP_TMP, SITEMAP_PATH);
  console.log('[sitemap] ✓ sitemap.xml updated successfully.');
}

main().catch(err => {
  console.warn(`[sitemap] WARNING: Unexpected error — ${err.message}`);
  console.warn('[sitemap] Build will continue. Last committed sitemap preserved.');
  try { fs.unlinkSync(SITEMAP_TMP); } catch { /* already gone */ }
  process.exit(0);
});
