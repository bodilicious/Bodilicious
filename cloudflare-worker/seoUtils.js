// Single source of truth for product title/keywords/alt, shared with the React
// app so crawlers and users are served identical metadata. wrangler bundles this
// .ts file via esbuild, which strips the types.
import {
  buildProductTitle,
  buildProductKeywords,
  buildProductOgAlt,
} from '../frontend/src/utils/seo.ts';

// Includes major search engines, social media unfurlers, AI crawlers, and generic HTTP clients (used by AI assistants in sandboxes)
export const BOT_UA_PATTERNS = /googlebot|google-extended|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|facebookexternalhit|whatsapp|discordbot|telegrambot|slackbot|redditbot|twitterbot|linkedinbot|applebot|applebot-extended|semrushbot|ahrefsbot|pinterest|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|cohere-ai|perplexitybot|amazonbot|meta-externalagent|omgili|youbot|python-requests|python-urllib|python\/|curl\/|wget\/|libwww-perl|got\/|axios\/|node-fetch|postmanruntime|insomnia\//i;

export function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return BOT_UA_PATTERNS.test(userAgent);
}

export function truncateDescription(text, maxLen = 155) {
  if (!text || text.length <= maxLen) return text ?? '';
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

export function safeJsonLd(obj) {
  // BUG FIX 4: The regex replacement `<\/script` produces a literal backslash
  // inside the JSON string, which makes the JSON invalid and breaks parsers.
  // The correct approach is to Unicode-escape the `<` character to `\u003c`,
  // which is valid JSON and prevents early </script> tag termination.
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildProductSchema(product, frontendUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images?.[0] || '',
    description: product.description || '',
    sku: product.pid,
    brand: { '@type': 'Brand', name: 'Bodilicious' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: String(product.price),
      availability:
        product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${frontendUrl}/product/${product.pid}`,
      seller: { '@type': 'Organization', name: 'Bodilicious' },
    },
    ...(product.rating && product.ratingCount && product.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(Number(product.rating).toFixed(1)),
            reviewCount: String(product.ratingCount),
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };
}

export function buildBreadcrumbSchema(product, frontendUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${frontendUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Shop',
        item: `${frontendUrl}/shop`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `${frontendUrl}/product/${product.pid}`,
      },
    ],
  };
}

// Generate the final HTML for a product page
export function renderProductHtml(product, frontendUrl) {
  // Title/keywords/alt come from the SAME module the browser uses, so bot HTML
  // and user HTML can never drift apart. See frontend/src/utils/seo.ts.
  const pageTitle = buildProductTitle(product);
  const mergedKeywords = buildProductKeywords(product) || '';
  const ogAlt = buildProductOgAlt(product) || '';
  const productDesc = truncateDescription(product.description || 'Premium skincare and haircare from Bodilicious.');

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
  <meta property="og:image" content="${escapeHtml(product.images?.[0] ?? '')}" />
  <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(productDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(product.images?.[0] ?? '')}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  </script>
</head>
<body>
  <h1>${escapeHtml(product.name)}</h1>
  <p>${escapeHtml(product.description || '')}</p>
  <p>Price: ₹${escapeHtml(String(product.price))}</p>
</body>
</html>`;
}

// ─── Shop / Category Page Bot Renderer ──────────────────────────────────────
// These category intro blurbs must stay in sync with CATEGORY_INTRO in ShopPage.tsx
const CATEGORY_INTRO = {
  // Concerns
  acne: 'Breakouts happen for many reasons — excess sebum, clogged pores, bacteria, or hormonal shifts. Our acne-targeted range works differently at each stage: salicylic acid and azelaic acid formulas cut through congestion at the follicle level, while niacinamide and zinc PCA dial down redness and oil production without stripping the skin barrier.',
  brightening: 'Dull skin is usually a surface story — dead cells, uneven melanin, and post-acne marks that stick around long after the blemish heals. Our brightening products use a layered approach: vitamin C to intercept melanin production, kojic acid and glycolic acid to resurface and reveal, and hyaluronic acid to keep the newly exposed skin hydrated and plump.',
  'anti-aging': 'Visible ageing is largely collagen loss, moisture depletion, and cumulative UV damage playing out together. Our anti-ageing lineup addresses all three simultaneously: retinol and peptide serums stimulate collagen synthesis; hyaluronic acid at multiple molecular weights draws water into every layer of the dermis; and broad-spectrum sunscreens stop new damage before it starts.',
  hyperpigmentation: 'Hyperpigmentation — whether from sun exposure, post-inflammatory marks, or melasma — responds best to a combination of melanin inhibition and gentle exfoliation. Our targeted collection pairs kojic acid and vitamin C with AHA and BHA exfoliants that remove the pigmented cells already sitting on the surface.',
  'hair growth': 'Healthy hair growth starts with a healthy scalp. Our hair growth products — from the herbal oil blend to the scalp-stimulating growth serum — work by improving blood circulation, reducing follicle-blocking DHT, and delivering biotin and botanical extracts directly to the root zone.',
  dandruff: 'Dandruff is a fungal and inflammatory issue, not a hygiene one — so the fix is antifungal actives combined with scalp-soothing botanicals. Our anti-dandruff shampoo uses ketoconazole to target the Malassezia fungus responsible for flaking, alongside zinc pyrithione to reduce scalp inflammation and prevent recurrence.',
  // Categories
  skin: 'Bodilicious skin care is built around clinically studied actives — niacinamide, retinol, vitamin C, hyaluronic acid, AHAs, and BHAs — formulated at concentrations that actually work for Indian skin tones and the specific concerns that come with a humid, high-UV climate: acne, post-inflammatory hyperpigmentation, and dehydration.',
  hair: 'Hair health is scalp health — which is why the Bodilicious hair range starts at the root, not the shaft. Our shampoos, conditioners, oils, and serums are formulated to work together: antifungal and DHT-blocking actives for the scalp, protein and keratin for the lengths, and lightweight moisture-sealing ingredients that do not weigh fine hair down.',
  body: 'Body skin is thicker and more resilient than facial skin, but it still needs targeted care — especially for concerns like KP, uneven tone, dryness, and stretch marks. Our body range uses the same science-backed actives as our face products — goat milk, olive oil, and exfoliating acids — in formats optimised for larger surface areas.',
  lip: 'Lips lack sebaceous glands, so they cannot moisturise themselves — every bit of moisture they retain has to come from what you put on them. Our lip products go beyond basic petroleum jelly: natural waxes and butters for an occlusive seal, antioxidant-rich ingredients like beetroot and carrot for colour and protection.',
  makeup: 'Bodilicious makeup is formulated with skin care principles in mind — so you are not undoing your serum routine with a foundation that clogs pores. Our range is non-comedogenic, long-wear, and suited to warm, humid Indian conditions where most imported formulas transfer or oxidise by midday.',
  default: 'Bodilicious is an Indian science-backed beauty brand offering dermatologically tested skincare, haircare, lip care, and makeup. Every formula is built around proven actives — niacinamide, retinol, vitamin C, hyaluronic acid, AHAs, BHAs, and keratin — at concentrations that work for Indian skin types. Free shipping on orders over ₹1500.',
};

/**
 * Facet landing pages worth listing in the sitemap.
 *
 * handleShop() renders bot HTML for any single-facet /shop URL, but Google can
 * only index what it can discover — and these were missing from the sitemap
 * entirely, so 20 rendered landing pages were invisible to crawlers.
 *
 * Categories and concerns must have a CATEGORY_INTRO entry above (otherwise the
 * page renders the generic `default` blurb and is thin duplicate content).
 * Types intentionally use the default blurb — they are still distinct product
 * listings, which is enough to index.
 */
export const SITEMAP_CATEGORIES = ['skin', 'hair', 'body', 'lip', 'makeup'];
export const SITEMAP_CONCERNS = [
  'acne', 'brightening', 'anti-aging', 'hyperpigmentation', 'hair growth', 'dandruff',
];
export const SITEMAP_TYPES = [
  'serum', 'sunscreen', 'face wash', 'moisturizer', 'shampoo',
  'conditioner', 'soap', 'lip balm', 'eye cream',
];

function titleCase(s) {
  return s.replace(/[_\-/]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Render a bot-readable HTML page for /shop?category=X, /shop?type=X, /shop?concern=X.
 * Sets a correct self-canonical so Google indexes the facet page, not the homepage.
 */
export function renderShopHtml({ category, type, concern }, products, frontendUrl) {
  // Determine canonical facet
  const facetParam = category ? `category=${encodeURIComponent(category)}`
    : type ? `type=${encodeURIComponent(type)}`
    : concern ? `concern=${encodeURIComponent(concern)}`
    : null;
  const canonicalUrl = facetParam
    ? `${frontendUrl}/shop?${facetParam}`
    : `${frontendUrl}/shop`;

  // Title & description
  const label = category ? titleCase(category) : type ? titleCase(type) : concern ? titleCase(concern) : null;
  const pageTitle = label
    ? (concern ? `Best Products for ${label}` : `${label} Products`) + ' — Bodilicious'
    : 'Shop Skincare & Haircare — Bodilicious';
  const introKey = concern || category || type || 'default';
  const description = `Shop Bodilicious ${label || 'skincare & haircare'} products. Dermatologically tested, science-backed formulas made for Indian skin. Free shipping on orders over ₹1500.`;
  const intro = CATEGORY_INTRO[introKey] || CATEGORY_INTRO['default'];

  // Breadcrumb JSON-LD
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${frontendUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${frontendUrl}/shop` },
      ...(label ? [{ '@type': 'ListItem', position: 3, name: label, item: canonicalUrl }] : []),
    ],
  };

  // ItemList JSON-LD (first 20 products)
  const itemList = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageTitle,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${frontendUrl}/product/${p.pid}`,
    })),
  } : null;

  const schemas = [breadcrumb, ...(itemList ? [itemList] : [])];

  // Product list HTML for body
  const productListHtml = products.slice(0, 30).map(p =>
    `<article><h2><a href="${frontendUrl}/product/${escapeHtml(p.pid)}">${escapeHtml(p.name)}</a></h2><p>₹${escapeHtml(String(p.price))}</p></article>`
  ).join('');

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
  <script type="application/ld+json">${safeJsonLd(schemas)}</script>
</head>
<body>
  <nav aria-label="breadcrumb"><a href="${frontendUrl}/">Home</a> › <a href="${frontendUrl}/shop">Shop</a>${label ? ` › ${escapeHtml(label)}` : ''}</nav>
  <h1>${escapeHtml(pageTitle.replace(' — Bodilicious', ''))}</h1>
  <p>${escapeHtml(intro)}</p>
  ${productListHtml}
</body>
</html>`;
}

function escapeHtml(unsafe) {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
