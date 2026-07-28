import { isBot, renderProductHtml } from './seoUtils.js';

// Cache for bot rendered HTML
const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * fetchWithTimeout: wraps fetch() with an AbortController timeout.
 * Cloudflare Workers have a 30s CPU limit. Without a timeout, a hung
 * Render backend (e.g. cold start taking 25s) will silently consume
 * almost the entire budget and leave no time for response processing.
 * @param {string} url
 * @param {number} timeoutMs - milliseconds before aborting (default 25s, sized for Render free-tier cold starts)
 */
async function fetchWithTimeout(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // BUG FIX 1: Sitemap must bypass the kill-switch — it is always valid public content.
    // Moving it before the kill-switch check so it is always served correctly.
    if (pathname === '/sitemap.xml') {
      return handleSitemap(env);
    }

    // 1. Check if SEO rendering is enabled (kill-switch)
    if (env.SEO_BOT_RENDER_ENABLED !== 'true') {
      return fetch(request); // Fall through to origin
    }

    // 2. Only intercept for bots
    if (!isBot(request)) {
      return fetch(request);
    }

    // 3. Handle Product pages
    if (pathname.startsWith('/product/')) {
      // BUG FIX 2: pathname.split('/')[2] can return an empty string for trailing
      // slashes (e.g. /product//), and could theoretically include encoded chars.
      // Sanitize by trimming and decoding the segment.
      const rawPid = pathname.split('/')[2];
      const pid = rawPid ? decodeURIComponent(rawPid).trim() : null;
      if (pid) {
        return handleProduct(pid, request, env, ctx);
      }
    }

    // For now, only product pages and sitemap are handled.
    // Shop / collection / blog handling can be added similarly.
    return fetch(request);
  }
};

async function handleProduct(pid, request, env, ctx) {
  try {
    const now = Date.now();
    // NOTE: Cloudflare Workers in-memory cache (Map) is per-isolate.
    // An isolate may be recycled at any time, so this cache is best-effort
    // and will restart empty. It still protects against burst crawl spikes
    // within a single isolate's lifetime. For persistent caching across all
    // edge nodes, Cloudflare KV would be needed.
    const cached = cache.get(pid);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Cache': 'HIT',
        }
      });
    }

    const apiUrl = env.API_BASE_URL || 'https://bodilicious.onrender.com';
    const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';
    
    const res = await fetchWithTimeout(`${apiUrl}/api/v1/products/${pid}`);
    
    if (res.status === 404) {
      return new Response(
        '<!doctype html><html lang="en"><head><title>Product Not Found — Bodilicious</title><meta name="robots" content="noindex, nofollow"></head><body>Not Found</body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
      );
    }
    
    if (!res.ok) {
      // Fall through to origin on API error (graceful degradation)
      return fetch(request);
    }

    const data = await res.json();
    if (!data.success || !data.data) {
      return new Response(
        '<!doctype html><html lang="en"><head><title>Product Not Found — Bodilicious</title><meta name="robots" content="noindex, nofollow"></head><body>Not Found</body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
      );
    }

    const html = renderProductHtml(data.data, frontendUrl);
    
    // Update cache
    cache.set(pid, { html, expiresAt: now + TTL_MS });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      }
    });

  } catch (error) {
    // Distinguish timeouts from real errors for easier debugging in Cloudflare logs
    if (error.name === 'AbortError') {
      console.error(`[SEO Worker] Timeout fetching product ${pid} — Render backend may be cold-starting`);
    } else {
      console.error(`[SEO Worker] Error fetching product ${pid}:`, error.message);
    }
    // On any error, fall through to origin (graceful degradation)
    return fetch(request);
  }
}

async function handleSitemap(env) {
  try {
    const apiUrl = env.API_BASE_URL || 'https://bodilicious.onrender.com';
    const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';

    // BUG FIX A: `inStock=false` means "only OUT OF STOCK items" in the API
    // (see controller.js L110-114: inStock=false sets stock:0).
    // We want ALL active products regardless of stock. Remove inStock param entirely.
    // The API's default query already enforces isActive:true.
    //
    // BUG FIX B: The backend hard-caps limit at 100 (controller.js L139).
    // limit=1000 would silently return only 100 products, truncating the sitemap.
    // We paginate across all pages to collect every active product.
    let allProducts = [];
    let page = 1;
    const PAGE_SIZE = 100;
    let totalPages = 1;

    // Safety cap: never fetch more than 50 pages (5000 products).
    // Prevents infinite loops if API returns malformed totalPages.
    const MAX_PAGES = 50;

    do {
      let res;
      try {
        res = await fetchWithTimeout(`${apiUrl}/api/v1/products?limit=${PAGE_SIZE}&page=${page}`);
      } catch (pageError) {
        // Timeout or network error on a single page — stop paginating but
        // use whatever products we've already collected rather than returning 500.
        console.error(`[SEO Worker] Sitemap page ${page} fetch failed:`, pageError.name);
        break;
      }
      if (!res.ok) break; // Non-200 on a page — stop, use what we have
      const data = await res.json();
      const products = data.data || [];
      // Stop early if we got an empty page (guards against malformed totalPages)
      if (products.length === 0) break;
      allProducts = allProducts.concat(products);
      totalPages = data.totalPages || 1;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);

    const urls = [];
    
    // Add static routes
    const staticRoutes = ['/', '/shop', '/about', '/brand-story', '/contact', '/faq'];
    staticRoutes.forEach(route => {
      urls.push(`
  <url>
    <loc>${frontendUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`);
    });

    // Add active products — filter out Discontinued on our side
    // (isActive:false products are already excluded by the API default query)
    allProducts.forEach(p => {
      if (p.availability !== 'Discontinued') {
        const lastmod = p.updatedAt ? p.updatedAt.substring(0, 10) : new Date().toISOString().substring(0, 10);
        urls.push(`
  <url>
    <loc>${frontendUrl}/product/${p.pid}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);
      }
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      }
    });

  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
    return new Response('Error generating sitemap', {
      status: 500,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    });
  }
}
