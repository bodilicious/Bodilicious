import {
  isBot,
  renderProductHtml,
  renderShopHtml,
  renderHomeHtml,
  renderBlogHtml,
  rewriteBlogIndex,
  rewriteStaticMeta,
  STATIC_PAGE_SEO,
  SITEMAP_CATEGORIES,
  SITEMAP_CONCERNS,
  SITEMAP_TYPES,
  getLegacyShopifyAction,
  stripHtml,
} from './seoUtils.js';

// Cache for bot rendered HTML
const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Security headers ────────────────────────────────────────────────────────
// Applied to every response this worker returns, including the ones proxied
// straight through from the Render origin — this worker is the actual public
// edge for bodilicious.in, so it's the only place that can guarantee these
// land on every request regardless of what the origin sends.
//
// CSP ships as Content-Security-Policy-Report-Only for now: the site depends
// on Firebase Auth (Google sign-in popup), Razorpay Checkout (script + modal
// iframe), and PostHog analytics, none of which could be exercised end-to-end
// in the environment this policy was written in. Report-Only logs violations
// to the browser console without blocking anything, so it's safe to ship
// immediately — watch the console on sign-in and a real checkout, fix any
// gaps, then switch the header name to the enforcing `Content-Security-Policy`.
//
// script-src's hash covers the single static inline <script> in index.html
// (the gtag bootstrap snippet). If that snippet's contents ever change, this
// hash must be recomputed — see frontend/index.html for the source.
const GTAG_INLINE_SCRIPT_HASH = "'sha256-0ZKCLuJt1ufyFVMehULEakKDT1sqnq7/wqcAONtkfw8='";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  `script-src 'self' ${GTAG_INLINE_SCRIPT_HASH} https://www.googletagmanager.com https://analytics.ahrefs.com https://checkout.razorpay.com https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.razorpay.com https://*.gstatic.com https://images.pexels.com",
  "connect-src 'self' https://bodilicious-cxow.onrender.com https://bodilicious-front.onrender.com https://us.i.posthog.com https://*.posthog.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com https://analytics.ahrefs.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
  "frame-src https://checkout.razorpay.com https://api.razorpay.com https://www.instagram.com https://accounts.google.com https://*.firebaseapp.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Only these two named policies are allowed to wrap strings as Trusted
  // Types — see frontend/src/utils/trustedTypes.ts for where they're created
  // and what they guard (sanitized blog HTML, the Razorpay script URL).
  'trusted-types dompurify-html razorpay-script',
  "require-trusted-types-for 'script'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * Long-lived Cache-Control for static build output and public assets, keyed
 * off the URL path alone (works for both bot-rendered and proxied-origin
 * responses). Two tiers:
 *  - Vite's own /assets/*.js and *.css are content-hashed by the build (the
 *    filename changes whenever the content does), so they're safe to cache
 *    "forever" — a stale copy can never be served because a content change
 *    always ships under a new URL.
 *  - Everything else static (webp/png/svg/ico/font files, e.g. the homepage
 *    category banners and /logo.webp) is served from /public under a FIXED
 *    filename, so a long-but-bounded cache is used instead: if someone swaps
 *    that file's contents without renaming it, this is how long browsers can
 *    keep showing the old one.
 * Anything else (HTML, API responses, XML feeds) is left untouched.
 */
function getStaticCacheControl(pathname) {
  // Matches any file directly under /assets/ (no further subdirectory) — every
  // .js/.css there is Vite build output; nothing hand-placed lives at that
  // level (verified against frontend/public/assets, which only has
  // subdirectories like banners/ and payment-badges/, never loose .js/.css).
  // Deliberately NOT trying to pattern-match the hash itself: Vite's hash
  // alphabet includes '-' and '_' (e.g. "CustomerDetails-CezoLDY-.js"), which
  // made an earlier, stricter version of this regex silently fail to match.
  if (/^\/assets\/[^/]+\.(js|css)$/.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/\.(webp|png|jpe?g|avif|gif|svg|ico|woff2?)$/i.test(pathname)) {
    return 'public, max-age=2592000'; // 30 days
  }
  return null;
}

/**
 * Clones `response` and layers security + cache headers onto it without
 * touching status/body. Applied once, right before the worker's fetch
 * handler returns, so every code path (bot-rendered HTML, proxied origin
 * responses, XML feeds, 404s) gets the same treatment.
 */
function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy-Report-Only', CSP_DIRECTIVES);
  // same-origin-allow-popups (not the stricter same-origin) because Firebase's
  // Google sign-in popup relies on window.opener communication between this
  // page and the popup — same-origin would silently break that flow.
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // Belt-and-braces with frame-ancestors above, and — unlike the CSP directive
  // above — enforced immediately: nothing on this site legitimately needs to
  // be iframed, so this is zero-risk to turn on now.
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (response.status === 200 || response.status === 206) {
    const cacheControl = getStaticCacheControl(pathname);
    if (cacheControl) headers.set('Cache-Control', cacheControl);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

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
    const response = await route(request, env, ctx);
    return withSecurityHeaders(response, new URL(request.url).pathname);
  }
};

async function route(request, env, ctx) {
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

    // fetchFromOriginNoCache: used exclusively as a graceful-degradation fallback
    // inside bot-render handlers (handleBlog, handleProduct, handleShop, handleHome).
    // When the API is unavailable (cold start timeout, non-200, JSON parse error),
    // the handler falls back to serving the Render origin's SPA shell. That shell
    // contains the hardcoded homepage canonical — if Cloudflare cached it at
    // max-age=300 (the CDN s-maxage on normal responses), Googlebot would read the
    // wrong canonical for up to 5 minutes on every subsequent request.
    // Cache-Control: no-store prevents that: the CDN will always revalidate on the
    // next crawl, giving the bot-render a fresh shot once the backend wakes up.
    const fetchFromOriginNoCache = async () => {
      const originRes = await fetchFromOrigin();
      const headers = new Headers(originRes.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(originRes.body, {
        status: originRes.status,
        statusText: originRes.statusText,
        headers,
      });
    };

    // Trailing-slash redirect — must run before every other handler and for ALL
    // requests (not just bots). Without this, /blogs/slug/ and /blogs/slug both
    // return 200 with identical content. The slug/ version declares canonical as
    // /slug (no slash), so Google sees two live pages and marks the trailing-slash
    // one as "Alternate page with proper canonical tag" — which blocks indexing.
    // A permanent 301 collapses both URLs to one signal in Google's index.
    if (pathname !== '/' && pathname.endsWith('/')) {
      const canonical = new URL(request.url);
      canonical.pathname = pathname.slice(0, -1); // strip exactly one trailing slash
      return Response.redirect(canonical.toString(), 301);
    }

    // BUG FIX 1: Sitemap must bypass the kill-switch — it is always valid public content.
    if (pathname === '/sitemap.xml') {
      return handleSitemap(env);
    }

    // Legacy Shopify URLs (this domain ran a Shopify store before this site).
    // Runs for every request — not gated by the bot kill-switch/isBot check
    // below — so a human who clicks a stale /products/ or /collections/
    // search result lands on the right page too, not just crawlers. See
    // getLegacyShopifyAction() in seoUtils.js for why this exists.
    const legacyAction = getLegacyShopifyAction(pathname);
    if (legacyAction) {
      const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';
      if (legacyAction.type === 'redirect') {
        return Response.redirect(`${frontendUrl}${legacyAction.to}`, 301);
      }
      return new Response(
        '<!doctype html><html lang="en"><head><title>Gone</title><meta name="robots" content="noindex, nofollow"></head><body>This resource no longer exists.</body></html>',
        { status: 410, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
      );
    }

    // Google Merchant Center product feed — must bypass the kill-switch for the
    // same reason as the sitemap: Merchant Center's fetcher isn't in BOT_UA_PATTERNS
    // and this is always valid public content regardless of bot-render state.
    if (pathname === '/product-feed.xml') {
      return handleProductFeed(env);
    }

    // 1. Check if SEO rendering is enabled (kill-switch)
    if (env.SEO_BOT_RENDER_ENABLED !== 'true') {
      return fetchFromOrigin(); 
    }

    // 2. Only intercept for bots — humans always get the real SPA.
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
        return handleProduct(pid, request, env, ctx, fetchFromOriginNoCache);
      }
    }

    // 3b. Handle Blog posts. Without this, every /blogs/<slug> request from a
    // crawler fell through to the SPA shell and returned the homepage title and
    // description. Google eventually renders the JS, but social unfurlers
    // (facebookexternalhit, whatsapp, twitterbot, linkedinbot — all matched by
    // BOT_UA_PATTERNS) never do, so every shared article link previewed as the
    // generic homepage card.
    if (pathname.startsWith('/blogs/')) {
      const rawSlug = pathname.split('/')[2];
      const slug = rawSlug ? decodeURIComponent(rawSlug).trim() : null;
      if (slug) {
        return handleBlog(slug, request, env, ctx, fetchFromOriginNoCache);
      }
    }

    // 3c. Blog index — correct metadata plus an ItemList of every post.
    if (pathname === '/blogs' && !url.search) {
      return handleBlogIndex(request, env, fetchFromOrigin);
    }

    // 3d(i). Homepage — was never intercepted at all, so any bot (even ones
    // on the isBot() allowlist) got the bare <div id="root"></div> SPA shell.
    // The single highest-traffic entry point on the site.
    if (pathname === '/' && !url.search) {
      return handleHome(request, env, ctx, fetchFromOriginNoCache);
    }

    // 3d. Remaining static content pages. These fell through to the SPA shell,
    // so every one of them returned the homepage title and description to any
    // client that doesn't execute JavaScript — meaning every social share of
    // /about, /contact or a policy page previewed as the homepage.
    //
    // These stream the ORIGIN response through HTMLRewriter rather than
    // returning a synthesised page: the real copy lives in React components,
    // and replacing the body would both serve crawlers less than users see and
    // stop Google rendering the JS that contains the actual content.
    if (STATIC_PAGE_SEO[pathname]) {
      const originResponse = await fetchFromOrigin();
      const contentType = originResponse.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return originResponse;
      return rewriteStaticMeta(
        originResponse,
        pathname,
        env.FRONTEND_URL || 'https://bodilicious.in'
      );
    }

    // 4. Handle Shop / category filter pages — these were previously served as
    // plain index.html to bots, causing Google to read the hardcoded homepage
    // canonical and ignore the facet page entirely.
    if (pathname === '/shop' || pathname === '/shop/') {
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
        return handleShop({ category, type, concern }, request, env, ctx, fetchFromOriginNoCache);
      }
    }

    // For everything else, pass through to origin.
    return fetchFromOrigin();
}

/**
 * Bot renderer for "/". No facets to key the cache on, so a single fixed key.
 * Products are ranked by rating*ratingCount as a proxy for "best sellers" —
 * the API doesn't expose a dedicated bestseller flag, so this is the closest
 * honest signal available without inventing one.
 */
async function handleHome(request, env, ctx, fetchFromOriginNoCache) {
  try {
    const now = Date.now();
    const cacheKey = 'home';
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

    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
    const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';

    let products = [];
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/v1/products?slim=true&limit=24`);
      if (res.ok) {
        const data = await res.json();
        products = (data.data || data.products || [])
          .filter(p => p.isActive !== false)
          .sort((a, b) => (Number(b.rating || 0) * Number(b.ratingCount || 0)) - (Number(a.rating || 0) * Number(a.ratingCount || 0)))
          .slice(0, 12);
      }
    } catch (_) {
      // API down — still render the page with brand copy and nav; better than nothing
    }

    const html = renderHomeHtml(products, frontendUrl);
    cache.set(cacheKey, { html, expiresAt: now + TTL_MS });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      }
    });
  } catch (error) {
    console.error('[SEO Worker] Error rendering homepage:', error.message);
    return fetchFromOriginNoCache();
  }
}

async function handleShop({ category, type, concern }, request, env, ctx, fetchFromOriginNoCache) {
  try {
    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
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
    return fetchFromOriginNoCache();
  }
}

async function handleProduct(pid, request, env, ctx, fetchFromOriginNoCache) {
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

    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
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
      // no-store: don't let the CDN cache this degraded SPA shell response
      return fetchFromOriginNoCache();
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
    // no-store: don't let the CDN cache the degraded SPA shell response
    return fetchFromOriginNoCache();
  }
}

/**
 * Bot renderer for /blogs/<slug>. Mirrors handleProduct: per-isolate cache,
 * 404 for unknown slugs, and graceful fall-through to origin on any API error
 * so a backend hiccup degrades to the SPA rather than serving a broken page.
 */
async function handleBlog(slug, request, env, ctx, fetchFromOriginNoCache) {
  try {
    const now = Date.now();
    const cacheKey = `blog:${slug}`;
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

    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
    const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';

    const res = await fetchWithTimeout(`${apiUrl}/api/v1/blogs/${encodeURIComponent(slug)}`);

    const notFound = () => new Response(
      '<!doctype html><html lang="en"><head><title>Article Not Found — Bodilicious</title><meta name="robots" content="noindex, nofollow"></head><body>Not Found</body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
    );

    if (res.status === 404) return notFound();
    if (!res.ok) return fetchFromOriginNoCache();

    const data = await res.json();
    const post = data.data || data.blog;
    if (!data.success || !post) return notFound();

    // Never let an unpublished draft into the index, even if the API returns it.
    if (post.status && post.status !== 'published') return notFound();

    const html = renderBlogHtml(post, frontendUrl);
    cache.set(cacheKey, { html, expiresAt: now + TTL_MS });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      }
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[SEO Worker] Timeout fetching blog ${slug} — Render backend may be cold-starting`);
    } else {
      console.error(`[SEO Worker] Error fetching blog ${slug}:`, error.message);
    }
    // no-store: don't let the CDN cache the degraded SPA shell response
    return fetchFromOriginNoCache();
  }
}

/**
 * Blog index: rewrite the origin page's metadata and append an ItemList.
 * The post list itself is not cached here because the response is a stream
 * transform of the origin, not a synthesised string.
 */
async function handleBlogIndex(request, env, fetchFromOrigin) {
  const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';
  try {
    const originResponse = await fetchFromOrigin();
    const contentType = originResponse.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return originResponse;

    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
    let posts = [];
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/v1/blogs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        posts = (data.data || data.blogs || []).filter(p => p && p.slug);
      }
    } catch (apiErr) {
      // Metadata rewrite is still worth doing without the ItemList.
      console.error('[SEO Worker] Blog index list fetch failed:', apiErr.name);
    }

    return rewriteBlogIndex(originResponse, posts, frontendUrl);
  } catch (error) {
    console.error('[SEO Worker] Blog index rewrite failed:', error.message);
    return fetchFromOrigin();
  }
}

async function handleSitemap(env) {
  try {
    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
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

    // NOTE: /shop facet URLs (/shop?category=, /shop?type=, /shop?concern=) are
    // intentionally excluded from the sitemap.
    // ShopPage.tsx sets canonical=/shop for all multi-filter combos and dynamically
    // self-canonicalizes single-facet URLs — but Googlebot sees the sitemap entry
    // BEFORE it renders JS, so it reads the facet URL as a unique page while the
    // canonical (set via JS) points back to /shop. Google resolves the conflict by
    // marking the facet page "non-canonical" — exactly the Ahrefs error we were seeing.
    // All facet traffic is captured through /shop.

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

// ─── Google Merchant Center product feed ───────────────────────────────────
// Free listings (the "Popular products" carousel in normal Search, not paid
// Shopping ads) are populated from a feed submitted in Merchant Center, not
// from the on-page Product schema alone. This is that feed, in the RSS 2.0 +
// g: namespace format Merchant Center expects. Once live, submit
// https://bodilicious.in/product-feed.xml under Products > Feeds in Merchant
// Center Next (scheduled fetch, e.g. daily).
// Per-`category` FALLBACK only. The accurate value is the product's own
// `google_product_category` (set by scripts/fix_product_taxonomy.js); this map
// covers products created since that ran which nobody has classified yet.
//
// Every string here must be an exact node in Google's taxonomy —
// https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt —
// because Merchant Center drops the attribute on an unrecognised value and
// falls back to auto-classification. The previous `body` entry, "… > Skin Care
// > Body Care", was not a real node, so every soap and body wash in the feed
// was being shipped with an invalid category.
const GOOGLE_PRODUCT_CATEGORY = {
  skin: 'Health & Beauty > Personal Care > Cosmetics > Skin Care',                     // 567
  hair: 'Health & Beauty > Personal Care > Hair Care',                                 // 486
  body: 'Health & Beauty > Personal Care > Cosmetics > Bath & Body',                   // 474
  makeup: 'Health & Beauty > Personal Care > Cosmetics > Makeup',                      // 477
  // `lip` is lip BALM, which Google files under Skin Care, not Makeup. Lipstick
  // lives in the `makeup` category and carries its own per-product override.
  lip: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Lip Balms & Treatments', // 482
  other: 'Health & Beauty > Personal Care',                                            // 2915
};

/** Our own taxonomy breadcrumb for <g:product_type>, e.g. "Skin > Serum > Face Serum". */
function buildFeedProductType(p) {
  const titleCase = (s) => String(s)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return [p.category, p.sub_category, p.product_type]
    .filter(Boolean)
    .map(titleCase)
    // Drop adjacent levels that say the same thing, ignoring punctuation and
    // spacing — sub_category "face_body_wash" and product_type "Face & Body
    // Wash" are the same level twice, and "Body > Face Body Wash > Face & Body
    // Wash" reads as a broken breadcrumb in Merchant Center.
    // Of a duplicated pair we keep the LATER one: product_type is the
    // hand-written label ("Face & Body Wash"), sub_category the slug-derived
    // one ("Face Body Wash").
    .filter((seg, i, arr) => {
      if (i === arr.length - 1) return true;
      const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      return key(seg) !== key(arr[i + 1]);
    })
    .join(' > ');
}

function escapeXml(unsafe) {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function handleProductFeed(env) {
  try {
    const apiUrl = env.API_BASE_URL || 'https://bodilicious-cxow.onrender.com';
    const frontendUrl = env.FRONTEND_URL || 'https://bodilicious.in';

    // Same pagination approach as handleSitemap: the API hard-caps limit at 100
    // per page, so a single request would silently truncate the catalog.
    let allProducts = [];
    let page = 1;
    const PAGE_SIZE = 100;
    let totalPages = 1;
    const MAX_PAGES = 50;

    do {
      let res;
      try {
        res = await fetchWithTimeout(`${apiUrl}/api/v1/products?limit=${PAGE_SIZE}&page=${page}`);
      } catch (pageError) {
        console.error(`[SEO Worker] Product feed page ${page} fetch failed:`, pageError.name);
        break;
      }
      if (!res.ok) break;
      const data = await res.json();
      const products = data.data || [];
      if (products.length === 0) break;
      allProducts = allProducts.concat(products);
      totalPages = data.totalPages || 1;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);

    // NOTE: the products list endpoint's projection (controller.js getAllProducts)
    // doesn't return the `availability` enum field, only `stock` — so derive
    // in-stock/out-of-stock from stock count rather than the (always-undefined) field.
    const items = allProducts
      .filter(p => p.price != null && Array.isArray(p.images) && p.images.length > 0)
      // scripts/seed_test_order.js seeds an active "QA Test Serum" at ₹1499 with
      // a placehold.co image whenever QA runs, and it is a normal active product
      // as far as the API is concerned. A placeholder image is a Merchant Center
      // disapproval and counts against account quality, so keep test fixtures out
      // of the feed rather than relying on someone remembering --cleanup.
      .filter(p => !/^https?:\/\/([^/]*\.)?placehold\.co\//i.test(p.images[0] || '') && !/^qa-/i.test(p.pid || ''))
      .map(p => {
        const availability = Number(p.stock) > 0 ? 'in stock' : 'out of stock';
        // Per-product classification wins; the category map is only a backstop
        // for products created after the taxonomy migration ran.
        const googleCategory = (p.google_product_category || '').trim()
          || GOOGLE_PRODUCT_CATEGORY[p.category]
          || GOOGLE_PRODUCT_CATEGORY.other;
        const ownProductType = buildFeedProductType(p);
        const productTypeTag = ownProductType
          ? `\n    <g:product_type>${escapeXml(ownProductType)}</g:product_type>`
          : '';
        const toAbsolute = (img) => (img.startsWith('http') ? img : `${frontendUrl}${img}`);
        const [primaryImage, ...restImages] = p.images;
        const extraImageTags = restImages
          .slice(0, 10)
          .map((img) => `\n    <g:additional_image_link>${escapeXml(toAbsolute(img))}</g:additional_image_link>`)
          .join('');

        // Editorial seo_title/seo_description win when set — same override
        // pattern as the on-page/bot-rendered title (frontend/src/utils/seo.ts),
        // so a compliance fix made there actually reaches the Shopping feed too.
        // description is Tiptap HTML; strip tags rather than dumping raw markup
        // (as literal "&lt;p&gt;" text) into a field Merchant Center expects as
        // plain prose.
        const feedTitle = (p.seo_title || p.name || '').trim();
        const feedDescription = (p.seo_description || '').trim()
          || stripHtml(p.description || '').trim()
          || feedTitle;

        return `
  <item>
    <g:id>${escapeXml(p.pid)}</g:id>
    <title>${escapeXml(feedTitle)}</title>
    <description>${escapeXml(feedDescription)}</description>
    <link>${frontendUrl}/product/${escapeXml(p.pid)}</link>
    <g:image_link>${escapeXml(toAbsolute(primaryImage))}</g:image_link>${extraImageTags}
    <g:availability>${availability}</g:availability>
    <g:price>${Number(p.price).toFixed(2)} INR</g:price>
    <g:brand>${escapeXml(p.brand || 'Bodilicious')}</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
    <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>${productTypeTag}
  </item>`;
      })
      .join('');

    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Bodilicious Product Feed</title>
  <link>${frontendUrl}</link>
  <description>Bodilicious skincare, hair, and body care products</description>${items}
</channel>
</rss>`;

    return new Response(feed, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      }
    });

  } catch (error) {
    console.error('Error generating product feed:', error);
    return new Response('Error generating product feed', {
      status: 500,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    });
  }
}
