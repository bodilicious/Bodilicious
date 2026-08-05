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

const BRAND = 'Bodilicious';

/**
 * Google renders roughly 600px of title, which is about 60 characters. Longer
 * titles still index fine, but the tail is replaced with an ellipsis in results
 * — and the tail is exactly where the target keyword sat under the old template.
 */
const MAX_TITLE_LENGTH = 60;

export interface SeoKeywordGroups {
  primary?: string[];
  secondary?: string[];
}

/** Meta descriptions are truncated by Google at roughly 155–160 characters. */
export const MAX_DESCRIPTION_LENGTH = 155;

/** The subset of Product this module needs. Both callers satisfy it structurally. */
export interface SeoProductLike {
  name?: string;
  category?: string;
  sub_category?: string;
  product_type?: string;
  concerns_targeted?: string[];
  description?: string;
  benefits?: string[];
  /**
   * Nested object ({ key_actives, botanical_extracts, others }). Typed as
   * `unknown` on purpose — this module only tests whether it is present, and a
   * narrower type would couple the shared builders to the storefront's
   * IngredientData interface, which the Workers bundle does not have.
   */
  ingredients?: unknown;
  how_to_use?: string[];
  usage?: unknown;
  seo_keywords?: SeoKeywordGroups | string | null;
  /** Editorial overrides set per-product in the admin panel. Blank = generate. */
  seo_title?: string;
  seo_description?: string;
  seo_h1?: string;
  seo_h2?: string[];
  seo_image_alt?: string;
}

/** Trim to a whole word rather than mid-word, appending an ellipsis. */
function truncateAtWord(text: string, maxLen: number): string {
  const clean = String(text || '').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** seo_keywords is an object today but was a comma-separated string historically. */
function normaliseKeywordGroups(raw: SeoProductLike['seo_keywords']): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw.split(',').map(k => k.trim()).filter(Boolean);
  }
  return [
    ...(raw.primary || []),
    ...(raw.secondary || []),
  ].map(k => String(k).trim()).filter(Boolean);
}

function groupOf(raw: SeoProductLike['seo_keywords'], group: keyof SeoKeywordGroups): string[] {
  if (!raw || typeof raw === 'string') return [];
  return (raw[group] || []).map(k => String(k).trim()).filter(Boolean);
}

/**
 * First primary keyword usable in the title — the one worth spending title
 * characters on. Scans the whole list rather than just index 0: an admin who
 * enters several keywords expects all of them to be candidates, not just the
 * first, and a later one may fit where an earlier one doesn't or is already
 * redundant with the product name.
 */
export function primaryKeyword(product?: SeoProductLike | null, notContainedIn = ''): string {
  const haystack = notContainedIn.toLowerCase();
  const candidates = groupOf(product?.seo_keywords, 'primary');
  return candidates.find(k => !haystack || !haystack.includes(k.toLowerCase())) || '';
}

/**
 * First secondary keyword usable for image alt text — same multi-candidate
 * scan as primaryKeyword, so every entry in the list can actually be used,
 * not just the first.
 */
export function secondaryKeyword(product?: SeoProductLike | null, notContainedIn = ''): string {
  const haystack = notContainedIn.toLowerCase();
  const candidates = groupOf(product?.seo_keywords, 'secondary');
  return candidates.find(k => !haystack || !haystack.includes(k.toLowerCase())) || '';
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
export function buildProductTitle(product?: SeoProductLike | null): string {
  // An editorially-set title always wins — a human chose it deliberately.
  const override = (product?.seo_title || '').trim();
  if (override) return override;

  const name = (product?.name || '').trim();
  if (!name) return `Product — ${BRAND}`;

  const nameLower = name.toLowerCase();
  const hasBrand = nameLower.includes(BRAND.toLowerCase());
  const base = hasBrand ? name : `${name} — ${BRAND}`;

  const candidates = groupOf(product?.seo_keywords, 'primary')
    .filter(k => !nameLower.includes(k.toLowerCase()));

  for (const keyword of candidates) {
    const withKeyword = hasBrand
      ? `${name} - ${keyword}`
      : `${name} - ${keyword} | ${BRAND}`;
    if (withKeyword.length <= MAX_TITLE_LENGTH) return withKeyword;
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
export function buildProductKeywords(product?: SeoProductLike | null): string | undefined {
  if (!product) return undefined;

  const autoKeywords = [
    product.name,
    product.category,
    product.sub_category,
    product.product_type,
    ...(product.concerns_targeted || []),
    BRAND,
    'dermatologically tested',
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  return [...autoKeywords, ...normaliseKeywordGroups(product.seo_keywords)]
    .filter(keyword => {
      const key = String(keyword).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

/** Alt text for the OG/Twitter image. */
export function buildProductOgAlt(product?: SeoProductLike | null): string | undefined {
  const override = (product?.seo_image_alt || '').trim();
  if (override) return override;

  const name = (product?.name || '').trim();
  if (!name) return undefined;
  const secondary = secondaryKeyword(product, name);
  return secondary ? `${name} - ${secondary}` : `${name} by ${BRAND}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   STATIC PAGES

   The Cloudflare worker only bot-rendered /product/*, /shop and /blogs/*, so
   every other route returned the SPA shell — meaning crawlers and, more
   importantly, social unfurlers saw the homepage title and description on
   /about, /contact, /faqs, /blogs and the policy pages. Google renders JS and
   recovers eventually; facebookexternalhit, whatsapp, twitterbot and
   linkedinbot never do, so every share of those pages previewed as the
   homepage card.

   These values are copied from each page's own useSEO() call. Keep them in
   step — this map is what non-JS clients receive.
   ══════════════════════════════════════════════════════════════════════════ */

export interface StaticPageSeo {
  title: string;
  description: string;
}

export const STATIC_PAGE_SEO: Record<string, StaticPageSeo> = {
  '/about': {
    title: 'About Bodilicious — Our Story & Mission',
    description: 'Bodilicious is a certified, registered Indian beauty brand offering science-backed skincare and haircare. Learn about our mission, founders, and philosophy.',
  },
  '/brand-story': {
    title: 'Our Brand Story — Bodilicious',
    description: 'Founded by Dr. Bhanuja Polani, Bodilicious blends biomedical science with traditional wisdom to create safe, targeted skincare and haircare for every concern.',
  },
  '/contact': {
    title: 'Contact Us — Bodilicious',
    description: 'Get in touch with the Bodilicious team. Write us a review, ask about products or shipping, or give feedback. We are here to help you on your skincare journey.',
  },
  '/faqs': {
    title: 'FAQs — Bodilicious',
    description: 'Find answers to the most common questions about Bodilicious products, shipping, payments, and more.',
  },
  '/blogs': {
    title: 'Blog | Bodilicious',
    description: 'Skincare tips, ingredient guides, and beauty rituals from the Bodilicious team.',
  },
  '/offers': {
    title: 'Welcome Offer — 10% Off Your First Order | Bodilicious',
    description: 'New to Bodilicious? Enjoy 10% off your first skincare or haircare order. Premium beauty products, dermatologically tested, delivered free over ₹1500.',
  },
  '/how-to-order': {
    title: 'How to Order — Bodilicious',
    description: 'An interactive, step-by-step walkthrough to placing an order on Bodilicious. Discover, select, check out, and track your package.',
  },
  '/ritual-finder': {
    title: 'Skincare Ritual Finder — Bodilicious',
    description: 'Answer a few questions and get a personalized Bodilicious skincare or haircare routine tailored to your skin type, concerns, and goals.',
  },
  '/terms': {
    title: 'Terms & Conditions — Bodilicious',
    description: 'Review the Terms and Conditions governing your use of the Bodilicious website, products, intellectual property, and dispute resolution process.',
  },
  '/privacy': {
    title: 'Privacy Policy — Bodilicious',
    description: 'Read the Bodilicious Privacy Policy to understand how we collect, use, and protect your personal data when you shop with us.',
  },
  '/shipping-refund': {
    title: 'Shipping & Returns Policy — Bodilicious',
    description: 'Free shipping on orders over ₹1500. Learn about Bodilicious delivery timelines, international shipping, 7-day returns, and our hassle-free refund process.',
  },
};

export interface SeoFaq {
  question?: string;
  answer?: string;
}

/**
 * Only entries with both a question and an answer are usable. Google discards
 * the entire FAQPage block if any mainEntity is incomplete, so one blank row
 * would silently cost you all of them.
 */
export function usableFaqs(faqs?: SeoFaq[] | null): { question: string; answer: string }[] {
  return (faqs || [])
    .map(f => ({ question: String(f?.question || '').trim(), answer: String(f?.answer || '').trim() }))
    .filter(f => f.question && f.answer);
}

/**
 * FAQPage structured data, or undefined when there is nothing valid to emit.
 *
 * Worth knowing: since 2023 Google only shows FAQ *rich results* for
 * authoritative government and health sites, so this will rarely render as
 * dropdowns in the SERP. It still earns its place — the questions become real
 * indexable page content and are eligible for featured snippets.
 */
export function buildFaqSchema(faqs?: SeoFaq[] | null): object | undefined {
  const valid = usableFaqs(faqs);
  if (!valid.length) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   BLOG
   Same contract as the product builders: shared by BlogPostPage.tsx and the
   Cloudflare bot renderer so the two can never disagree.
   ══════════════════════════════════════════════════════════════════════════ */

export interface SeoBlogLike {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  categories?: Array<{ name?: string }> | null;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: SeoKeywordGroups | string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/** Strip HTML tags and collapse whitespace — for deriving text from rich content. */
export function stripHtml(html?: string): string {
  return String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Append the brand only when it isn't already in the string. */
function withBrandOnce(text: string): string {
  const clean = text.trim();
  if (!clean) return BRAND;
  return clean.toLowerCase().includes(BRAND.toLowerCase()) ? clean : `${clean} | ${BRAND}`;
}

/**
 * Blog <title>.
 *
 * Blog titles are stored already brand-suffixed ("… Safely | Bodilicious"), and
 * the old template appended the brand again, producing "… | Bodilicious |
 * Bodilicious" at ~95 characters. Same defect the product titles had.
 */
export function buildBlogTitle(post?: SeoBlogLike | null): string {
  if (!post) return `Blog | ${BRAND}`;
  const base = (post.seo_title || post.title || '').trim();
  if (!base) return `Blog | ${BRAND}`;
  return withBrandOnce(base);
}

/**
 * Blog meta description: editorial override, then excerpt, then the opening of
 * the article body. Falling through to the body matters — excerpt is empty on
 * every post currently published.
 */
export function buildBlogDescription(post?: SeoBlogLike | null): string {
  if (!post) return `Skincare and haircare guides from ${BRAND}.`;
  const override = (post.seo_description || '').trim();
  if (override) return truncateAtWord(override, MAX_DESCRIPTION_LENGTH);

  const excerpt = (post.excerpt || '').trim();
  if (excerpt) return truncateAtWord(excerpt, MAX_DESCRIPTION_LENGTH);

  const body = stripHtml(post.content);
  if (body) return truncateAtWord(body, MAX_DESCRIPTION_LENGTH);

  return `Skincare and haircare guides from ${BRAND}.`;
}

/** Blog meta keywords: title, categories and tags, then the curated keywords. */
export function buildBlogKeywords(post?: SeoBlogLike | null): string | undefined {
  if (!post) return undefined;
  const auto = [
    post.title,
    ...((post.categories || []).map(c => c?.name).filter(Boolean) as string[]),
    ...(post.tags || []),
    `${BRAND} blog`,
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  return [...auto, ...normaliseKeywordGroups(post.seo_keywords)]
    .filter(k => {
      const key = String(k).toLowerCase();
      if (seen.has(key)) return false;
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
export function buildBlogHeadline(post?: SeoBlogLike | null): string {
  const raw = (post?.title || '').trim();
  if (!raw) return '';
  const stripped = raw.replace(/\s*[|–—-]\s*Bodilicious\s*$/i, '').trim();
  return stripped || raw;
}

/** Alt text for the blog cover image. */
export function buildBlogOgAlt(post?: SeoBlogLike | null): string | undefined {
  const title = (post?.title || '').trim();
  if (!title) return undefined;
  const secondary = post ? groupOf(post.seo_keywords, 'secondary')[0] : '';
  return secondary ? `${title} - ${secondary}` : title;
}

/**
 * Meta description. Uses the editorial override when set, otherwise falls back
 * to the product description trimmed to what Google will actually display.
 *
 * A hand-written description matters more than most metadata: Google frequently
 * rewrites it, but when it doesn't, this is the sales copy in the search result.
 */
export function buildProductDescription(product?: SeoProductLike | null): string {
  const override = (product?.seo_description || '').trim();
  if (override) return truncateAtWord(override, MAX_DESCRIPTION_LENGTH);

  const description = (product?.description || '').trim();
  if (description) return truncateAtWord(description, MAX_DESCRIPTION_LENGTH);

  return 'Premium skincare and haircare from Bodilicious. Dermatologically tested, science-backed formulas.';
}

/**
 * The visible <h1>. Exactly one per page — it is the strongest on-page signal
 * after the title, and the bot renderer and React page must agree on it.
 */
export function buildProductH1(product?: SeoProductLike | null): string {
  const override = (product?.seo_h1 || '').trim();
  if (override) return override;
  return (product?.name || '').trim() || 'Product';
}

/**
 * Visible <h2> subheadings. Editorial values win; otherwise we derive headings
 * from structured fields the product already has, so a page that nobody has
 * hand-tuned still ships real, non-duplicate content rather than a bare h1.
 */
export function buildProductH2s(product?: SeoProductLike | null): string[] {
  const overrides = (product?.seo_h2 || []).map(h => String(h).trim()).filter(Boolean);
  if (overrides.length) return overrides;
  if (!product) return [];

  const name = (product.name || '').trim();
  const derived = [
    product.benefits?.length ? `Benefits of ${name}` : '',
    product.ingredients ? `Key Ingredients in ${name}` : '',
    (product.how_to_use?.length || product.usage) ? `How to Use ${name}` : '',
  ];
  return derived.filter(Boolean) as string[];
}
