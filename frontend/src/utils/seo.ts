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

/** The subset of Product this module needs. Both callers satisfy it structurally. */
export interface SeoProductLike {
  name?: string;
  category?: string;
  sub_category?: string;
  product_type?: string;
  concerns_targeted?: string[];
  seo_keywords?: SeoKeywordGroups | string | null;
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

function nthOf(
  raw: SeoProductLike['seo_keywords'],
  group: keyof SeoKeywordGroups,
  index: number,
): string {
  if (!raw || typeof raw === 'string') return '';
  const value = raw[group]?.[index];
  return value ? String(value).trim() : '';
}

/** First primary keyword — the one worth spending title characters on. */
export function primaryKeyword(product?: SeoProductLike | null): string {
  return product ? nthOf(product.seo_keywords, 'primary', 0) : '';
}

/** First secondary keyword — used for image alt text. */
export function secondaryKeyword(product?: SeoProductLike | null): string {
  return product ? nthOf(product.seo_keywords, 'secondary', 0) : '';
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
 */
export function buildProductTitle(product?: SeoProductLike | null): string {
  const name = (product?.name || '').trim();
  if (!name) return `Product — ${BRAND}`;

  const nameLower = name.toLowerCase();
  const hasBrand = nameLower.includes(BRAND.toLowerCase());
  const base = hasBrand ? name : `${name} — ${BRAND}`;

  const keyword = primaryKeyword(product);
  if (keyword && !nameLower.includes(keyword.toLowerCase())) {
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
  const name = (product?.name || '').trim();
  if (!name) return undefined;
  const secondary = secondaryKeyword(product);
  return secondary ? `${name} - ${secondary}` : `${name} by ${BRAND}`;
}
