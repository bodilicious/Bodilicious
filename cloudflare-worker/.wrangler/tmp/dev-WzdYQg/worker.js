var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../frontend/src/utils/seo.ts
var BRAND = "Bodilicious";
var MAX_TITLE_LENGTH = 60;
var MAX_DESCRIPTION_LENGTH = 120;
function truncateAtWord(text, maxLen) {
  const clean = String(text || "").trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "\u2026";
}
__name(truncateAtWord, "truncateAtWord");
function normaliseKeywordGroups(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [
    ...raw.primary || [],
    ...raw.secondary || []
  ].map((k) => String(k).trim()).filter(Boolean);
}
__name(normaliseKeywordGroups, "normaliseKeywordGroups");
function groupOf(raw, group) {
  if (!raw || typeof raw === "string") return [];
  return (raw[group] || []).map((k) => String(k).trim()).filter(Boolean);
}
__name(groupOf, "groupOf");
function secondaryKeyword(product, notContainedIn = "") {
  const haystack = notContainedIn.toLowerCase();
  const candidates = groupOf(product?.seo_keywords, "secondary");
  return candidates.find((k) => !haystack || !haystack.includes(k.toLowerCase())) || "";
}
__name(secondaryKeyword, "secondaryKeyword");
function buildProductTitle(product) {
  const override = (product?.seo_title || "").trim();
  if (override) return override;
  const name = (product?.name || "").trim();
  if (!name) return `Product \u2014 ${BRAND}`;
  const nameLower = name.toLowerCase();
  const hasBrand = nameLower.includes(BRAND.toLowerCase());
  const base = hasBrand ? name : `${name} \u2014 ${BRAND}`;
  const candidates = groupOf(product?.seo_keywords, "primary").filter((k) => !nameLower.includes(k.toLowerCase()));
  for (const keyword of candidates) {
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
  const override = (product?.seo_image_alt || "").trim();
  if (override) return override;
  const name = (product?.name || "").trim();
  if (!name) return void 0;
  const secondary = secondaryKeyword(product, name);
  return secondary ? `${name} - ${secondary}` : `${name} by ${BRAND}`;
}
__name(buildProductOgAlt, "buildProductOgAlt");
var p = /* @__PURE__ */ __name((text) => ({ type: "paragraph", text }), "p");
var h = /* @__PURE__ */ __name((text) => ({ type: "heading", text }), "h");
var ul = /* @__PURE__ */ __name((items) => ({ type: "list", items }), "ul");
var STATIC_PAGE_SEO = {
  "/about": {
    title: "About Bodilicious \u2014 Our Story & Mission",
    description: "Bodilicious is a certified Indian beauty brand offering science-backed skincare and haircare. Learn our story.",
    h1: "About Bodilicious",
    body: [
      p("Bodilicious is a certified licenced brand, officially recognized in India as a registered beauty and skincare company. Our focus is on targeted skincare aimed at combating hair loss, premature greying, skin dullness, aging, pigmentation, and more."),
      h("About Us"),
      p("Our product line encompasses everything from skin to hair care. Our products are hand-made, free from chemicals, and dermatologically tested. We believe in treating skin problems at the source rather than simply hiding them."),
      h("Committed to Quality"),
      p("Bodilicious natural products are target-oriented skincare products. We suggest the right products to our customers in the ocean of skin care products, so you are using the right products for your skin or hair concern. Quality should never be a compromise."),
      h("Our Leadership"),
      p("Bhanuja Polani, Founder & Formulator, is a biomedical engineer with an M.Tech in Biotechnology. Her background is in understanding how biological systems respond to compounds at a molecular level, not in marketing.")
    ]
  },
  "/brand-story": {
    title: "Our Brand Story \u2014 Bodilicious",
    description: "Founded by Dr. Bhanuja Polani, Bodilicious blends biomedical science with tradition for targeted skincare.",
    h1: "Brand Story",
    body: [
      p("Bodilicious was born from a personal journey of discovery and determination. Like many people, Dr. Bhanuja Polani struggled to find skincare products that truly suited her skin. This experience inspired her to create something different \u2014 a skincare brand that understands the real needs of people and delivers effective yet gentle solutions."),
      p("With a strong academic background in Biomedical Engineering and M.Tech in Biotechnology, Dr. Bhanuja Polani combined scientific knowledge with her passion for skincare to develop formulations that work in harmony with the skin."),
      h("Our Philosophy"),
      p("One of the unique aspects of Bodilicious is its structured skincare philosophy. Rather than offering temporary fixes, the brand focuses on gradual and sustainable skin improvement, with routines built around 3-month, 6-month, and 9-month programs and personalized follow-ups along the way."),
      h("Our Leadership"),
      p("The brand's products are thoughtfully designed to address a wide range of skin and hair concerns including age spots, freckles, tanning, acne, dark circles, hair fall, and dandruff, under the continued leadership of founder Dr. Bhanuja Polani.")
    ]
  },
  "/contact": {
    title: "Contact Us \u2014 Bodilicious",
    description: "Get in touch with the Bodilicious team \u2014 questions about products, shipping, or feedback, we are here to help.",
    h1: "Contact Us",
    body: [
      p("Get in touch and let us know how we can help. Whether you have a question about our products, shipping, or anything else, our team is ready to answer all your questions."),
      p("Address: 3/1, Varadaraja Perumal Koil St, Sanjeevarayanpet, Tondiarpet, Chennai, Tamil Nadu 600081. Email: bodiliciousnaturalproducts@gmail.com. Phone/WhatsApp: +91 9894451947.")
    ]
  },
  "/faqs": {
    title: "FAQs \u2014 Bodilicious",
    description: "Answers to common questions about Bodilicious products, shipping, and payments.",
    h1: "Frequently Asked Questions",
    body: [
      p("Quick answers about Bodilicious products, shipping, and everything in between.")
    ]
  },
  "/blogs": {
    title: "Blog | Bodilicious",
    description: "Skincare tips, ingredient guides, and beauty rituals from the Bodilicious team.",
    h1: "Blogs",
    body: [
      p("Skincare science, beauty rituals, and ingredient deep-dives from the Bodilicious team.")
    ]
  },
  "/offers": {
    title: "Welcome Offer \u2014 10% Off Your First Order | Bodilicious",
    description: "New to Bodilicious? Enjoy 10% off your first order. Dermatologically tested, free shipping over \u20B91500.",
    h1: "The Welcome Ritual",
    body: [
      p("Experience the Bodilicious difference with 10% off your first intentional skincare purchase.")
    ]
  },
  "/how-to-order": {
    title: "How to Order \u2014 Bodilicious",
    description: "A step-by-step walkthrough to placing an order on Bodilicious \u2014 discover, select, checkout, and track.",
    h1: "How to Place Your Order",
    body: [
      p("Experience premium convenience. Discover how to purchase your favorite Bodilicious skincare rituals and track their journey to your home.")
    ]
  },
  "/ritual-finder": {
    title: "Skincare Ritual Finder \u2014 Bodilicious",
    description: "Answer a few questions and get a personalized Bodilicious skincare or haircare routine for your needs.",
    h1: "Find Your Perfect Bodilicious Ritual",
    body: [
      p("For your skin, body, or hair \u2014 Bodilicious will curate a personalized routine that truly works for you.")
    ]
  },
  "/terms": {
    title: "Terms & Conditions \u2014 Bodilicious",
    description: "The Terms and Conditions governing use of the Bodilicious website, products, and intellectual property.",
    h1: "Terms of Conditions",
    body: [
      p("Welcome to Bodilicious. By accessing or using our website, you agree to be bound by the Terms and Conditions set forth below. If you do not agree, please do not use this website."),
      h("Use of the Site & Features"),
      p("The Bodilicious.in website is provided solely for your personal use. You may not use this website for any commercial purpose without our express written consent. We grant you a limited, revocable, and non-exclusive license to access and make personal use of the website."),
      h("Intellectual Property"),
      p("All content available on the website, including text, graphics, logos, images, and software, is the property of Bodilicious or its content suppliers and is protected by intellectual property laws."),
      h("Liability & Disputes"),
      ul([
        "Product Descriptions: We strive to ensure accuracy, but errors may occur. If we discover an error in price, we will inform you as soon as possible.",
        "Indemnification: You agree to indemnify and hold harmless Bodilicious from any claims arising from your use of this website.",
        "Disputes: Any dispute relating to your visit shall be submitted to confidential arbitration in India, except for small claims court."
      ])
    ]
  },
  "/privacy": {
    title: "Privacy Policy \u2014 Bodilicious",
    description: "The Bodilicious Privacy Policy \u2014 how we collect, use, and protect your personal data when you shop.",
    h1: "Privacy Policy",
    body: [
      p("Welcome to Bodilicious. We are committed to protecting your privacy and ensuring you have a seamless, secure experience on our platform. By using our website, you agree to the practices described below."),
      h("Data We Collect"),
      ul([
        "Personal Data: email, first/last name, phone number, and address details.",
        "Usage & Interaction Data: product views, items added to your cart, and wishlist activity, alongside standard analytics.",
        "Cookies: small pieces of data stored on your device to track activity on our website."
      ]),
      h("How We Use It"),
      ul([
        "To provide and maintain our website",
        "To notify you about changes",
        "To provide customer support",
        "To personalize recommendations and analyze shopping behaviors to improve our website",
        "To monitor usage and detect technical issues"
      ]),
      h("Transfer & Disclosure"),
      p("Your information may be transferred to computers located outside of your jurisdiction; we take all necessary steps to ensure data is treated securely. We do not sell, trade, or transfer your personally identifiable information to outside parties unless we provide advance notice.")
    ]
  },
  "/shipping-refund": {
    title: "Shipping & Returns Policy \u2014 Bodilicious",
    description: "Free shipping over \u20B91500. Bodilicious delivery timelines, international shipping, and 7-day returns.",
    h1: "Shipping & Refund Policy",
    body: [
      p("We are committed to delivering your Bodilicious rituals with speed, accuracy, and care."),
      h("Shipping Policy"),
      ul([
        "Methods & Costs: shipping costs are calculated based on the shipping method selected, weight, dimensions, and delivery address.",
        "Domestic Shipping: orders are shipped on business days only; a tracking number is provided once your order has shipped.",
        "International Shipping: rates and fees vary by destination; customs fees or taxes are the responsibility of the customer.",
        "Delivery Times: influenced by product availability, geographic location, and the chosen shipping carrier."
      ]),
      h("Refund Policy"),
      ul([
        "Returns: a 7-day return policy for products in original, unused condition with the original receipt.",
        "Exchanges & Replacements: return the original item for a refund and place a new order to exchange for a different size or colour.",
        "Refund Process: refunds are processed to the original payment method within 7-10 business days of receiving the returned item.",
        "Return Shipping: the customer is responsible for return shipping costs unless the item is defective or incorrect."
      ])
    ]
  }
};
function stripHtml(html) {
  return String(html || "").replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}
__name(stripHtml, "stripHtml");
function withBrandOnce(text) {
  const clean = text.trim();
  if (!clean) return BRAND;
  return clean.toLowerCase().includes(BRAND.toLowerCase()) ? clean : `${clean} | ${BRAND}`;
}
__name(withBrandOnce, "withBrandOnce");
function buildBlogTitle(post) {
  if (!post) return `Blog | ${BRAND}`;
  const base = (post.seo_title || post.title || "").trim();
  if (!base) return `Blog | ${BRAND}`;
  return withBrandOnce(base);
}
__name(buildBlogTitle, "buildBlogTitle");
function buildBlogDescription(post) {
  if (!post) return `Skincare and haircare guides from ${BRAND}.`;
  const override = (post.seo_description || "").trim();
  if (override) return truncateAtWord(override, MAX_DESCRIPTION_LENGTH);
  const excerpt = (post.excerpt || "").trim();
  if (excerpt) return truncateAtWord(excerpt, MAX_DESCRIPTION_LENGTH);
  const body = stripHtml(post.content);
  if (body) return truncateAtWord(body, MAX_DESCRIPTION_LENGTH);
  return `Skincare and haircare guides from ${BRAND}.`;
}
__name(buildBlogDescription, "buildBlogDescription");
function buildBlogKeywords(post) {
  if (!post) return void 0;
  const auto = [
    post.title,
    ...(post.categories || []).map((c) => c?.name).filter(Boolean),
    ...post.tags || [],
    `${BRAND} blog`
  ].filter(Boolean);
  const seen = /* @__PURE__ */ new Set();
  return [...auto, ...normaliseKeywordGroups(post.seo_keywords)].filter((k) => {
    const key = String(k).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(", ");
}
__name(buildBlogKeywords, "buildBlogKeywords");
function buildBlogHeadline(post) {
  const raw = (post?.title || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/\s*[|–—-]\s*Bodilicious\s*$/i, "").trim();
  return stripped || raw;
}
__name(buildBlogHeadline, "buildBlogHeadline");
function buildBlogOgAlt(post) {
  const title = (post?.title || "").trim();
  if (!title) return void 0;
  const secondary = post ? groupOf(post.seo_keywords, "secondary")[0] : "";
  return secondary ? `${title} - ${secondary}` : title;
}
__name(buildBlogOgAlt, "buildBlogOgAlt");
function buildProductDescription(product) {
  const override = (product?.seo_description || "").trim();
  if (override) return truncateAtWord(override, MAX_DESCRIPTION_LENGTH);
  const description = (product?.description || "").trim();
  if (description) return truncateAtWord(description, MAX_DESCRIPTION_LENGTH);
  return "Premium skincare and haircare from Bodilicious. Dermatologically tested, science-backed formulas.";
}
__name(buildProductDescription, "buildProductDescription");
function buildProductH1(product) {
  const override = (product?.seo_h1 || "").trim();
  if (override) return override;
  return (product?.name || "").trim() || "Product";
}
__name(buildProductH1, "buildProductH1");
function buildProductH2s(product) {
  const overrides = (product?.seo_h2 || []).map((h2) => String(h2).trim()).filter(Boolean);
  if (overrides.length) return overrides;
  if (!product) return [];
  const name = (product.name || "").trim();
  const derived = [
    product.benefits?.length ? `Benefits of ${name}` : "",
    product.ingredients ? `Key Ingredients in ${name}` : "",
    product.how_to_use?.length || product.usage ? `How to Use ${name}` : ""
  ];
  return derived.filter(Boolean);
}
__name(buildProductH2s, "buildProductH2s");

// seoUtils.js
var BOT_UA_PATTERNS = /googlebot|google-extended|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|facebookexternalhit|whatsapp|discordbot|telegrambot|slackbot|redditbot|twitterbot|linkedinbot|applebot|applebot-extended|semrushbot|ahrefsbot|pinterest|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|cohere-ai|perplexitybot|perplexity-user|amazonbot|meta-externalagent|ccbot|bytespider|omgili|youbot|python-requests|python-urllib|python\/|curl\/|wget\/|libwww-perl|got\/|axios\/|node-fetch|postmanruntime|insomnia\//i;
function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return BOT_UA_PATTERNS.test(userAgent);
}
__name(isBot, "isBot");
var LEGACY_COLLECTION_MAP = {
  all: "/shop",
  "shop-all": "/shop",
  "skin-care": "/shop?category=skin",
  skincare: "/shop?category=skin",
  "hair-care": "/shop?category=hair",
  haircare: "/shop?category=hair",
  "body-care": "/shop?category=body",
  lipcare: "/shop?category=lip",
  "lip-care": "/shop?category=lip",
  makeup: "/shop?category=makeup",
  foundation: "/shop?category=makeup"
};
var LEGACY_PAGE_MAP = {
  "brand-story": "/brand-story",
  about: "/about",
  "about-us": "/about",
  contact: "/contact",
  "contact-us": "/contact",
  faq: "/faqs",
  faqs: "/faqs",
  "shipping-policy": "/shipping-refund",
  "refund-policy": "/shipping-refund",
  "return-policy": "/shipping-refund",
  "terms-of-service": "/terms",
  "terms-conditions": "/terms",
  "privacy-policy": "/privacy"
};
var LEGACY_GONE_PATTERNS = [
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
  /^\/wpm@/
];
function getLegacyShopifyAction(pathname) {
  for (const pattern of LEGACY_GONE_PATTERNS) {
    if (pattern.test(pathname)) return { type: "gone" };
  }
  const isLegacySlug = /* @__PURE__ */ __name((segment) => /^[a-zA-Z0-9_-]+$/.test(segment), "isLegacySlug");
  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch && isLegacySlug(productMatch[1])) {
    return { type: "redirect", to: "/shop" };
  }
  const collectionMatch = pathname.match(/^\/collections\/([^/]+)\/?$/);
  if (collectionMatch && isLegacySlug(collectionMatch[1])) {
    const to = LEGACY_COLLECTION_MAP[collectionMatch[1].toLowerCase()] || "/shop";
    return { type: "redirect", to };
  }
  const pageMatch = pathname.match(/^\/pages\/([^/]+)\/?$/);
  if (pageMatch && isLegacySlug(pageMatch[1])) {
    const to = LEGACY_PAGE_MAP[pageMatch[1].toLowerCase()] || "/about";
    return { type: "redirect", to };
  }
  return null;
}
__name(getLegacyShopifyAction, "getLegacyShopifyAction");
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
__name(safeJsonLd, "safeJsonLd");
function toAbsoluteUrl(url, frontendUrl) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${frontendUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}
__name(toAbsoluteUrl, "toAbsoluteUrl");
function renderTrustFooter(frontendUrl) {
  return `<footer>
    <p>Dermatologically tested, science-backed skincare and haircare \u2014 Bodilicious is a certified, registered Indian beauty brand.</p>
    <nav aria-label="Company">
      <a href="${frontendUrl}/about">About Bodilicious</a>
      <a href="${frontendUrl}/contact">Contact Us</a>
      <a href="${frontendUrl}/privacy">Privacy Policy</a>
      <a href="${frontendUrl}/terms">Terms &amp; Conditions</a>
    </nav>
  </footer>`;
}
__name(renderTrustFooter, "renderTrustFooter");
function buildProductSchema(product, frontendUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: toAbsoluteUrl(product.images?.[0], frontendUrl),
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
      seller: { "@type": "Organization", name: "Bodilicious" },
      // Matches the real policy on /shipping-refund: 7-day window on unused
      // items with the original receipt, customer pays return shipping
      // unless the item is defective or incorrect. Not adding shippingDetails
      // alongside this — the real shipping cost is "calculated based on
      // method, weight, dimensions, and address" (i.e. genuinely variable
      // below the ₹1500 free-shipping threshold), so there's no single
      // honest flat rate to declare here.
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnShippingFees"
      }
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
  const productDesc = buildProductDescription(product);
  const h1 = buildProductH1(product);
  const h2s = buildProductH2s(product);
  const absImage = toAbsoluteUrl(product.images?.[0], frontendUrl);
  const list = /* @__PURE__ */ __name((items) => items && items.length ? `<ul>${items.map((i) => `<li>${escapeHtml(String(i))}</li>`).join("")}</ul>` : "", "list");
  const ing = product.ingredients || {};
  const allIngredients = [
    ...ing.key_actives || [],
    ...ing.botanical_extracts || [],
    ...ing.others || []
  ];
  const usageLine = product.usage && typeof product.usage === "object" ? [product.usage.time, product.usage.frequency, product.usage.routine_step].filter(Boolean).join(" \xB7 ") : "";
  const faqs = (product.faqs || []).filter((f) => f && f.question && f.answer);
  const faqSchema = faqs.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: String(f.question),
      acceptedAnswer: { "@type": "Answer", text: String(f.answer) }
    }))
  } : null;
  const relatedBlogs = (product.relatedBlogs || []).filter((b) => b && b.slug && b.title);
  const reviewBlock = (product.reviews || []).slice(0, 5).filter((r) => r && r.comment).map((r) => `<blockquote><p>${escapeHtml(String(r.comment))}</p>
      <cite>${escapeHtml(String(r.user || "Customer"))} \u2014 ${escapeHtml(String(r.rating ?? ""))}/5</cite></blockquote>`).join("");
  const sections = [
    product.benefits?.length ? `<section aria-labelledby="benefits-h"><h2 id="benefits-h">${escapeHtml(h2s[0] || "Benefits")}</h2>${list(product.benefits)}</section>` : "",
    allIngredients.length ? `<section aria-labelledby="ingredients-h"><h2 id="ingredients-h">${escapeHtml(h2s[1] || "Key Ingredients")}</h2>${list(allIngredients)}</section>` : "",
    product.how_to_use?.length || usageLine ? `<section aria-labelledby="how-to-use-h"><h2 id="how-to-use-h">${escapeHtml(h2s[2] || "How to Use")}</h2>${list(product.how_to_use)}${usageLine ? `<p>${escapeHtml(usageLine)}</p>` : ""}</section>` : "",
    product.concerns_targeted?.length ? `<section aria-labelledby="targets-h"><h2 id="targets-h">Targets</h2>${list(product.concerns_targeted.map(titleCase))}</section>` : "",
    product.warnings?.length ? `<section aria-labelledby="warnings-h"><h2 id="warnings-h">Warnings</h2>${list(product.warnings)}</section>` : "",
    reviewBlock ? `<section aria-labelledby="reviews-h"><h2 id="reviews-h">Customer Reviews</h2>${reviewBlock}</section>` : "",
    faqs.length ? `<section aria-labelledby="faq-h"><h2 id="faq-h">Frequently Asked Questions</h2>${faqs.map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`).join("")}</section>` : "",
    relatedBlogs.length ? `<section aria-labelledby="read-more-h"><h2 id="read-more-h">Read More</h2><ul>${relatedBlogs.map(
      (b) => `<li><a href="${frontendUrl}/blogs/${encodeURIComponent(b.slug)}">${escapeHtml(b.title)}</a></li>`
    ).join("")}</ul></section>` : ""
  ].filter(Boolean).join("\n  ");
  const schemas = [
    buildProductSchema(product, frontendUrl),
    buildBreadcrumbSchema(product, frontendUrl),
    ...faqSchema ? [faqSchema] : []
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
  <\/script>
</head>
<body>
  <main>
    <article>
      <header>
        <h1>${escapeHtml(h1)}</h1>
        <p>${escapeHtml(product.description || "")}</p>
        <p>Price: \u20B9${escapeHtml(String(product.price))}</p>
        ${product.rating && product.ratingCount ? `<p>Rated ${escapeHtml(String(product.rating.toFixed ? product.rating.toFixed(1) : product.rating))} out of 5 (${escapeHtml(String(product.ratingCount))} reviews)</p>` : ""}
        <!-- Same trust badges as the real product page's trust bar (ProductPage.tsx) \u2014
             previously only present as aggregateRating in JSON-LD, with no visible
             trust signal in the body text a crawler could actually read. -->
        <ul aria-label="Trust signals">
          <li>7-Day Returns \u2014 Hassle-free</li>
          <li>Secure SSL \u2014 100% Secure</li>
          <li>Delivery SLA \u2014 Fast Shipping</li>
          <li>Verified Science \u2014 Dermatologically Tested</li>
        </ul>
      </header>
      ${sections}
    </article>
  </main>
  ${renderTrustFooter(frontendUrl)}
</body>
</html>`;
}
__name(renderProductHtml, "renderProductHtml");
var BLOG_ALLOWED_TAGS = /* @__PURE__ */ new Set([
  "p",
  "br",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "blockquote"
]);
function sanitizeBlogHtml(html) {
  return String(html || "").replace(/<(script|style|iframe|object|embed|form|svg)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<(script|style|iframe|object|embed|form|svg)[^>]*\/?>/gi, "").replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    const name = tag.toLowerCase();
    if (!BLOG_ALLOWED_TAGS.has(name)) return "";
    return match.startsWith("</") ? `</${name}>` : `<${name}>`;
  });
}
__name(sanitizeBlogHtml, "sanitizeBlogHtml");
function renderBlogHtml(post, frontendUrl) {
  const pageTitle = buildBlogTitle(post);
  const description = buildBlogDescription(post);
  const keywords = buildBlogKeywords(post) || "";
  const ogAlt = buildBlogOgAlt(post) || "";
  const url = `${frontendUrl}/blogs/${encodeURIComponent(post.slug || "")}`;
  const image = toAbsoluteUrl(post.coverImage, frontendUrl);
  const published = post.publishedAt || post.createdAt || null;
  const modified = post.updatedAt || published;
  const relatedProducts = (post.relatedProducts || []).filter((p2) => p2 && p2.pid && p2.name);
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: buildBlogHeadline(post).slice(0, 110),
      // Google caps headline at 110
      description,
      image: image || void 0,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      // author is an unpopulated ref on current posts, so attribute to the
      // organisation rather than emitting an invalid/empty Person.
      author: { "@type": "Organization", name: "Bodilicious", url: frontendUrl },
      publisher: {
        "@type": "Organization",
        name: "Bodilicious",
        url: frontendUrl
      },
      ...published ? { datePublished: published } : {},
      ...modified ? { dateModified: modified } : {},
      ...post.tags?.length ? { keywords: post.tags.join(", ") } : {}
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${frontendUrl}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${frontendUrl}/blogs` },
        { "@type": "ListItem", position: 3, name: buildBlogHeadline(post), item: url }
      ]
    }
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
  <link rel="llms.txt" href="${frontendUrl}/llms.txt" title="LLM-readable site summary">

  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />
  ${published ? `<meta property="article:published_time" content="${escapeHtml(published)}" />` : ""}
  ${modified ? `<meta property="article:modified_time" content="${escapeHtml(modified)}" />` : ""}
  ${(post.tags || []).map((t) => `<meta property="article:tag" content="${escapeHtml(String(t))}" />`).join("\n  ")}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  <\/script>
</head>
<body>
  <main>
    <article>
      <header>
        <h1>${escapeHtml(buildBlogHeadline(post))}</h1>
        <p class="byline">By ${escapeHtml(post.author?.name || "Bodilicious Team")}${published ? ` \xB7 <time datetime="${escapeHtml(published)}">${escapeHtml(String(published).slice(0, 10))}</time>` : ""}</p>
      </header>
      ${sanitizeBlogHtml(post.content)}
    </article>
    ${relatedProducts.length ? `<section aria-labelledby="related-products-h">
      <h2 id="related-products-h">Products mentioned in this guide</h2>
      <ul>${relatedProducts.map(
    (p2) => `<li><a href="${frontendUrl}/product/${escapeHtml(p2.pid)}">${escapeHtml(p2.name)}</a> \u2014 \u20B9${escapeHtml(String(p2.price))}</li>`
  ).join("")}</ul>
    </section>` : ""}
  </main>
  ${renderTrustFooter(frontendUrl)}
</body>
</html>`;
}
__name(renderBlogHtml, "renderBlogHtml");
function rewriteStaticMeta(response, pathname, frontendUrl) {
  const meta = STATIC_PAGE_SEO[pathname];
  if (!meta) return response;
  const url = `${frontendUrl}${pathname}`;
  const setAttr = /* @__PURE__ */ __name((name, value) => ({
    element(el) {
      el.setAttribute(name, value);
    }
  }), "setAttr");
  return new HTMLRewriter().on("title", {
    element(el) {
      el.setInnerContent(meta.title);
    }
  }).on('meta[name="description"]', setAttr("content", meta.description)).on('link[rel="canonical"]', setAttr("href", url)).on('meta[property="og:title"]', setAttr("content", meta.title)).on('meta[property="og:description"]', setAttr("content", meta.description)).on('meta[property="og:url"]', setAttr("content", url)).on('meta[name="twitter:title"]', setAttr("content", meta.title)).on('meta[name="twitter:description"]', setAttr("content", meta.description)).on("div#root", {
    element(el) {
      const blockHtml = meta.body.map((block) => {
        if (block.type === "heading") return `<h2>${escapeHtml(block.text)}</h2>`;
        if (block.type === "list") return `<ul>${block.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
        return `<p>${escapeHtml(block.text)}</p>`;
      }).join("");
      el.prepend(
        `<main><article><h1>${escapeHtml(meta.h1)}</h1>${blockHtml}</article></main>`,
        { html: true }
      );
      el.append(renderTrustFooter(frontendUrl), { html: true });
    }
  }).transform(response);
}
__name(rewriteStaticMeta, "rewriteStaticMeta");
function rewriteBlogIndex(response, posts, frontendUrl) {
  const itemList = posts.length ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: STATIC_PAGE_SEO["/blogs"].title,
    numberOfItems: posts.length,
    itemListElement: posts.slice(0, 50).map((p2, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${frontendUrl}/blogs/${encodeURIComponent(p2.slug)}`,
      name: buildBlogHeadline(p2)
    }))
  } : null;
  const withMeta = rewriteStaticMeta(response, "/blogs", frontendUrl);
  if (!posts.length) return withMeta;
  const postLinks = posts.slice(0, 50).map((p2) => `<li><a href="${frontendUrl}/blogs/${encodeURIComponent(p2.slug)}">${escapeHtml(buildBlogHeadline(p2))}</a></li>`).join("");
  return new HTMLRewriter().on("head", {
    element(el) {
      if (itemList) {
        el.append(
          `<script type="application/ld+json">${safeJsonLd(itemList)}<\/script>`,
          { html: true }
        );
      }
    }
  }).on("div#root", {
    element(el) {
      el.append(`<ul>${postLinks}</ul>`, { html: true });
    }
  }).transform(withMeta);
}
__name(rewriteBlogIndex, "rewriteBlogIndex");
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
function renderHomeHtml(products, frontendUrl) {
  const title = "Bodilicious \u2014 Premium Skincare & Haircare";
  const description = "Dermatologically tested skincare & haircare with science-backed actives. Free shipping over \u20B91500. Shop now.";
  const image = `${frontendUrl}/og-image.png`;
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bodilicious",
    url: frontendUrl,
    logo: { "@type": "ImageObject", url: `${frontendUrl}/logo.webp` },
    description: "Premium skincare and haircare brand offering dermatologically tested, science-backed beauty products.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "3/1, Varadaraja Perumal Koil St, Sanjeevarayanpet, Tondiarpet",
      addressLocality: "Chennai",
      addressRegion: "Tamil Nadu",
      postalCode: "600081",
      addressCountry: "IN"
    }
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bodilicious",
    url: frontendUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${frontendUrl}/shop?search={search_term_string}` },
      "query-input": "required name=search_term_string"
    }
  };
  const itemList = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bodilicious Best Sellers",
    numberOfItems: products.length,
    itemListElement: products.map((p2, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${frontendUrl}/product/${p2.pid}`,
      item: {
        "@type": "Product",
        name: p2.name,
        url: `${frontendUrl}/product/${p2.pid}`,
        ...p2.images?.[0] ? { image: toAbsoluteUrl(p2.images[0], frontendUrl) } : {},
        ...p2.price != null ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: String(p2.price),
            availability: p2.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
          }
        } : {}
      }
    }))
  } : null;
  const schemas = [orgSchema, websiteSchema, ...itemList ? [itemList] : []];
  const categoryLinks = [
    ["skin", "Skin Care"],
    ["hair", "Hair Care"],
    ["body", "Body Care"],
    ["lip", "Lip Care"],
    ["makeup", "Makeup"]
  ].map(([slug, label]) => `<li><a href="${frontendUrl}/shop?category=${slug}">${escapeHtml(label)}</a></li>`).join("");
  const productListHtml = products.map(
    (p2) => `<article><h3><a href="${frontendUrl}/product/${escapeHtml(p2.pid)}">${escapeHtml(p2.name)}</a></h3><p>\u20B9${escapeHtml(String(p2.price))}</p></article>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${frontendUrl}/">
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
  <\/script>
</head>
<body>
  <main>
    <header>
      <h1>Bodilicious \u2014 Premium Skincare &amp; Haircare</h1>
      <p>Bodilicious is a certified, registered Indian beauty brand making dermatologically tested, science-backed skincare and haircare \u2014 hand-made, chemical-free formulations targeting specific concerns like acne, pigmentation, aging, hair loss, and dandruff. Free shipping across India on orders over \u20B91500.</p>
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
__name(renderHomeHtml, "renderHomeHtml");
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
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p2, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${frontendUrl}/product/${p2.pid}`,
      item: {
        "@type": "Product",
        name: p2.name,
        url: `${frontendUrl}/product/${p2.pid}`,
        ...p2.images?.[0] ? { image: toAbsoluteUrl(p2.images[0], frontendUrl) } : {},
        ...p2.price != null ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: String(p2.price),
            availability: p2.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
          }
        } : {}
      }
    }))
  } : null;
  const schemas = [breadcrumb, ...itemList ? [itemList] : []];
  const productListHtml = products.slice(0, 30).map(
    (p2) => `<article><h2><a href="${frontendUrl}/product/${escapeHtml(p2.pid)}">${escapeHtml(p2.name)}</a></h2><p>\u20B9${escapeHtml(String(p2.price))}</p></article>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="llms.txt" href="${frontendUrl}/llms.txt" title="LLM-readable site summary">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${safeJsonLd(schemas)}<\/script>
</head>
<body>
  <nav aria-label="breadcrumb"><a href="${frontendUrl}/">Home</a> \u203A <a href="${frontendUrl}/shop">Shop</a>${label ? ` \u203A ${escapeHtml(label)}` : ""}</nav>
  <main>
    <header>
      <h1>${escapeHtml(pageTitle.replace(" \u2014 Bodilicious", ""))}</h1>
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
    const legacyAction = getLegacyShopifyAction(pathname);
    if (legacyAction) {
      const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
      if (legacyAction.type === "redirect") {
        return Response.redirect(`${frontendUrl}${legacyAction.to}`, 301);
      }
      return new Response(
        '<!doctype html><html lang="en"><head><title>Gone</title><meta name="robots" content="noindex, nofollow"></head><body>This resource no longer exists.</body></html>',
        { status: 410, headers: { "Content-Type": "text/html;charset=UTF-8" } }
      );
    }
    if (pathname === "/product-feed.xml") {
      return handleProductFeed(env);
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
    if (pathname.startsWith("/blogs/")) {
      const rawSlug = pathname.split("/")[2];
      const slug = rawSlug ? decodeURIComponent(rawSlug).trim() : null;
      if (slug) {
        return handleBlog(slug, request, env, ctx);
      }
    }
    if (pathname === "/blogs" && !url.search) {
      return handleBlogIndex(request, env, fetchFromOrigin);
    }
    if (pathname === "/" && !url.search) {
      return handleHome(request, env, ctx);
    }
    if (STATIC_PAGE_SEO[pathname]) {
      const originResponse = await fetchFromOrigin();
      const contentType = originResponse.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return originResponse;
      return rewriteStaticMeta(
        originResponse,
        pathname,
        env.FRONTEND_URL || "https://bodilicious.in"
      );
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
async function handleHome(request, env, ctx) {
  try {
    const now = Date.now();
    const cacheKey = "home";
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
    const apiUrl = env.API_BASE_URL || "https://bodilicious-cxow.onrender.com";
    const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
    let products = [];
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/v1/products?slim=true&limit=24`);
      if (res.ok) {
        const data = await res.json();
        products = (data.data || data.products || []).filter((p2) => p2.isActive !== false).sort((a, b) => Number(b.rating || 0) * Number(b.ratingCount || 0) - Number(a.rating || 0) * Number(a.ratingCount || 0)).slice(0, 12);
      }
    } catch (_) {
    }
    const html = renderHomeHtml(products, frontendUrl);
    cache.set(cacheKey, { html, expiresAt: now + TTL_MS });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (error) {
    console.error("[SEO Worker] Error rendering homepage:", error.message);
    return fetch(request);
  }
}
__name(handleHome, "handleHome");
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
async function handleBlog(slug, request, env, ctx) {
  try {
    const now = Date.now();
    const cacheKey = `blog:${slug}`;
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
    const apiUrl = env.API_BASE_URL || "https://bodilicious.onrender.com";
    const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
    const res = await fetchWithTimeout(`${apiUrl}/api/v1/blogs/${encodeURIComponent(slug)}`);
    const notFound = /* @__PURE__ */ __name(() => new Response(
      '<!doctype html><html lang="en"><head><title>Article Not Found \u2014 Bodilicious</title><meta name="robots" content="noindex, nofollow"></head><body>Not Found</body></html>',
      { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } }
    ), "notFound");
    if (res.status === 404) return notFound();
    if (!res.ok) return fetch(request);
    const data = await res.json();
    const post = data.data || data.blog;
    if (!data.success || !post) return notFound();
    if (post.status && post.status !== "published") return notFound();
    const html = renderBlogHtml(post, frontendUrl);
    cache.set(cacheKey, { html, expiresAt: now + TTL_MS });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      console.error(`[SEO Worker] Timeout fetching blog ${slug} \u2014 Render backend may be cold-starting`);
    } else {
      console.error(`[SEO Worker] Error fetching blog ${slug}:`, error.message);
    }
    return fetch(request);
  }
}
__name(handleBlog, "handleBlog");
async function handleBlogIndex(request, env, fetchFromOrigin) {
  const frontendUrl = env.FRONTEND_URL || "https://bodilicious.in";
  try {
    const originResponse = await fetchFromOrigin();
    const contentType = originResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return originResponse;
    const apiUrl = env.API_BASE_URL || "https://bodilicious.onrender.com";
    let posts = [];
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/v1/blogs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        posts = (data.data || data.blogs || []).filter((p2) => p2 && p2.slug);
      }
    } catch (apiErr) {
      console.error("[SEO Worker] Blog index list fetch failed:", apiErr.name);
    }
    return rewriteBlogIndex(originResponse, posts, frontendUrl);
  } catch (error) {
    console.error("[SEO Worker] Blog index rewrite failed:", error.message);
    return fetchFromOrigin();
  }
}
__name(handleBlogIndex, "handleBlogIndex");
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
    allProducts.forEach((p2) => {
      if (p2.availability !== "Discontinued") {
        const lastmod = p2.updatedAt ? p2.updatedAt.substring(0, 10) : (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
        urls.push(`
  <url>
    <loc>${frontendUrl}/product/${p2.pid}</loc>
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
var GOOGLE_PRODUCT_CATEGORY = {
  skin: "Health & Beauty > Personal Care > Cosmetics > Skin Care",
  hair: "Health & Beauty > Personal Care > Hair Care",
  body: "Health & Beauty > Personal Care > Cosmetics > Skin Care > Body Care",
  makeup: "Health & Beauty > Personal Care > Cosmetics > Makeup",
  lip: "Health & Beauty > Personal Care > Cosmetics > Makeup > Lip Makeup",
  other: "Health & Beauty > Personal Care"
};
function escapeXml(unsafe) {
  return String(unsafe ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(escapeXml, "escapeXml");
async function handleProductFeed(env) {
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
    const items = allProducts.filter((p2) => p2.price != null && Array.isArray(p2.images) && p2.images.length > 0).map((p2) => {
      const availability = Number(p2.stock) > 0 ? "in stock" : "out of stock";
      const toAbsolute = /* @__PURE__ */ __name((img) => img.startsWith("http") ? img : `${frontendUrl}${img}`, "toAbsolute");
      const [primaryImage, ...restImages] = p2.images;
      const extraImageTags = restImages.slice(0, 10).map((img) => `
    <g:additional_image_link>${escapeXml(toAbsolute(img))}</g:additional_image_link>`).join("");
      return `
  <item>
    <g:id>${escapeXml(p2.pid)}</g:id>
    <title>${escapeXml(p2.name)}</title>
    <description>${escapeXml(p2.description || p2.name)}</description>
    <link>${frontendUrl}/product/${escapeXml(p2.pid)}</link>
    <g:image_link>${escapeXml(toAbsolute(primaryImage))}</g:image_link>${extraImageTags}
    <g:availability>${availability}</g:availability>
    <g:price>${Number(p2.price).toFixed(2)} INR</g:price>
    <g:brand>${escapeXml(p2.brand || "Bodilicious")}</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
    <g:google_product_category>${escapeXml(GOOGLE_PRODUCT_CATEGORY[p2.category] || GOOGLE_PRODUCT_CATEGORY.other)}</g:google_product_category>
  </item>`;
    }).join("");
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
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error("Error generating product feed:", error);
    return new Response("Error generating product feed", {
      status: 500,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  }
}
__name(handleProductFeed, "handleProductFeed");

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-PbwbS5/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-PbwbS5/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
