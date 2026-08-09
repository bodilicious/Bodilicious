"use strict";
/**
 * Shared product SEO builders.
 *
 * IMPORTANT: this module is imported by BOTH
 *   - frontend/src/pages/ProductPage.tsx  (browser, via Vite)
 *   - cloudflare-worker/seoUtils.js       (bot renderer, via wrangler/esbuild)
 *
 * Those two must produce byte-identical titles, keywords and OG tags. They used
 * to be two hand-maintained copies kept in step by a "SYNC: must match" comment,
 * which is how bot HTML and browser HTML quietly drift apart — and serving
 * crawlers something different from users is cloaking. One implementation, two
 * importers, no drift.
 *
 * Keep this file free of browser and Workers globals so both bundlers can use it.
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATIC_PAGE_SEO = exports.MAX_DESCRIPTION_LENGTH = void 0;
exports.primaryKeyword = primaryKeyword;
exports.secondaryKeyword = secondaryKeyword;
exports.buildProductTitle = buildProductTitle;
exports.buildProductKeywords = buildProductKeywords;
exports.buildProductOgAlt = buildProductOgAlt;
exports.usableFaqs = usableFaqs;
exports.buildFaqSchema = buildFaqSchema;
exports.stripHtml = stripHtml;
exports.buildBlogTitle = buildBlogTitle;
exports.buildBlogDescription = buildBlogDescription;
exports.buildBlogKeywords = buildBlogKeywords;
exports.buildBlogHeadline = buildBlogHeadline;
exports.buildBlogOgAlt = buildBlogOgAlt;
exports.buildProductDescription = buildProductDescription;
exports.buildProductH1 = buildProductH1;
exports.buildProductH2s = buildProductH2s;
var BRAND = 'Bodilicious';
/**
 * Google renders roughly 600px of title, which is about 60 characters. Longer
 * titles still index fine, but the tail is replaced with an ellipsis in results
 * — and the tail is exactly where the target keyword sat under the old template.
 */
var MAX_TITLE_LENGTH = 60;
/**
 * Google's SERP truncation is pixel-width based (~920px), not character-based.
 * 155 chars of typical mixed-case English renders at ~1150-1230px — comfortably
 * over the cutoff, which is why "155-160 characters" as a target still gets
 * flagged as too wide. ~7.8px/char average means 120 chars stays safely under.
 */
exports.MAX_DESCRIPTION_LENGTH = 120;
/** Trim to a whole word rather than mid-word, appending an ellipsis. */
function truncateAtWord(text, maxLen) {
    var clean = String(text || '').trim();
    if (clean.length <= maxLen)
        return clean;
    var cut = clean.slice(0, maxLen);
    var lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}
/** seo_keywords is an object today but was a comma-separated string historically. */
function normaliseKeywordGroups(raw) {
    if (!raw)
        return [];
    if (typeof raw === 'string') {
        return raw.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
    }
    return __spreadArray(__spreadArray([], (raw.primary || []), true), (raw.secondary || []), true).map(function (k) { return String(k).trim(); }).filter(Boolean);
}
function groupOf(raw, group) {
    if (!raw || typeof raw === 'string')
        return [];
    return (raw[group] || []).map(function (k) { return String(k).trim(); }).filter(Boolean);
}
/**
 * First primary keyword usable in the title — the one worth spending title
 * characters on. Scans the whole list rather than just index 0: an admin who
 * enters several keywords expects all of them to be candidates, not just the
 * first, and a later one may fit where an earlier one doesn't or is already
 * redundant with the product name.
 */
function primaryKeyword(product, notContainedIn) {
    if (notContainedIn === void 0) { notContainedIn = ''; }
    var haystack = notContainedIn.toLowerCase();
    var candidates = groupOf(product === null || product === void 0 ? void 0 : product.seo_keywords, 'primary');
    return candidates.find(function (k) { return !haystack || !haystack.includes(k.toLowerCase()); }) || '';
}
/**
 * First secondary keyword usable for image alt text — same multi-candidate
 * scan as primaryKeyword, so every entry in the list can actually be used,
 * not just the first.
 */
function secondaryKeyword(product, notContainedIn) {
    if (notContainedIn === void 0) { notContainedIn = ''; }
    var haystack = notContainedIn.toLowerCase();
    var candidates = groupOf(product === null || product === void 0 ? void 0 : product.seo_keywords, 'secondary');
    return candidates.find(function (k) { return !haystack || !haystack.includes(k.toLowerCase()); }) || '';
}
/**
 * Build the <title>.
 *
 * Two rules keep it inside MAX_TITLE_LENGTH without losing the keyword:
 *
 *  1. Don't repeat the brand. Product names already begin with "Bodilicious",
 *     so the old `${name} - ${kw} | Bodilicious` template printed it twice and
 *     burned 14 characters saying nothing.
 *  2. Don't append a keyword the name already contains. "Bodilicious Retinol
 *     Night Cream - retinol night cream" is pure duplication, and Google treats
 *     the repetition as a spam signal rather than a relevance one.
 *
 * If appending would still overflow, the name alone wins — a complete title
 * beats a truncated one with a half-visible keyword.
 *
 * Tries every primary keyword in order, not just the first — a keyword list
 * is a prioritised set of candidates, and one further down the list may fit
 * (or add something new) where an earlier one doesn't.
 */
function buildProductTitle(product) {
    // An editorially-set title always wins — a human chose it deliberately.
    var override = ((product === null || product === void 0 ? void 0 : product.seo_title) || '').trim();
    if (override)
        return override;
    var name = ((product === null || product === void 0 ? void 0 : product.name) || '').trim();
    if (!name)
        return "Product \u2014 ".concat(BRAND);
    var nameLower = name.toLowerCase();
    var hasBrand = nameLower.includes(BRAND.toLowerCase());
    var base = hasBrand ? name : "".concat(name, " \u2014 ").concat(BRAND);
    var candidates = groupOf(product === null || product === void 0 ? void 0 : product.seo_keywords, 'primary')
        .filter(function (k) { return !nameLower.includes(k.toLowerCase()); });
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var keyword = candidates_1[_i];
        var withKeyword = hasBrand
            ? "".concat(name, " - ").concat(keyword)
            : "".concat(name, " - ").concat(keyword, " | ").concat(BRAND);
        if (withKeyword.length <= MAX_TITLE_LENGTH)
            return withKeyword;
    }
    return base;
}
/**
 * Build the meta keywords string: derived attributes first, then the curated
 * seo_keywords, de-duplicated case-insensitively while preserving order.
 *
 * Note that Google has ignored meta keywords since 2009 and Bing ignores it too,
 * so this tag carries no ranking weight. It is kept because it costs nothing and
 * some internal tooling reads it; the real value of seo_keywords is the title
 * above, the OG alt text below, and backend product search.
 */
function buildProductKeywords(product) {
    if (!product)
        return undefined;
    var autoKeywords = __spreadArray(__spreadArray([
        product.name,
        product.category,
        product.sub_category,
        product.product_type
    ], (product.concerns_targeted || []), true), [
        BRAND,
        'dermatologically tested',
    ], false).filter(Boolean);
    var seen = new Set();
    return __spreadArray(__spreadArray([], autoKeywords, true), normaliseKeywordGroups(product.seo_keywords), true).filter(function (keyword) {
        var key = String(keyword).toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .join(', ');
}
/** Alt text for the OG/Twitter image. */
function buildProductOgAlt(product) {
    var override = ((product === null || product === void 0 ? void 0 : product.seo_image_alt) || '').trim();
    if (override)
        return override;
    var name = ((product === null || product === void 0 ? void 0 : product.name) || '').trim();
    if (!name)
        return undefined;
    var secondary = secondaryKeyword(product, name);
    return secondary ? "".concat(name, " - ").concat(secondary) : "".concat(name, " by ").concat(BRAND);
}
var p = function (text) { return ({ type: 'paragraph', text: text }); };
var h = function (text) { return ({ type: 'heading', text: text }); };
var ul = function (items) { return ({ type: 'list', items: items }); };
exports.STATIC_PAGE_SEO = {
    '/about': {
        title: 'About Bodilicious — Our Story & Mission',
        description: 'Bodilicious is a certified Indian beauty brand offering science-backed skincare and haircare. Learn our story.',
        h1: 'About Bodilicious',
        body: [
            p('Bodilicious is a certified licenced brand, officially recognized in India as a registered beauty and skincare company. Our focus is on targeted skincare aimed at combating hair loss, premature greying, skin dullness, aging, pigmentation, and more.'),
            h('About Us'),
            p('Our product line encompasses everything from skin to hair care. Our products are hand-made, free from chemicals, and dermatologically tested. We believe in treating skin problems at the source rather than simply hiding them.'),
            h('Committed to Quality'),
            p('Bodilicious natural products are target-oriented skincare products. We suggest the right products to our customers in the ocean of skin care products, so you are using the right products for your skin or hair concern. Quality should never be a compromise.'),
            h('Our Leadership'),
            p('Bhanuja Polani, Founder & Formulator, is a biomedical engineer with an M.Tech in Biotechnology. Her background is in understanding how biological systems respond to compounds at a molecular level, not in marketing.'),
        ],
    },
    '/brand-story': {
        title: 'Our Brand Story — Bodilicious',
        description: 'Founded by Dr. Bhanuja Polani, Bodilicious blends biomedical science with tradition for targeted skincare.',
        h1: 'Brand Story',
        body: [
            p('Bodilicious was born from a personal journey of discovery and determination. Like many people, Dr. Bhanuja Polani struggled to find skincare products that truly suited her skin. This experience inspired her to create something different — a skincare brand that understands the real needs of people and delivers effective yet gentle solutions.'),
            p('With a strong academic background in Biomedical Engineering and M.Tech in Biotechnology, Dr. Bhanuja Polani combined scientific knowledge with her passion for skincare to develop formulations that work in harmony with the skin.'),
            h('Our Philosophy'),
            p('One of the unique aspects of Bodilicious is its structured skincare philosophy. Rather than offering temporary fixes, the brand focuses on gradual and sustainable skin improvement, with routines built around 3-month, 6-month, and 9-month programs and personalized follow-ups along the way.'),
            h('Our Leadership'),
            p("The brand's products are thoughtfully designed to address a wide range of skin and hair concerns including age spots, freckles, tanning, acne, dark circles, hair fall, and dandruff, under the continued leadership of founder Dr. Bhanuja Polani."),
        ],
    },
    '/contact': {
        title: 'Contact Us — Bodilicious',
        description: 'Get in touch with the Bodilicious team — questions about products, shipping, or feedback, we are here to help.',
        h1: 'Contact Us',
        body: [
            p('Get in touch and let us know how we can help. Whether you have a question about our products, shipping, or anything else, our team is ready to answer all your questions.'),
            p('Address: 3/1, Varadaraja Perumal Koil St, Sanjeevarayanpet, Tondiarpet, Chennai, Tamil Nadu 600081. Email: bodiliciousnaturalproducts@gmail.com. Phone/WhatsApp: +91 9894451947.'),
        ],
    },
    '/faqs': {
        title: 'FAQs — Bodilicious',
        description: 'Answers to common questions about Bodilicious products, shipping, and payments.',
        h1: 'Frequently Asked Questions',
        body: [
            p('Quick answers about Bodilicious products, shipping, and everything in between.'),
        ],
    },
    '/blogs': {
        title: 'Blog | Bodilicious',
        description: 'Skincare tips, ingredient guides, and beauty rituals from the Bodilicious team.',
        h1: 'Blogs',
        body: [
            p('Skincare science, beauty rituals, and ingredient deep-dives from the Bodilicious team.'),
        ],
    },
    '/offers': {
        title: 'Welcome Offer — 10% Off Your First Order | Bodilicious',
        description: 'New to Bodilicious? Enjoy 10% off your first order. Dermatologically tested, free shipping over ₹1500.',
        h1: 'The Welcome Ritual',
        body: [
            p('Experience the Bodilicious difference with 10% off your first intentional skincare purchase.'),
        ],
    },
    '/how-to-order': {
        title: 'How to Order — Bodilicious',
        description: 'A step-by-step walkthrough to placing an order on Bodilicious — discover, select, checkout, and track.',
        h1: 'How to Place Your Order',
        body: [
            p('Experience premium convenience. Discover how to purchase your favorite Bodilicious skincare rituals and track their journey to your home.'),
        ],
    },
    '/ritual-finder': {
        title: 'Skincare Ritual Finder — Bodilicious',
        description: 'Answer a few questions and get a personalized Bodilicious skincare or haircare routine for your needs.',
        h1: 'Find Your Perfect Bodilicious Ritual',
        body: [
            p("For your skin, body, or hair — Bodilicious will curate a personalized routine that truly works for you."),
        ],
    },
    '/terms': {
        title: 'Terms & Conditions — Bodilicious',
        description: 'The Terms and Conditions governing use of the Bodilicious website, products, and intellectual property.',
        h1: 'Terms of Conditions',
        body: [
            p('Welcome to Bodilicious. By accessing or using our website, you agree to be bound by the Terms and Conditions set forth below. If you do not agree, please do not use this website.'),
            h('Use of the Site & Features'),
            p('The Bodilicious.in website is provided solely for your personal use. You may not use this website for any commercial purpose without our express written consent. We grant you a limited, revocable, and non-exclusive license to access and make personal use of the website.'),
            h('Intellectual Property'),
            p('All content available on the website, including text, graphics, logos, images, and software, is the property of Bodilicious or its content suppliers and is protected by intellectual property laws.'),
            h('Liability & Disputes'),
            ul([
                'Product Descriptions: We strive to ensure accuracy, but errors may occur. If we discover an error in price, we will inform you as soon as possible.',
                'Indemnification: You agree to indemnify and hold harmless Bodilicious from any claims arising from your use of this website.',
                'Disputes: Any dispute relating to your visit shall be submitted to confidential arbitration in India, except for small claims court.',
            ]),
        ],
    },
    '/privacy': {
        title: 'Privacy Policy — Bodilicious',
        description: 'The Bodilicious Privacy Policy — how we collect, use, and protect your personal data when you shop.',
        h1: 'Privacy Policy',
        body: [
            p('Welcome to Bodilicious. We are committed to protecting your privacy and ensuring you have a seamless, secure experience on our platform. By using our website, you agree to the practices described below.'),
            h('Data We Collect'),
            ul([
                'Personal Data: email, first/last name, phone number, and address details.',
                'Usage & Interaction Data: product views, items added to your cart, and wishlist activity, alongside standard analytics.',
                'Cookies: small pieces of data stored on your device to track activity on our website.',
            ]),
            h('How We Use It'),
            ul([
                'To provide and maintain our website',
                'To notify you about changes',
                'To provide customer support',
                'To personalize recommendations and analyze shopping behaviors to improve our website',
                'To monitor usage and detect technical issues',
            ]),
            h('Transfer & Disclosure'),
            p('Your information may be transferred to computers located outside of your jurisdiction; we take all necessary steps to ensure data is treated securely. We do not sell, trade, or transfer your personally identifiable information to outside parties unless we provide advance notice.'),
        ],
    },
    '/shipping-refund': {
        title: 'Shipping & Returns Policy — Bodilicious',
        description: 'Free shipping over ₹1500. Bodilicious delivery timelines, international shipping, and 7-day returns.',
        h1: 'Shipping & Refund Policy',
        body: [
            p('We are committed to delivering your Bodilicious rituals with speed, accuracy, and care.'),
            h('Shipping Policy'),
            ul([
                'Methods & Costs: shipping costs are calculated based on the shipping method selected, weight, dimensions, and delivery address.',
                'Domestic Shipping: orders are shipped on business days only; a tracking number is provided once your order has shipped.',
                'International Shipping: rates and fees vary by destination; customs fees or taxes are the responsibility of the customer.',
                'Delivery Times: influenced by product availability, geographic location, and the chosen shipping carrier.',
            ]),
            h('Refund Policy'),
            ul([
                'Returns: a 7-day return policy for products in original, unused condition with the original receipt.',
                'Exchanges & Replacements: return the original item for a refund and place a new order to exchange for a different size or colour.',
                'Refund Process: refunds are processed to the original payment method within 7-10 business days of receiving the returned item.',
                'Return Shipping: the customer is responsible for return shipping costs unless the item is defective or incorrect.',
            ]),
        ],
    },
};
/**
 * Only entries with both a question and an answer are usable. Google discards
 * the entire FAQPage block if any mainEntity is incomplete, so one blank row
 * would silently cost you all of them.
 */
function usableFaqs(faqs) {
    return (faqs || [])
        .map(function (f) { return ({ question: String((f === null || f === void 0 ? void 0 : f.question) || '').trim(), answer: String((f === null || f === void 0 ? void 0 : f.answer) || '').trim() }); })
        .filter(function (f) { return f.question && f.answer; });
}
/**
 * FAQPage structured data, or undefined when there is nothing valid to emit.
 *
 * Worth knowing: since 2023 Google only shows FAQ *rich results* for
 * authoritative government and health sites, so this will rarely render as
 * dropdowns in the SERP. It still earns its place — the questions become real
 * indexable page content and are eligible for featured snippets.
 */
function buildFaqSchema(faqs) {
    var valid = usableFaqs(faqs);
    if (!valid.length)
        return undefined;
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: valid.map(function (f) { return ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
        }); }),
    };
}
/** Strip HTML tags and collapse whitespace — for deriving text from rich content. */
function stripHtml(html) {
    return String(html || '')
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Append the brand only when it isn't already in the string. */
function withBrandOnce(text) {
    var clean = text.trim();
    if (!clean)
        return BRAND;
    return clean.toLowerCase().includes(BRAND.toLowerCase()) ? clean : "".concat(clean, " | ").concat(BRAND);
}
/**
 * Blog <title>.
 *
 * Blog titles are stored already brand-suffixed ("… Safely | Bodilicious"), and
 * the old template appended the brand again, producing "… | Bodilicious |
 * Bodilicious" at ~95 characters. Same defect the product titles had.
 */
function buildBlogTitle(post) {
    if (!post)
        return "Blog | ".concat(BRAND);
    var base = (post.seo_title || post.title || '').trim();
    if (!base)
        return "Blog | ".concat(BRAND);
    return withBrandOnce(base);
}
/**
 * Blog meta description: editorial override, then excerpt, then the opening of
 * the article body. Falling through to the body matters — excerpt is empty on
 * every post currently published.
 */
function buildBlogDescription(post) {
    if (!post)
        return "Skincare and haircare guides from ".concat(BRAND, ".");
    var override = (post.seo_description || '').trim();
    if (override)
        return truncateAtWord(override, exports.MAX_DESCRIPTION_LENGTH);
    var excerpt = (post.excerpt || '').trim();
    if (excerpt)
        return truncateAtWord(excerpt, exports.MAX_DESCRIPTION_LENGTH);
    var body = stripHtml(post.content);
    if (body)
        return truncateAtWord(body, exports.MAX_DESCRIPTION_LENGTH);
    return "Skincare and haircare guides from ".concat(BRAND, ".");
}
/** Blog meta keywords: title, categories and tags, then the curated keywords. */
function buildBlogKeywords(post) {
    if (!post)
        return undefined;
    var auto = __spreadArray(__spreadArray(__spreadArray([
        post.title
    ], (post.categories || []).map(function (c) { return c === null || c === void 0 ? void 0 : c.name; }).filter(Boolean), true), (post.tags || []), true), [
        "".concat(BRAND, " blog"),
    ], false).filter(Boolean);
    var seen = new Set();
    return __spreadArray(__spreadArray([], auto, true), normaliseKeywordGroups(post.seo_keywords), true).filter(function (k) {
        var key = String(k).toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .join(', ');
}
/**
 * The article headline for <h1> and schema.org `headline`.
 *
 * Blog titles are stored with the brand suffix baked in ("… Safely |
 * Bodilicious") because that field doubles as the <title>. A brand suffix is
 * correct in a title tag and wrong in an H1 — the visible heading should read
 * as a headline, not a SERP entry — so strip it here.
 */
function buildBlogHeadline(post) {
    var raw = ((post === null || post === void 0 ? void 0 : post.title) || '').trim();
    if (!raw)
        return '';
    var stripped = raw.replace(/\s*[|–—-]\s*Bodilicious\s*$/i, '').trim();
    return stripped || raw;
}
/** Alt text for the blog cover image. */
function buildBlogOgAlt(post) {
    var title = ((post === null || post === void 0 ? void 0 : post.title) || '').trim();
    if (!title)
        return undefined;
    var secondary = post ? groupOf(post.seo_keywords, 'secondary')[0] : '';
    return secondary ? "".concat(title, " - ").concat(secondary) : title;
}
/**
 * Meta description. Uses the editorial override when set, otherwise falls back
 * to the product description trimmed to what Google will actually display.
 *
 * A hand-written description matters more than most metadata: Google frequently
 * rewrites it, but when it doesn't, this is the sales copy in the search result.
 */
function buildProductDescription(product) {
    var override = ((product === null || product === void 0 ? void 0 : product.seo_description) || '').trim();
    if (override)
        return truncateAtWord(override, exports.MAX_DESCRIPTION_LENGTH);
    // Strip HTML tags before using as plain-text meta description — description
    // is now stored as Tiptap HTML so raw <p>/<strong> tags must be removed.
    var description = stripHtml((product === null || product === void 0 ? void 0 : product.description) || '').trim();
    if (description)
        return truncateAtWord(description, exports.MAX_DESCRIPTION_LENGTH);
    return 'Premium skincare and haircare from Bodilicious. Dermatologically tested, science-backed formulas.';
}
/**
 * The visible <h1>. Exactly one per page — it is the strongest on-page signal
 * after the title, and the bot renderer and React page must agree on it.
 */
function buildProductH1(product) {
    var override = ((product === null || product === void 0 ? void 0 : product.seo_h1) || '').trim();
    if (override)
        return override;
    return ((product === null || product === void 0 ? void 0 : product.name) || '').trim() || 'Product';
}
/**
 * Visible <h2> subheadings. Editorial values win; otherwise we derive headings
 * from structured fields the product already has, so a page that nobody has
 * hand-tuned still ships real, non-duplicate content rather than a bare h1.
 */
function buildProductH2s(product) {
    var _a, _b;
    var overrides = ((product === null || product === void 0 ? void 0 : product.seo_h2) || []).map(function (h) { return String(h).trim(); }).filter(Boolean);
    if (overrides.length)
        return overrides;
    if (!product)
        return [];
    var name = (product.name || '').trim();
    var derived = [
        ((_a = product.benefits) === null || _a === void 0 ? void 0 : _a.length) ? "Benefits of ".concat(name) : '',
        product.ingredients ? "Key Ingredients in ".concat(name) : '',
        (((_b = product.how_to_use) === null || _b === void 0 ? void 0 : _b.length) || product.usage) ? "How to Use ".concat(name) : '',
    ];
    return derived.filter(Boolean);
}
