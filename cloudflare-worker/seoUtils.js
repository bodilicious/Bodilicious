// Single source of truth for product title/keywords/alt, shared with the React
// app so crawlers and users are served identical metadata. wrangler bundles this


// .ts file via esbuild, which strips the types.
import {
  buildProductTitle,
  buildProductKeywords,
  buildProductOgAlt,
  buildProductDescription,
  buildProductH1,
  buildProductH2s,
  buildBlogTitle,
  buildBlogDescription,
  buildBlogKeywords,
  buildBlogOgAlt,
  buildBlogHeadline,
  STATIC_PAGE_SEO,
} from '../frontend/src/utils/seo.ts';

// Re-exported so worker.js can route on it without reaching into the frontend.
export { STATIC_PAGE_SEO };

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
  const productDesc = buildProductDescription(product);
  const h1 = buildProductH1(product);
  const h2s = buildProductH2s(product);

  // ── Body content ──────────────────────────────────────────────────────────
  // This body used to be three lines (h1 + description + price) — about 20 words.
  // Google receives this HTML complete and does NOT execute the React app, so
  // those 20 words were the entire indexed page, while users saw ingredients,
  // benefits, usage and reviews. That gap is both wasted ranking signal and a
  // dynamic-rendering equivalence problem: the bot version must match the user
  // version. Everything below already exists in the product payload.
  const list = (items) =>
    items && items.length
      ? `<ul>${items.map(i => `<li>${escapeHtml(String(i))}</li>`).join('')}</ul>`
      : '';

  const ing = product.ingredients || {};
  const allIngredients = [
    ...(ing.key_actives || []),
    ...(ing.botanical_extracts || []),
    ...(ing.others || []),
  ];

  const usageLine = product.usage && typeof product.usage === 'object'
    ? [product.usage.time, product.usage.frequency, product.usage.routine_step]
        .filter(Boolean).join(' · ')
    : '';

  // Only entries with BOTH a question and an answer are usable — Google drops
  // the whole FAQPage block if any mainEntity is incomplete.
  const faqs = (product.faqs || []).filter(f => f && f.question && f.answer);
  const faqSchema = faqs.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: String(f.question),
      acceptedAnswer: { '@type': 'Answer', text: String(f.answer) },
    })),
  } : null;

  const relatedBlogs = (product.relatedBlogs || []).filter(b => b && b.slug && b.title);

  const reviewBlock = (product.reviews || []).slice(0, 5)
    .filter(r => r && r.comment)
    .map(r => `<blockquote><p>${escapeHtml(String(r.comment))}</p>
      <cite>${escapeHtml(String(r.user || 'Customer'))} — ${escapeHtml(String(r.rating ?? ''))}/5</cite></blockquote>`)
    .join('');

  // h2s[0..2] map to benefits / ingredients / how-to-use in buildProductH2s.
  const sections = [
    product.benefits?.length
      ? `<h2>${escapeHtml(h2s[0] || 'Benefits')}</h2>${list(product.benefits)}` : '',
    allIngredients.length
      ? `<h2>${escapeHtml(h2s[1] || 'Key Ingredients')}</h2>${list(allIngredients)}` : '',
    (product.how_to_use?.length || usageLine)
      ? `<h2>${escapeHtml(h2s[2] || 'How to Use')}</h2>${list(product.how_to_use)}${
          usageLine ? `<p>${escapeHtml(usageLine)}</p>` : ''}` : '',
    product.concerns_targeted?.length
      // titleCase so stored slugs like "uneven_tone" don't reach the page as-is.
      ? `<h2>Targets</h2>${list(product.concerns_targeted.map(titleCase))}` : '',
    product.warnings?.length
      ? `<h2>Warnings</h2>${list(product.warnings)}` : '',
    reviewBlock ? `<h2>Customer Reviews</h2>${reviewBlock}` : '',
    faqs.length
      ? `<h2>Frequently Asked Questions</h2>${faqs.map(f =>
          `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`).join('')}` : '',
    relatedBlogs.length
      ? `<h2>Read More</h2><ul>${relatedBlogs.map(b =>
          `<li><a href="${frontendUrl}/blogs/${encodeURIComponent(b.slug)}">${escapeHtml(b.title)}</a></li>`
        ).join('')}</ul>` : '',
  ].filter(Boolean).join('\n  ');

  const schemas = [
    buildProductSchema(product, frontendUrl),
    buildBreadcrumbSchema(product, frontendUrl),
    ...(faqSchema ? [faqSchema] : []),
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
  <h1>${escapeHtml(h1)}</h1>
  <p>${escapeHtml(product.description || '')}</p>
  <p>Price: ₹${escapeHtml(String(product.price))}</p>
  ${sections}
</body>
</html>`;
}

// ─── Blog Post Bot Renderer ─────────────────────────────────────────────────

/**
 * Minimal HTML sanitiser for blog bodies.
 *
 * Blog content is admin-authored Tiptap HTML. The React page runs it through
 * DOMPurify, but DOMPurify needs a DOM and this runs in a Worker — so we do the
 * conservative thing: drop dangerous elements entirely, keep a small structural
 * allowlist, and strip every attribute (which kills href/src/onerror vectors in
 * one move). Headings survive, which is the part that carries SEO weight.
 */
const BLOG_ALLOWED_TAGS = new Set([
  'p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'blockquote',
]);

export function sanitizeBlogHtml(html) {
  return String(html || '')
    // Remove these elements *with* their contents, not just the tags.
    .replace(/<(script|style|iframe|object|embed|form|svg)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|svg)[^>]*\/?>/gi, '')
    // Keep allowlisted tags but with no attributes; drop everything else.
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
      const name = tag.toLowerCase();
      if (!BLOG_ALLOWED_TAGS.has(name)) return '';
      return match.startsWith('</') ? `</${name}>` : `<${name}>`;
    });
}

export function renderBlogHtml(post, frontendUrl) {
  const pageTitle = buildBlogTitle(post);
  const description = buildBlogDescription(post);
  const keywords = buildBlogKeywords(post) || '';
  const ogAlt = buildBlogOgAlt(post) || '';
  const url = `${frontendUrl}/blogs/${encodeURIComponent(post.slug || '')}`;
  const image = post.coverImage || '';
  const published = post.publishedAt || post.createdAt || null;
  const modified = post.updatedAt || published;
  const relatedProducts = (post.relatedProducts || []).filter(p => p && p.pid && p.name);

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: buildBlogHeadline(post).slice(0, 110), // Google caps headline at 110
      description,
      image: image || undefined,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      // author is an unpopulated ref on current posts, so attribute to the
      // organisation rather than emitting an invalid/empty Person.
      author: { '@type': 'Organization', name: 'Bodilicious', url: frontendUrl },
      publisher: {
        '@type': 'Organization',
        name: 'Bodilicious',
        url: frontendUrl,
      },
      ...(published ? { datePublished: published } : {}),
      ...(modified ? { dateModified: modified } : {}),
      ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${frontendUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${frontendUrl}/blogs` },
        { '@type': 'ListItem', position: 3, name: buildBlogHeadline(post), item: url },
      ],
    },
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">

  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />
  ${published ? `<meta property="article:published_time" content="${escapeHtml(published)}" />` : ''}
  ${modified ? `<meta property="article:modified_time" content="${escapeHtml(modified)}" />` : ''}
  ${(post.tags || []).map(t => `<meta property="article:tag" content="${escapeHtml(String(t))}" />`).join('\n  ')}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  </script>
</head>
<body>
  <article>
    <h1>${escapeHtml(buildBlogHeadline(post))}</h1>
    ${published ? `<p><time datetime="${escapeHtml(published)}">${escapeHtml(String(published).slice(0, 10))}</time></p>` : ''}
    ${sanitizeBlogHtml(post.content)}
  </article>
  ${relatedProducts.length ? `<section>
    <h2>Products mentioned in this guide</h2>
    <ul>${relatedProducts.map(p =>
      `<li><a href="${frontendUrl}/product/${escapeHtml(p.pid)}">${escapeHtml(p.name)}</a> — ₹${escapeHtml(String(p.price))}</li>`
    ).join('')}</ul>
  </section>` : ''}
</body>
</html>`;
}

// ─── Static Page Bot Renderer ───────────────────────────────────────────────

/**
 * Rewrite the SPA shell's head with the correct metadata for a static page.
 *
 * Deliberately NOT a replacement page. Replacing the body would serve crawlers
 * a two-line stub where users get a full About/Contact page — thinner than the
 * real thing, and the same dynamic-rendering equivalence problem the product
 * renderer exists to fix. It would also be counterproductive: a complete HTML
 * response stops Google rendering the JS, so it would index the stub instead of
 * the real content.
 *
 * Streaming the origin response through HTMLRewriter keeps the SPA intact —
 * JS-capable crawlers still render the full page — while clients that never run
 * JS (every social unfurler) finally get the right title, description and card.
 */
export function rewriteStaticMeta(response, pathname, frontendUrl) {
  const meta = STATIC_PAGE_SEO[pathname];
  if (!meta) return response;

  const url = `${frontendUrl}${pathname}`;
  const setAttr = (name, value) => ({
    element(el) { el.setAttribute(name, value); },
  });

  return new HTMLRewriter()
    .on('title', {
      element(el) { el.setInnerContent(meta.title); },
    })
    .on('meta[name="description"]', setAttr('content', meta.description))
    .on('link[rel="canonical"]', setAttr('href', url))
    .on('meta[property="og:title"]', setAttr('content', meta.title))
    .on('meta[property="og:description"]', setAttr('content', meta.description))
    .on('meta[property="og:url"]', setAttr('content', url))
    .on('meta[name="twitter:title"]', setAttr('content', meta.title))
    .on('meta[name="twitter:description"]', setAttr('content', meta.description))
    .transform(response);
}

/**
 * Blog index: correct metadata plus an ItemList naming every published post.
 *
 * Same approach as rewriteStaticMeta — augment the real page rather than
 * replace it. The ItemList is appended to <head> so non-JS clients still learn
 * what articles exist, while JS-capable crawlers render the actual listing.
 */
export function rewriteBlogIndex(response, posts, frontendUrl) {
  const itemList = posts.length ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: STATIC_PAGE_SEO['/blogs'].title,
    numberOfItems: posts.length,
    itemListElement: posts.slice(0, 50).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${frontendUrl}/blogs/${encodeURIComponent(p.slug)}`,
      name: buildBlogHeadline(p),
    })),
  } : null;

  const withMeta = rewriteStaticMeta(response, '/blogs', frontendUrl);
  if (!itemList) return withMeta;

  return new HTMLRewriter()
    .on('head', {
      element(el) {
        el.append(
          `<script type="application/ld+json">${safeJsonLd(itemList)}</script>`,
          { html: true }
        );
      },
    })
    .transform(withMeta);
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

  // ItemList JSON-LD (first 20 products).
  // numberOfItems tells Google the list is a complete collection rather than a
  // truncated sample, and embedding the Product with its offer makes each entry
  // eligible for price/availability annotations instead of a bare link.
  const itemList = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageTitle,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${frontendUrl}/product/${p.pid}`,
      item: {
        '@type': 'Product',
        name: p.name,
        url: `${frontendUrl}/product/${p.pid}`,
        ...(p.images?.[0] ? { image: p.images[0] } : {}),
        ...(p.price != null ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: String(p.price),
            availability: p.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
        } : {}),
      },
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
