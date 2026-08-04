#!/usr/bin/env node
/**
 * generate-sitemap.js
 *
 * ⚠️  THIS FILE NO LONGER PRODUCES THE LIVE SITEMAP.
 *
 * cloudflare-worker/worker.js intercepts /sitemap.xml and — unlike the bot
 * renderer — that route deliberately bypasses the SEO_BOT_RENDER_ENABLED
 * kill-switch, so the worker ALWAYS answers on bodilicious.in. public/sitemap.xml
 * is only reachable by hitting the Render origin directly, which crawlers do not.
 *
 * The worker now generates the full set (static routes + /shop facets + products
 * + blog posts) dynamically. If you need to add or remove a URL, edit
 * `handleSitemap` in cloudflare-worker/worker.js — changing this file or
 * public/sitemap.xml will have no effect on what Google sees.
 *
 * Kept as an origin-level fallback only.
 *
 * Fetches all published blog posts from the Bodilicious API and injects
 * their URLs into public/sitemap.xml.
 *
 * Safety guarantees:
 *  - Only runs on Render (guarded by process.env.RENDER); skips cleanly otherwise.
 *  - Reads API_URL from process.env (set in Render dashboard), falls back to
 *    parsing the local .env file when running outside Render.
 *  - Validates that the resolved URL is https:// before making any requests.
 *  - On any fetch error: warns and exits 0 (build continues; last-committed
 *    sitemap is preserved).
 *  - Paginates until all published posts are fetched (no fixed-count cliff).
 *  - Writes to sitemap.xml.tmp then renames atomically — a failed fetch never
 *    overwrites the live sitemap with partial or empty content.
 *  - Does NOT modify static page <lastmod> dates; only injects/replaces the
 *    blog section between the BLOG_START / BLOG_END marker comments.
 *  - XML-escapes all string values; URL-encodes all slugs.
 *
 * Required env var (set in Render dashboard):
 *   API_URL=https://bodilicious.onrender.com
 *
 * Local dev usage (optional):
 *   RENDER=true API_URL=https://bodilicious.onrender.com node scripts/generate-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');
const SITEMAP_TMP  = SITEMAP_PATH + '.tmp';

// ── Environment guard ────────────────────────────────────────────────────────
// Only run on actual Render builds. Render injects RENDER=true automatically.
if (!process.env.RENDER) {
  console.log('[sitemap] Not running on Render — skipping sitemap generation.');
  process.exit(0);
}

// ── Resolve API URL ──────────────────────────────────────────────────────────
// On Render: read from process.env.API_URL (set in Render dashboard, no VITE_ prefix).
// Render does NOT write a physical .env file to disk — relying on fs.readFileSync('.env')
// would fail silently. We fall back to parsing .env only for local overrides.
function resolveApiUrl() {
  if (process.env.API_URL) {
    return process.env.API_URL.trim();
  }
  // Local dev fallback: try to read the .env file
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^API_URL\s*=\s*(.+)$/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env not present — that's fine on Render
  }
  return null;
}

const apiUrl = resolveApiUrl();

if (!apiUrl) {
  console.warn('[sitemap] WARNING: API_URL is not set. Add it to the Render dashboard under Environment Variables.');
  console.warn('[sitemap] Skipping sitemap generation — last committed sitemap preserved.');
  process.exit(0);
}

if (!apiUrl.startsWith('https://')) {
  console.warn(`[sitemap] WARNING: API_URL "${apiUrl}" is not an https:// URL.`);
  console.warn('[sitemap] Refusing to generate a sitemap with non-production API URLs.');
  process.exit(0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** XML-escape a string value to prevent invalid XML in the sitemap */
function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** URL-encode a blog slug (handles non-ASCII and special chars) */
function encodeSlug(slug) {
  return encodeURIComponent(String(slug));
}

/** Format a date as YYYY-MM-DD for sitemap lastmod */
function toLastmod(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  return new Date(dateStr).toISOString().slice(0, 10);
}

// ── Fetch all published blog slugs (paginated) ───────────────────────────────

async function fetchAllBlogSlugs() {
  const slugs = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${apiUrl}/api/v1/blogs?page=${page}&limit=100`;
    console.log(`[sitemap] Fetching blog page ${page}/${totalPages === 1 ? '?' : totalPages} from ${url}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(`Blog API returned HTTP ${res.status} for page ${page}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(`Blog API error: ${data.message || 'Unknown error'}`);
    }

    // API filters { status: "published" } server-side — confirmed in backend/blog/controller.js
    for (const post of data.data || []) {
      if (post.slug) {
        slugs.push({ slug: post.slug, publishedAt: post.publishedAt });
      }
    }

    totalPages = data.pages || 1;
    page++;
  }

  console.log(`[sitemap] Fetched ${slugs.length} published blog post(s) across ${totalPages} page(s).`);
  return slugs;
}

// ── Build XML entries for blog posts ─────────────────────────────────────────

function buildBlogEntries(slugs) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `  <!-- BLOG_START — auto-generated by scripts/generate-sitemap.js on ${today} -->`,
  ];

  for (const { slug, publishedAt } of slugs) {
    const loc     = `https://bodilicious.in/blogs/${encodeSlug(slug)}`;
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

// ── Inject into sitemap.xml ───────────────────────────────────────────────────
// The sitemap has marker comments for the blog section:
//   <!-- BLOG_START ... -->
//   <!-- BLOG_END -->
// If markers are absent, the script appends before </urlset>.

function injectBlogEntries(sitemapXml, blogXml) {
  const startMarker = /[ \t]*<!--\s*BLOG_START[^>]*-->/;
  const endMarker   = /<!--\s*BLOG_END\s*-->/;

  if (startMarker.test(sitemapXml) && endMarker.test(sitemapXml)) {
    // Replace everything between (and including) the markers
    return sitemapXml.replace(
      /[ \t]*<!--\s*BLOG_START[^>]*-->[\s\S]*?<!--\s*BLOG_END\s*-->/,
      blogXml
    );
  }

  // Fallback: also matches the existing TIER 4.5 comment placeholder
  const tier45 = /[ \t]*<!--[^>]*TIER 4\.5[^>]*BLOG[^>]*-->[\s\S]*?(?=\s*<!--\s*TIER 5|<\/urlset)/;
  if (tier45.test(sitemapXml)) {
    return sitemapXml.replace(tier45, blogXml + '\n\n');
    }

  // Last resort: inject before closing </urlset>
  return sitemapXml.replace('</urlset>', blogXml + '\n</urlset>');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let slugs;
  try {
    slugs = await fetchAllBlogSlugs();
  } catch (err) {
    console.warn(`[sitemap] WARNING: Failed to fetch blog posts — ${err.message}`);
    console.warn('[sitemap] Skipping sitemap update. Last committed sitemap is preserved.');
    process.exit(0); // Warn-and-skip: build continues unblocked
  }

  if (slugs.length === 0) {
    console.log('[sitemap] No published blog posts found. Sitemap unchanged.');
    process.exit(0);
  }

  // Read existing sitemap
  let existing;
  try {
    existing = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  } catch {
    console.warn('[sitemap] WARNING: Could not read sitemap.xml. Skipping.');
    process.exit(0);
  }

  const blogXml = buildBlogEntries(slugs);
  const updated = injectBlogEntries(existing, blogXml);

  // Sanity check: updated file must be non-empty and contain at least one <url>
  if (!updated || !updated.includes('<url>')) {
    console.warn('[sitemap] WARNING: Sitemap injection produced an invalid result. Skipping atomic write.');
    process.exit(0);
  }

  // Atomic write: write to .tmp first, then rename
  fs.writeFileSync(SITEMAP_TMP, updated, 'utf-8');
  fs.renameSync(SITEMAP_TMP, SITEMAP_PATH);

  console.log(`[sitemap] ✓ sitemap.xml updated with ${slugs.length} blog post URL(s).`);
}

main().catch(err => {
  console.warn(`[sitemap] WARNING: Unexpected error — ${err.message}`);
  console.warn('[sitemap] Build will continue. Last committed sitemap preserved.');
  // Clean up .tmp if it exists
  try { fs.unlinkSync(SITEMAP_TMP); } catch { /* already gone */ }
  process.exit(0); // Warn-and-skip — never block the build
});
