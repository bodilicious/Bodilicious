var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../frontend/src/utils/seo.ts
var BRAND = "Bodilicious";
var MAX_TITLE_LENGTH = 60;
function normaliseKeywordGroups(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [
    ...raw.primary || [],
    ...raw.secondary || [],
    ...raw.tertiary || []
  ].map((k) => String(k).trim()).filter(Boolean);
}
__name(normaliseKeywordGroups, "normaliseKeywordGroups");
function nthOf(raw, group, index) {
  if (!raw || typeof raw === "string") return "";
  const value = raw[group]?.[index];
  return value ? String(value).trim() : "";
}
__name(nthOf, "nthOf");
function primaryKeyword(product) {
  return product ? nthOf(product.seo_keywords, "primary", 0) : "";
}
__name(primaryKeyword, "primaryKeyword");
function secondaryKeyword(product) {
  return product ? nthOf(product.seo_keywords, "secondary", 0) : "";
}
__name(secondaryKeyword, "secondaryKeyword");
function buildProductTitle(product) {
  const name = (product?.name || "").trim();
  if (!name) return `Product \u2014 ${BRAND}`;
  const nameLower = name.toLowerCase();
  const hasBrand = nameLower.includes(BRAND.toLowerCase());
  const base = hasBrand ? name : `${name} \u2014 ${BRAND}`;
  const keyword = primaryKeyword(product);
  if (keyword && !nameLower.includes(keyword.toLowerCase())) {
    const withKeyword = hasBrand ? `${name} - ${keyword}` : `${name} - ${keyword} | ${BRAND}`;
    if (withKeyword.length <= MAX_TITLE_LENGTH) return withKeyword;
  }
  return base;
}
__name(buildProductTitle, "buildProductTitle");
function buildProductKeywords(product) {
  if (!product) return void 0;
  const autoKeywords = [
    product.name,
    product.category,
    product.sub_category,
    product.product_type,
    ...product.concerns_targeted || [],
    BRAND,
    "dermatologically tested"
  ].filter(Boolean);
  const seen = /* @__PURE__ */ new Set();
  return [...autoKeywords, ...normaliseKeywordGroups(product.seo_keywords)].filter((keyword) => {
    const key = String(keyword).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(", ");
}
__name(buildProductKeywords, "buildProductKeywords");
function buildProductOgAlt(product) {
  const name = (product?.name || "").trim();
  if (!name) return void 0;
  const secondary = secondaryKeyword(product);
  return secondary ? `${name} - ${secondary}` : `${name} by ${BRAND}`;
}
__name(buildProductOgAlt, "buildProductOgAlt");

// seoUtils.js
var BOT_UA_PATTERNS = /googlebot|google-extended|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|facebookexternalhit|whatsapp|discordbot|telegrambot|slackbot|redditbot|twitterbot|linkedinbot|applebot|applebot-extended|semrushbot|ahrefsbot|pinterest|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|cohere-ai|perplexitybot|amazonbot|meta-externalagent|omgili|youbot|python-requests|python-urllib|python\/|curl\/|wget\/|libwww-perl|got\/|axios\/|node-fetch|postmanruntime|insomnia\//i;
function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return BOT_UA_PATTERNS.test(userAgent);
}
__name(isBot, "isBot");
function truncateDescription(text, maxLen = 155) {
  if (!text || text.length <= maxLen) return text ?? "";
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "\u2026";
}
__name(truncateDescription, "truncateDescription");
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
__name(safeJsonLd, "safeJsonLd");
function buildProductSchema(product, frontendUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images?.[0] || "",
    description: product.description || "",
    sku: product.pid,
    brand: { "@type": "Brand", name: "Bodilicious" },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: String(product.price),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${frontendUrl}/product/${product.pid}`,
      seller: { "@type": "Organization", name: "Bodilicious" }
    },
    ...product.rating && product.ratingCount && product.ratingCount > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(Number(product.rating).toFixed(1)),
        reviewCount: String(product.ratingCount),
        bestRating: "5",
        worstRating: "1"
      }
    } : {}
  };
}
__name(buildProductSchema, "buildProductSchema");
function buildBreadcrumbSchema(product, frontendUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${frontendUrl}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${frontendUrl}/shop`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${frontendUrl}/product/${product.pid}`
      }
    ]
  };
}
__name(buildBreadcrumbSchema, "buildBreadcrumbSchema");
function renderProductHtml(product, frontendUrl) {
  const pageTitle = buildProductTitle(product);
  const mergedKeywords = buildProductKeywords(product) || "";
  const ogAlt = buildProductOgAlt(product) || "";
  const productDesc = truncateDescription(product.description || "Premium skincare and haircare from Bodilicious.");
  const schemas = [
    buildProductSchema(product, frontendUrl),
    buildBreadcrumbSchema(product, frontendUrl)
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(productDesc)}">
  <meta name="keywords" content="${escapeHtml(mergedKeywords)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${frontendUrl}/product/${product.pid}">
  
  <meta property="og:type" content="product" />
  <meta property="og:url" content="${frontendUrl}/product/${product.pid}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(productDesc)}" />
  <meta property="og:image" content="${escapeHtml(product.images?.[0] ?? "")}" />
  <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(productDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(product.images?.[0] ?? "")}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  <\/script>
</head>
<body>
  <h1>${escapeHtml(product.name)}</h1>
  <p>${escapeHtml(product.description || "")}</p>
  <p>Price: \u20B9${escapeHtml(String(product.price))}</p>
</body>
</html>`;
}
__name(renderProductHtml, "renderProductHtml");
var CATEGORY_INTRO = {
  // Concerns
  acne: "Breakouts happen for many reasons \u2014 excess sebum, clogged pores, bacteria, or hormonal shifts. Our acne-targeted range works differently at each stage: salicylic acid and azelaic acid formulas cut through congestion at the follicle level, while niacinamide and zinc PCA dial down redness and oil production without stripping the skin barrier.",
  brightening: "Dull skin is usually a surface story \u2014 dead cells, uneven melanin, and post-acne marks that stick around long after the blemish heals. Our brightening products use a layered approach: vitamin C to intercept melanin production, kojic acid and glycolic acid to resurface and reveal, and hyaluronic acid to keep the newly exposed skin hydrated and plump.",
  "anti-aging": "Visible ageing is largely collagen loss, moisture depletion, and cumulative UV damage playing out together. Our anti-ageing lineup addresses all three simultaneously: retinol and peptide serums stimulate collagen synthesis; hyaluronic acid at multiple molecular weights draws water into every layer of the dermis; and broad-spectrum sunscreens stop new damage before it starts.",
  hyperpigmentation: "Hyperpigmentation \u2014 whether from sun exposure, post-inflammatory marks, or melasma \u2014 responds best to a combination of melanin inhibition and gentle exfoliation. Our targeted collection pairs kojic acid and vitamin C with AHA and BHA exfoliants that remove the pigmented cells already sitting on the surface.",
  "hair growth": "Healthy hair growth starts with a healthy scalp. Our hair growth products \u2014 from the herbal oil blend to the scalp-stimulating growth serum \u2014 work by improving blood circulation, reducing follicle-blocking DHT, and delivering biotin and botanical extracts directly to the root zone.",
  dandruff: "Dandruff is a fungal and inflammatory issue, not a hygiene one \u2014 so the fix is antifungal actives combined with scalp-soothing botanicals. Our anti-dandruff shampoo uses ketoconazole to target the Malassezia fungus responsible for flaking, alongside zinc pyrithione to reduce scalp inflammation and prevent recurrence.",
  // Categories
  skin: "Bodilicious skin care is built around clinically studied actives \u2014 niacinamide, retinol, vitamin C, hyaluronic acid, AHAs, and BHAs \u2014 formulated at concentrations that actually work for Indian skin tones and the specific concerns that come with a humid, high-UV climate: acne, post-inflammatory hyperpigmentation, and dehydration.",
  hair: "Hair health is scalp health \u2014 which is why the Bodilicious hair range starts at the root, not the shaft. Our shampoos, conditioners, oils, and serums are formulated to work together: antifungal and DHT-blocking actives for the scalp, protein and keratin for the lengths, and lightweight moisture-sealing ingredients that do not weigh fine hair down.",
  body: "Body skin is thicker and more resilient than facial skin, but it still needs targeted care \u2014 especially for concerns like KP, uneven tone, dryness, and stretch marks. Our body range uses the same science-backed actives as our face products \u2014 goat milk, olive oil, and exfoliating acids \u2014 in formats optimised for larger surface areas.",
  lip: "Lips lack sebaceous glands, so they cannot moisturise themselves \u2014 every bit of moisture they retain has to come from what you put on them. Our lip products go beyond basic petroleum jelly: natural waxes and butters for an occlusive seal, antioxidant-rich ingredients like beetroot and carrot for colour and protection.",
  makeup: "Bodilicious makeup is formulated with skin care principles in mind \u2014 so you are not undoing your serum routine with a foundation that clogs pores. Our range is non-comedogenic, long-wear, and suited to warm, humid Indian conditions where most imported formulas transfer or oxidise by midday.",
  default: "Bodilicious is an Indian science-backed beauty brand offering dermatologically tested skincare, haircare, lip care, and makeup. Every formula is built around proven actives \u2014 niacinamide, retinol, vitamin C, hyaluronic acid, AHAs, BHAs, and keratin \u2014 at concentrations that work for Indian skin types. Free shipping on orders over \u20B91500."
};
var SITEMAP_CATEGORIES = ["skin", "hair", "body", "lip", "makeup"];
var SITEMAP_CONCERNS = [
  "acne",
  "brightening",
  "anti-aging",
  "hyperpigmentation",
  "hair growth",
  "dandruff"
];
var SITEMAP_TYPES = [
  "serum",
  "sunscreen",
  "face wash",
  "moisturizer",
  "shampoo",
  "conditioner",
  "soap",
  "lip balm",
  "eye cream"
];
function titleCase(s) {
  return s.replace(/[_\-/]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
__name(titleCase, "titleCase");
function renderShopHtml({ category, type, concern }, products, frontendUrl) {
  const facetParam = category ? `category=${encodeURIComponent(category)}` : type ? `type=${encodeURIComponent(type)}` : concern ? `concern=${encodeURIComponent(concern)}` : null;
  const canonicalUrl = facetParam ? `${frontendUrl}/shop?${facetParam}` : `${frontendUrl}/shop`;
  const label = category ? titleCase(category) : type ? titleCase(type) : concern ? titleCase(concern) : null;
  const pageTitle = label ? (concern ? `Best Products for ${label}` : `${label} Products`) + " \u2014 Bodilicious" : "Shop Skincare & Haircare \u2014 Bodilicious";
  const introKey = concern || category || type || "default";
  const description = `Shop Bodilicious ${label || "skincare & haircare"} products. Dermatologically tested, science-backed formulas made for Indian skin. Free shipping on orders over \u20B91500.`;
  const intro = CATEGORY_INTRO[introKey] || CATEGORY_INTRO["default"];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${frontendUrl}/` },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${frontendUrl}/shop` },
      ...label ? [{ "@type": "ListItem", position: 3, name: label, item: canonicalUrl }] : []
    ]
  };
  const itemList = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: pageTitle,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: `${frontendUrl}/product/${p.pid}`
    }))
  } : null;
  const schemas = [breadcrumb, ...itemList ? [itemList] : []];
  const productListHtml = products.slice(0, 30).map(
    (p) => `<article><h2><a href="${frontendUrl}/product/${escapeHtml(p.pid)}">${escapeHtml(p.name)}</a></h2><p>\u20B9${escapeHtml(String(p.price))}</p></article>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${safeJsonLd(schemas)}<\/script>
</head>
<body>
  <nav aria-label="breadcrumb"><a href="${frontendUrl}/">Home</a> \u203A <a href="${frontendUrl}/shop">Shop</a>${label ? ` \u203A ${escapeHtml(label)}` : ""}</nav>
  <h1>${escapeHtml(pageTitle.replace(" \u2014 Bodilicious", ""))}</h1>
  <p>${escapeHtml(intro)}</p>
  ${productListHtml}
</body>
</html>`;
}
__name(renderShopHtml, "renderShopHtml");
function escapeHtml(unsafe) {
  return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
__name(escapeHtml, "escapeHtml");

// worker.js
var cache = /* @__PURE__ */ new Map();
var TTL_MS = 5 * 60 * 1e3;
async function fetchWithTimeout(url, timeoutMs = 25e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const fetchFromOrigin = /* @__PURE__ */ __name(() => {
      const originUrl = new URL(request.url);
      originUrl.hostname = "bodilicious-front.onrender.com";
      const modifiedRequest = new Request(originUrl, request);
      modifiedRequest.headers.delete("cf-connecting-ip");
      return fetch(modifiedRequest);
    }, "fetchFromOrigin");
    if (pathname === "/sitemap.xml") {
      return handleSitemap(env);
    }
    if (env.SEO_BOT_RENDER_ENABLED !== "true") {
      return fetchFromOrigin();
    }
    if (!isBot(request)) {
      return fetchFromOrigin();
    }
    if (pathname.startsWith("/product/")) {
      const rawPid = pathname.split("/")[2];
      const pid = rawPid ? decodeURIComponent(rawPid).trim() : null;
      if (pid) {
        return handleProduct(pid, request, env, ctx);
      }
    }
    if (pathname === "/shop") {
      const category = url.searchParams.get("category");
      const type = url.searchParams.get("type");
      const concern = url.searchParams.get("concern");
      const facetCount = [category, type, concern].filter(Boolean).length;
      const hasOtherParams = url.searchParams.has("search") || url.searchParams.has("sort") || url.searchParams.has("ingredient") || url.searchParams.has("priceMin") || url.searchParams.has("priceMax") || url.searchParams.has("sub_category") || url.searchParams.get("page") && url.searchParams.get("page") !== "1";
      if (facetCount <= 1 && !hasOtherParams) {
        return handleShop({ category, type, concern }, request, env, ctx);
      }
    }
    return fetchFromOrigin();
  }
};
async function handleShop({ category, type, concern }, request, env, ctx) {
  try {
    const apiUrl = env.API_BASE_URL || "https://bodilicious.onrender.com";
    const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
    const cacheKey = `shop:${category || ""}:${type || ""}:${concern || ""}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.html, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Cache": "HIT"
        }
      });
    }
    const params = new URLSearchParams({ limit: "30" });
    if (category) params.set("category", category);
    if (type) params.set("type", type);
    if (concern) params.set("concern", concern);
    let products = [];
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/v1/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        products = data.data || [];
      }
    } catch (_) {
    }
    const html = renderShopHtml({ category, type, concern }, products, frontendUrl);
    cache.set(cacheKey, { html, expiresAt: now + TTL_MS });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (error) {
    console.error(`[SEO Worker] Error rendering shop page:`, error.message);
    return fetch(request);
  }
}
__name(handleShop, "handleShop");
async function handleProduct(pid, request, env, ctx) {
  try {
    const now = Date.now();
    const cached = cache.get(pid);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.html, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          "X-Cache": "HIT"
        }
      });
    }
    const apiUrl = env.API_BASE_URL || "https://bodilicious.onrender.com";
    const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
    const res = await fetchWithTimeout(`${apiUrl}/api/v1/products/${pid}`);
    if (res.status === 404) {
      return new Response(
        '<!doctype html><html lang="en"><head><title>Product Not Found \u2014 Bodilicious</title><meta name="robots" content="noindex, nofollow"></head><body>Not Found</body></html>',
        { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } }
      );
    }
    if (!res.ok) {
      return fetch(request);
    }
    const data = await res.json();
    if (!data.success || !data.data) {
      return new Response(
        '<!doctype html><html lang="en"><head><title>Product Not Found \u2014 Bodilicious</title><meta name="robots" content="noindex, nofollow"></head><body>Not Found</body></html>',
        { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } }
      );
    }
    const html = renderProductHtml(data.data, frontendUrl);
    cache.set(pid, { html, expiresAt: now + TTL_MS });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(`[SEO Worker] Timeout fetching product ${pid} \u2014 Render backend may be cold-starting`);
    } else {
      console.error(`[SEO Worker] Error fetching product ${pid}:`, error.message);
    }
    return fetch(request);
  }
}
__name(handleProduct, "handleProduct");
async function handleSitemap(env) {
  try {
    const apiUrl = env.API_BASE_URL || "https://bodilicious.onrender.com";
    const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
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
        console.error(`[SEO Worker] Sitemap page ${page} fetch failed:`, pageError.name);
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
    const urls = [];
    const staticRoutes = [
      "/",
      "/shop",
      "/about",
      "/brand-story",
      "/contact",
      "/faqs",
      "/blogs",
      "/offers",
      "/how-to-order",
      "/ritual-finder",
      "/terms",
      "/privacy",
      "/shipping-refund"
    ];
    const LOW_PRIORITY = /* @__PURE__ */ new Set(["/terms", "/privacy", "/shipping-refund"]);
    staticRoutes.forEach((route) => {
      const priority = route === "/" ? "1.0" : LOW_PRIORITY.has(route) ? "0.3" : "0.8";
      urls.push(`
  <url>
    <loc>${frontendUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`);
    });
    const facets = [
      ...SITEMAP_CATEGORIES.map((v) => ["category", v]),
      ...SITEMAP_TYPES.map((v) => ["type", v]),
      ...SITEMAP_CONCERNS.map((v) => ["concern", v])
    ];
    facets.forEach(([key, value]) => {
      urls.push(`
  <url>
    <loc>${frontendUrl}/shop?${key}=${encodeURIComponent(value)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    });
    allProducts.forEach((p) => {
      if (p.availability !== "Discontinued") {
        const lastmod = p.updatedAt ? p.updatedAt.substring(0, 10) : (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
        urls.push(`
  <url>
    <loc>${frontendUrl}/product/${p.pid}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);
      }
    });
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
        posts.forEach((post) => {
          if (!post.slug) return;
          const lastmod = (post.updatedAt || post.publishedAt || "").substring(0, 10) || (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
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
      console.error("[SEO Worker] Blog sitemap fetch failed:", blogError.name);
    }
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;
    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error("Error fetching products for sitemap:", error);
    return new Response("Error generating sitemap", {
      status: 500,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  }
}
__name(handleSitemap, "handleSitemap");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
