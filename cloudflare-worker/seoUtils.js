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
  stripHtml,
} from '../frontend/src/utils/seo.ts';

// Re-exported so worker.js can route on it without reaching into the frontend.
export { STATIC_PAGE_SEO, stripHtml };

// Includes major search engines, social media unfurlers, AI crawlers, and generic HTTP clients (used by AI assistants in sandboxes)
export const BOT_UA_PATTERNS = /googlebot|google-extended|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|facebookexternalhit|whatsapp|discordbot|telegrambot|slackbot|redditbot|twitterbot|linkedinbot|applebot|applebot-extended|semrushbot|ahrefsbot|pinterest|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|cohere-ai|perplexitybot|perplexity-user|amazonbot|meta-externalagent|ccbot|bytespider|omgili|youbot|python-requests|python-urllib|python\/|curl\/|wget\/|libwww-perl|got\/|axios\/|node-fetch|postmanruntime|insomnia\//i;

export function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return BOT_UA_PATTERNS.test(userAgent);
}

// ─── Legacy Shopify URL cleanup ─────────────────────────────────────────────
// This domain ran a Shopify store before the current site. Shopify's URL
// structure (/products/:handle, /collections/:handle, /pages/:handle, plus
// its JSON/XML/asset endpoints) is still indexed by Bing/Google and gets
// cited by AI assistants doing live web search — because nothing on this
// domain ever told those crawlers the URLs moved or disappeared. They fell
// through to the SPA shell and got a plain 200 with generic homepage
// metadata, which is not a "moved" or "gone" signal, so the stale snippets
// never got refreshed. A real 301 (moved) or 410 (gone) here is what
// actually clears that out of search indexes and AI answers over time.
const LEGACY_COLLECTION_MAP = {
  all: '/shop',
  'shop-all': '/shop',
  'skin-care': '/shop?category=skin',
  skincare: '/shop?category=skin',
  'hair-care': '/shop?category=hair',
  haircare: '/shop?category=hair',
  'body-care': '/shop?category=body',
  lipcare: '/shop?category=lip',
  'lip-care': '/shop?category=lip',
  makeup: '/shop?category=makeup',
  foundation: '/shop?category=makeup',
};

const LEGACY_PAGE_MAP = {
  'brand-story': '/brand-story',
  about: '/about',
  'about-us': '/about',
  contact: '/contact',
  'contact-us': '/contact',
  faq: '/faqs',
  faqs: '/faqs',
  'shipping-policy': '/shipping-refund',
  'refund-policy': '/shipping-refund',
  'return-policy': '/shipping-refund',
  'terms-of-service': '/terms',
  'terms-conditions': '/terms',
  'privacy-policy': '/privacy',
};

// Shopify API/asset/checkout endpoints with no meaningful equivalent on the
// current site — these should disappear from the index (410), not redirect.
const LEGACY_GONE_PATTERNS = [
  /^\/products\/[^/]+\.json$/,
  /^\/products\.json$/,
  /^\/collections\.json$/,
  /^\/collections\/[^/]+\.json$/,
  /^\/sitemap_products_\d+\.xml$/,
  /^\/sitemap_collections_\d+\.xml$/,
  /^\/sitemap_pages_\d+\.xml$/,
  /^\/cdn\/shop\//,
  /^\/cart\.js$/,
  /^\/cart\/[^/]+\.js$/,
  /^\/checkouts\//,
  /^\/apps\//,
  /^\/wpm@/,
];

/**
 * Classifies a request path as belonging to the old Shopify store.
 * Returns { type: 'redirect', to } | { type: 'gone' } | null.
 */
export function getLegacyShopifyAction(pathname) {
  for (const pattern of LEGACY_GONE_PATTERNS) {
    if (pattern.test(pathname)) return { type: 'gone' };
  }

  // BUG FIX: a bare [^/]+ handle match also caught this site's own static
  // assets served from these same path prefixes (e.g. frontend/public's
  // /products/coq-0.webp product photos), 301-redirecting every product
  // image on the site to /shop. Real Shopify handles are slugs with no
  // dot in them, so require the segment to look like one — this excludes
  // any filename with an extension while still matching legacy handles.
  const isLegacySlug = (segment) => /^[a-zA-Z0-9_-]+$/.test(segment);

  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch && isLegacySlug(productMatch[1])) {
    // No preserved handle→pid mapping from the old catalog, so send to the
    // closest honest destination rather than guessing a specific product.
    return { type: 'redirect', to: '/shop' };
  }

  const collectionMatch = pathname.match(/^\/collections\/([^/]+)\/?$/);
  if (collectionMatch && isLegacySlug(collectionMatch[1])) {
    const to = LEGACY_COLLECTION_MAP[collectionMatch[1].toLowerCase()] || '/shop';
    return { type: 'redirect', to };
  }

  const pageMatch = pathname.match(/^\/pages\/([^/]+)\/?$/);
  if (pageMatch && isLegacySlug(pageMatch[1])) {
    const to = LEGACY_PAGE_MAP[pageMatch[1].toLowerCase()] || '/about';
    return { type: 'redirect', to };
  }

  return null;
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

// Product/blog images are stored as either a full CDN URL or a path relative
// to the frontend origin (e.g. "/products/foo.webp"). og:image, twitter:image
// and schema.org `image` all require an absolute URL — the React pages already
// absolutize this (ProductPage.tsx, BlogPostPage.tsx) but the bot renderer was
// emitting the raw relative path, so bots and social unfurlers never resolve
// the preview image.
export function toAbsoluteUrl(url, frontendUrl) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${frontendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Shared trust/E-E-A-T footer for bot-rendered pages. The React app's real
 * Footer.tsx has these same links, but the bot renderer builds its own HTML
 * from scratch and never included them — so any crawler that doesn't execute
 * JS (which is most AI bots) saw a page with no path to About/Contact/policy
 * pages at all, and no visible trust signals beyond the JSON-LD.
 *
 * Only states claims already made elsewhere on the site (About page copy) —
 * do not add anything here that isn't independently true and verifiable.
 */
export function renderTrustFooter(frontendUrl) {
  return `<footer>
    <p>Dermatologically tested, science-backed skincare and haircare — Bodilicious is a certified, registered Indian beauty brand.</p>
    <nav aria-label="Company">
      <a href="${frontendUrl}/about">About Bodilicious</a>
      <a href="${frontendUrl}/contact">Contact Us</a>
      <a href="${frontendUrl}/privacy">Privacy Policy</a>
      <a href="${frontendUrl}/terms">Terms &amp; Conditions</a>
    </nav>
  </footer>`;
}

export function buildProductSchema(product, frontendUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: toAbsoluteUrl(product.images?.[0], frontendUrl),
    // Strip HTML tags — description is now Tiptap HTML; schema.org requires plain text.
    description: stripHtml(product.description || ''),
    sku: product.pid,
    brand: { '@type': 'Brand', name: 'Bodilicious' },
    // Must stay identical to <g:google_product_category> for this pid in
    // product-feed.xml — Googlebot sees this rendering, not the React one.
    // Omitted when unset rather than guessed from `category`.
    ...(product.google_product_category
      ? { category: product.google_product_category }
      : {}),
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
      // Matches the real policy on /shipping-refund: 7-day window on unused
      // items with the original receipt, customer pays return shipping
      // unless the item is defective or incorrect. Not adding shippingDetails
      // alongside this — the real shipping cost is "calculated based on
      // method, weight, dimensions, and address" (i.e. genuinely variable
      // below the ₹1500 free-shipping threshold), so there's no single
      // honest flat rate to declare here.
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnShippingFees',
      },
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
  const absImage = toAbsoluteUrl(product.images?.[0], frontendUrl);

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

  // Each block is a <section> so bots parsing structure (not just text) can
  // tell benefits/ingredients/reviews/FAQs apart instead of one flat run of
  // <h2>s — this is what AI-answer engines and screen readers use to segment
  // the page. h2s[0..2] map to benefits / ingredients / how-to-use in buildProductH2s.
  const sections = [
    product.benefits?.length
      ? `<section aria-labelledby="benefits-h"><h2 id="benefits-h">${escapeHtml(h2s[0] || 'Benefits')}</h2>${list(product.benefits)}</section>` : '',
    allIngredients.length
      ? `<section aria-labelledby="ingredients-h"><h2 id="ingredients-h">${escapeHtml(h2s[1] || 'Key Ingredients')}</h2>${list(allIngredients)}</section>` : '',
    (product.how_to_use?.length || usageLine)
      ? `<section aria-labelledby="how-to-use-h"><h2 id="how-to-use-h">${escapeHtml(h2s[2] || 'How to Use')}</h2>${list(product.how_to_use)}${
          usageLine ? `<p>${escapeHtml(usageLine)}</p>` : ''}</section>` : '',
    product.concerns_targeted?.length
      // titleCase so stored slugs like "uneven_tone" don't reach the page as-is.
      ? `<section aria-labelledby="targets-h"><h2 id="targets-h">Targets</h2>${list(product.concerns_targeted.map(titleCase))}</section>` : '',
    product.warnings?.length
      ? `<section aria-labelledby="warnings-h"><h2 id="warnings-h">Warnings</h2>${list(product.warnings)}</section>` : '',
    reviewBlock ? `<section aria-labelledby="reviews-h"><h2 id="reviews-h">Customer Reviews</h2>${reviewBlock}</section>` : '',
    faqs.length
      ? `<section aria-labelledby="faq-h"><h2 id="faq-h">Frequently Asked Questions</h2>${faqs.map(f =>
          `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`).join('')}</section>` : '',
    relatedBlogs.length
      ? `<section aria-labelledby="read-more-h"><h2 id="read-more-h">Read More</h2><ul>${relatedBlogs.map(b =>
          `<li><a href="${frontendUrl}/blogs/${encodeURIComponent(b.slug)}">${escapeHtml(b.title)}</a></li>`
        ).join('')}</ul></section>` : '',
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
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${frontendUrl}/product/${product.pid}">
  <link rel="alternate" hreflang="en-IN" href="${frontendUrl}/product/${product.pid}">
  <link rel="alternate" hreflang="x-default" href="${frontendUrl}/">
  <link rel="llms.txt" href="${frontendUrl}/llms.txt" title="LLM-readable site summary">

  <meta property="og:type" content="product" />
  <meta property="og:url" content="${frontendUrl}/product/${product.pid}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(productDesc)}" />
  <meta property="og:image" content="${escapeHtml(absImage)}" />
  <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(productDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(absImage)}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  </script>
</head>
<body>
  <main>
    <article>
      <header>
        <h1>${escapeHtml(h1)}</h1>
        <div>${sanitizeBlogHtml(product.description || '')}</div>
        <p>Price: ₹${escapeHtml(String(product.price))}</p>
        ${product.rating && product.ratingCount
          ? `<p>Rated ${escapeHtml(String(product.rating.toFixed ? product.rating.toFixed(1) : product.rating))} out of 5 (${escapeHtml(String(product.ratingCount))} reviews)</p>`
          : ''}
        <!-- Same trust badges as the real product page's trust bar (ProductPage.tsx) —
             previously only present as aggregateRating in JSON-LD, with no visible
             trust signal in the body text a crawler could actually read. -->
        <ul aria-label="Trust signals">
          <li>7-Day Returns — Hassle-free</li>
          <li>Secure SSL — 100% Secure</li>
          <li>Delivery SLA — Fast Shipping</li>
          <li>Verified Science — Proven Actives</li>
        </ul>
      </header>
      ${sections}
    </article>
  </main>
  ${renderTrustFooter(frontendUrl)}
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
  const image = toAbsoluteUrl(post.coverImage, frontendUrl);
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
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="en-IN" href="${url}">
  <link rel="alternate" hreflang="x-default" href="${frontendUrl}/">
  <link rel="llms.txt" href="${frontendUrl}/llms.txt" title="LLM-readable site summary">

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
  <main>
    <article>
      <header>
        <h1>${escapeHtml(buildBlogHeadline(post))}</h1>
        <p class="byline">By ${escapeHtml(post.author?.name || 'Bodilicious Team')}${published ? ` · <time datetime="${escapeHtml(published)}">${escapeHtml(String(published).slice(0, 10))}</time>` : ''}</p>
      </header>
      ${sanitizeBlogHtml(post.content)}
    </article>
    ${relatedProducts.length ? `<section aria-labelledby="related-products-h">
      <h2 id="related-products-h">Products mentioned in this guide</h2>
      <ul>${relatedProducts.map(p =>
        `<li><a href="${frontendUrl}/product/${escapeHtml(p.pid)}">${escapeHtml(p.name)}</a> — ₹${escapeHtml(String(p.price))}</li>`
      ).join('')}</ul>
    </section>` : ''}
  </main>
  ${renderTrustFooter(frontendUrl)}
</body>
</html>`;
}

// ─── Static Page Bot Renderer ───────────────────────────────────────────────

/**
 * Rewrite the SPA shell's head with the correct metadata for a static page.
 *
 * Deliberately NOT a full replacement page — it streams the origin response
 * through HTMLRewriter rather than synthesising one, so the SPA stays intact
 * and JS-capable crawlers still render the real page. Clients that never run
 * JS (every social unfurler, and any audit tool that doesn't execute JS)
 * previously got just the bare `<div id="root"></div>` shell: no title match,
 * no h1, no content — showing up as "thin content" and near-0% text-to-HTML
 * ratio on every one of these pages regardless of how much real copy the
 * React component actually renders. The h1 and a couple of real paragraphs
 * (STATIC_PAGE_SEO[pathname].body, copied verbatim from the component) are
 * injected into #root to fix that, without going as far as a full stub page.
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
    .on('link[rel="alternate"][hreflang="en-IN"]', setAttr('href', url))
    .on('link[rel="alternate"][hreflang="x-default"]', setAttr('href', `${frontendUrl}/`))
    .on('meta[property="og:title"]', setAttr('content', meta.title))
    .on('meta[property="og:description"]', setAttr('content', meta.description))
    .on('meta[property="og:url"]', setAttr('content', url))
    .on('meta[name="twitter:title"]', setAttr('content', meta.title))
    .on('meta[name="twitter:description"]', setAttr('content', meta.description))
    // This stream-through only ever reaches bots (worker.js gates it behind
    // isBot() before it runs), so it's safe to drop static content into
    // #root — real browsers never get this response, and Googlebot's later
    // JS-rendering pass fully replaces #root with the real React output
    // anyway. <main>/<article> landmarks and real <h2>/<ul> structure (not
    // just a flat run of <p> tags) are what a "semantic HTML" / "content
    // structure" check is actually looking for — product/blog/home/shop
    // bot-renders already had this via <main><article><section>; these 11
    // static routes previously had none of it, just loose children of #root.
    .on('div#root', {
      element(el) {
        const blockHtml = meta.body.map(block => {
          if (block.type === 'heading') return `<h2>${escapeHtml(block.text)}</h2>`;
          if (block.type === 'list') return `<ul>${block.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
          return `<p>${escapeHtml(block.text)}</p>`;
        }).join('');
        el.prepend(
          `<main><article><h1>${escapeHtml(meta.h1)}</h1>${blockHtml}</article></main>`,
          { html: true }
        );
        // These 11 routes were the only bot-rendered pages missing the
        // trust footer (product/blog/home/shop already have it) — meaning
        // a crawler landing on /terms or /privacy had no path at all to
        // About/Contact/Privacy/Terms, which is exactly what an E-E-A-T
        // check flags as a missing trust signal.
        el.append(renderTrustFooter(frontendUrl), { html: true });
      },
    })
    .transform(response);
}

/**
 * Blog index: correct metadata plus an ItemList naming every published post.
 *
 * Same approach as rewriteStaticMeta — augment the real page rather than
 * replace it. The ItemList is appended to <head> so non-JS clients still learn
 * what articles exist; a matching visible <ul> of the same links goes into
 * #root (via rewriteStaticMeta's body injection) so it isn't just JSON-LD —
 * this page's real post titles were otherwise invisible to any crawler that
 * doesn't execute JS, same thin-content gap as the other static pages.
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
  if (!posts.length) return withMeta;

  const postLinks = posts.slice(0, 50)
    .map(p => `<li><a href="${frontendUrl}/blogs/${encodeURIComponent(p.slug)}">${escapeHtml(buildBlogHeadline(p))}</a></li>`)
    .join('');

  return new HTMLRewriter()
    .on('head', {
      element(el) {
        if (itemList) {
          el.append(
            `<script type="application/ld+json">${safeJsonLd(itemList)}</script>`,
            { html: true }
          );
        }
      },
    })
    .on('div#root', {
      element(el) { el.append(`<ul>${postLinks}</ul>`, { html: true }); },
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

// ─── Homepage Bot Renderer ──────────────────────────────────────────────────
// The homepage is entirely client-rendered — hero carousel, best sellers,
// categories are all fetched and painted by React after mount. A bot that
// doesn't execute JS (most AI crawlers) got literally <div id="root"></div>
// and nothing else, regardless of whether it's on the isBot() allowlist,
// because worker.js never intercepted "/" at all. This is the single
// highest-traffic entry point, so it gets the same treatment as product/
// blog/shop pages: real brand copy, category links, and a product ItemList.

/**
 * Render a bot-readable HTML page for "/". Mirrors index.html's static
 * Organization/WebSite JSON-LD (kept in sync manually — index.html is the
 * source of truth for those two schemas) and adds a Product ItemList built
 * from live catalog data, which index.html cannot provide statically.
 */
export function renderHomeHtml(products, frontendUrl) {
  const title = 'Bodilicious — Premium Skincare & Haircare';
  const description = 'Dermatologically tested skincare & haircare with science-backed actives. Free shipping over ₹1500. Shop now.';
  const image = `${frontendUrl}/og-image.png`;

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Bodilicious',
    url: frontendUrl,
    logo: { '@type': 'ImageObject', url: `${frontendUrl}/logo.webp` },
    description: 'Premium skincare and haircare brand offering dermatologically tested, science-backed beauty products.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '3/1, Varadaraja Perumal Koil St, Sanjeevarayanpet, Tondiarpet',
      addressLocality: 'Chennai',
      addressRegion: 'Tamil Nadu',
      postalCode: '600081',
      addressCountry: 'IN',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Bodilicious',
    url: frontendUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${frontendUrl}/shop?search={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  const itemList = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Bodilicious Best Sellers',
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${frontendUrl}/product/${p.pid}`,
      item: {
        '@type': 'Product',
        name: p.name,
        url: `${frontendUrl}/product/${p.pid}`,
        ...(p.images?.[0] ? { image: toAbsoluteUrl(p.images[0], frontendUrl) } : {}),
        ...(p.price != null ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: String(p.price),
            availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        } : {}),
      },
    })),
  } : null;

  const schemas = [orgSchema, websiteSchema, ...(itemList ? [itemList] : [])];

  const categoryLinks = [
    ['skin', 'Skin Care'],
    ['hair', 'Hair Care'],
    ['body', 'Body Care'],
    ['lip', 'Lip Care'],
    ['makeup', 'Makeup'],
  ].map(([slug, label]) => `<li><a href="${frontendUrl}/shop?category=${slug}">${escapeHtml(label)}</a></li>`).join('');

  const productListHtml = products.map(p =>
    `<article><h3><a href="${frontendUrl}/product/${escapeHtml(p.pid)}">${escapeHtml(p.name)}</a></h3><p>₹${escapeHtml(String(p.price))}</p></article>`
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${frontendUrl}/">
  <link rel="alternate" hreflang="en-IN" href="${frontendUrl}/">
  <link rel="alternate" hreflang="x-default" href="${frontendUrl}/">
  <link rel="llms.txt" href="${frontendUrl}/llms.txt" title="LLM-readable site summary">

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${frontendUrl}/" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  </script>
</head>
<body>
  <main>
    <header>
      <h1>Bodilicious — Premium Skincare &amp; Haircare</h1>
      <p>Bodilicious is a certified, registered Indian beauty brand making dermatologically tested, science-backed skincare and haircare — hand-made, chemical-free formulations targeting specific concerns like acne, pigmentation, aging, hair loss, and dandruff. Free shipping across India on orders over ₹1500.</p>
    </header>
    <nav aria-labelledby="categories-h">
      <h2 id="categories-h">Shop by Category</h2>
      <ul>${categoryLinks}</ul>
    </nav>
    <section aria-labelledby="products-h">
      <h2 id="products-h">Best Selling Products</h2>
      ${productListHtml}
      <p><a href="${frontendUrl}/shop">View all products</a></p>
    </section>
  </main>
  ${renderTrustFooter(frontendUrl)}
</body>
</html>`;
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
  const ITEM_LIMIT = 20;
  const itemList = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageTitle,
    numberOfItems: Math.min(products.length, ITEM_LIMIT),
    itemListElement: products.slice(0, ITEM_LIMIT).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${frontendUrl}/product/${p.pid}`,
      item: {
        '@type': 'Product',
        name: p.name,
        url: `${frontendUrl}/product/${p.pid}`,
        ...(p.images?.[0] ? { image: toAbsoluteUrl(p.images[0], frontendUrl) } : {}),
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
  <link rel="alternate" hreflang="en-IN" href="${canonicalUrl}">
  <link rel="alternate" hreflang="x-default" href="${frontendUrl}/">
  <link rel="llms.txt" href="${frontendUrl}/llms.txt" title="LLM-readable site summary">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${frontendUrl}/og-image.png">
  <meta property="og:image:alt" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${frontendUrl}/og-image.png">
  <script type="application/ld+json">${safeJsonLd(schemas)}</script>
</head>
<body>
  <nav aria-label="breadcrumb"><a href="${frontendUrl}/">Home</a> › <a href="${frontendUrl}/shop">Shop</a>${label ? ` › ${escapeHtml(label)}` : ''}</nav>
  <main>
    <header>
      <h1>${escapeHtml(pageTitle.replace(' — Bodilicious', ''))}</h1>
      <p>${escapeHtml(intro)}</p>
    </header>
    <section aria-labelledby="product-list-h">
      <h2 id="product-list-h" class="sr-only">Products</h2>
      ${productListHtml}
    </section>
  </main>
  ${renderTrustFooter(frontendUrl)}
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
