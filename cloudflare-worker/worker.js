import {
  isBot,
  renderProductHtml,
  renderShopHtml,
  SITEMAP_CATEGORIES,
  SITEMAP_CONCERNS,
  SITEMAP_TYPES,
} from './seoUtils.js';

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

    // Helper to bypass Cloudflare Orange-to-Orange conflict by fetching the raw Render URL
    const fetchFromOrigin = () => {
      const originUrl = new URL(request.url);
      originUrl.hostname = 'bodilicious-front.onrender.com';
      // Create a new request to avoid mutating the original
      const modifiedRequest = new Request(originUrl, request);
      // Ensure we don't pass Cloudflare headers that might confuse Render's Cloudflare
      modifiedRequest.headers.delete('cf-connecting-ip');
      return fetch(modifiedRequest);
    };

    // BUG FIX 1: Sitemap must bypass the kill-switch — it is always valid public content.
    if (pathname === '/sitemap.xml') {
      return handleSitemap(env);
    }

    // 1. Check if SEO rendering is enabled (kill-switch)
    if (env.SEO_BOT_RENDER_ENABLED !== 'true') {
      return fetchFromOrigin(); 
    }

    // 2. Only intercept for bots
    if (!isBot(request)) {
      return fetchFromOrigin();
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

    // 4. Handle Shop / category filter pages — these were previously served as
    // plain index.html to bots, causing Google to read the hardcoded homepage
    // canonical and ignore the facet page entirely.
    if (pathname === '/shop') {
      const category = url.searchParams.get('category');
      const type = url.searchParams.get('type');
      const concern = url.searchParams.get('concern');
      // Only intercept single-facet URLs (what the sitemap targets).
      // Multi-param or no-param requests fall through to origin.
      const facetCount = [category, type, concern].filter(Boolean).length;
      const hasOtherParams = url.searchParams.has('search') || url.searchParams.has('sort')
        || url.searchParams.has('ingredient') || url.searchParams.has('priceMin')
        || url.searchParams.has('priceMax') || url.searchParams.has('sub_category')
        || (url.searchParams.get('page') && url.searchParams.get('page') !== '1');
      if (facetCount <= 1 && !hasOtherParams) {
        return handleShop({ category, type, concern }, request, env, ctx);
      }
    }

    // For everything else, pass through to origin.
    return fetchFromOrigin();
  }
};

async function handleShop({ category, type, concern }, request, env, ctx) {
  try {
    const apiUrl = env.API_BASE_URL || 'https://bodilicious.onrender.com';
    const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';

    // Build the cache key from the active facet
    const cacheKey = `shop:${category || ''}:${type || ''}:${concern || ''}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Cache': 'HIT',
        }
      });
    }

    // Fetch filtered products from the API
    const params = new URLSearchParams({ limit: '30' });
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    if (concern) params.set('concern', concern);

    let products = [];
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/v1/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        products = data.data || [];
      }
    } catch (_) {
      // If API is down, render the page with an empty product list — still serves correct canonical
    }

    const html = renderShopHtml({ category, type, concern }, products, frontendUrl);
    cache.set(cacheKey, { html, expiresAt: now + TTL_MS });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      }
    });
  } catch (error) {
    console.error(`[SEO Worker] Error rendering shop page:`, error.message);
    return fetch(request);
  }
}

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

    // Add static routes.
    // NOTE: this list previously contained '/faq', which is not a route — the app
    // serves '/faqs' (see App.tsx). It also omitted every legal//info page, so
    // those were never submitted to Google.
    const staticRoutes = [
      '/', '/shop', '/about', '/brand-story', '/contact', '/faqs',
      '/blogs', '/offers', '/how-to-order', '/ritual-finder',
      '/terms', '/privacy', '/shipping-refund',
    ];
    const LOW_PRIORITY = new Set(['/terms', '/privacy', '/shipping-refund']);
    staticRoutes.forEach(route => {
      const priority = route === '/' ? '1.0' : LOW_PRIORITY.has(route) ? '0.3' : '0.8';
      urls.push(`
  <url>
    <loc>${frontendUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`);
    });

    // Add /shop facet landing pages — handleShop() already renders bot HTML for
    // each of these, but without sitemap entries crawlers had no way to find them.
    const facets = [
      ...SITEMAP_CATEGORIES.map(v => ['category', v]),
      ...SITEMAP_TYPES.map(v => ['type', v]),
      ...SITEMAP_CONCERNS.map(v => ['concern', v]),
    ];
    facets.forEach(([key, value]) => {
      urls.push(`
  <url>
    <loc>${frontendUrl}/shop?${key}=${encodeURIComponent(value)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
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

    // Add published blog posts. These were absent from the worker sitemap
    // entirely — the only generator that knew about them wrote to the static
    // public/sitemap.xml, which this route shadows and therefore never serves.
    // A blog-API failure must not fail the whole sitemap, so this is best-effort.
    try {
      let blogPage = 1;
      let blogTotalPages = 1;
      do {
        const blogRes = await fetchWithTimeout(
          `${apiUrl}/api/v1/blogs?limit=${PAGE_SIZE}&page=${blogPage}`
        );
        if (!blogRes.ok) break;
        const blogData = await blogRes.json();
        const posts = blogData.data || blogData.blogs || [];
        if (posts.length === 0) break;
        posts.forEach(post => {
          if (!post.slug) return;
          const lastmod = (post.updatedAt || post.publishedAt || '').substring(0, 10)
            || new Date().toISOString().substring(0, 10);
          urls.push(`
  <url>
    <loc>${frontendUrl}/blogs/${encodeURIComponent(post.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>`);
        });
        blogTotalPages = blogData.totalPages || 1;
        blogPage++;
      } while (blogPage <= blogTotalPages && blogPage <= MAX_PAGES);
    } catch (blogError) {
      console.error('[SEO Worker] Blog sitemap fetch failed:', blogError.name);
    }

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
