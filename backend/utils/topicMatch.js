import escapeStringRegexp from "escape-string-regexp";

/**
 * Topic matching for product ↔ blog internal linking.
 *
 * The obvious implementation — exact-match a product's concerns against a blog's
 * tags — returns nothing on the real data, because the published posts carry
 * editorial placeholder text in the tags field rather than tags:
 *
 *   "retinol / actives (ingredient-based)"
 *   "pigmentation (concern-based)"
 *
 * So instead of exact equality we extract distinctive terms and match them with
 * word boundaries against both the title and the tags. "pigmentation" then hits
 * the tag above, and "retinol" hits the title "Retinol for Beginners", which is
 * the link we actually want. Tidying the tags later only improves this.
 */

/**
 * Words too generic to link on. Matching "serum" would relate every serum to
 * every serum article, which is noise rather than a relevant internal link.
 */
const GENERIC_TERMS = new Set([
  "bodilicious", "skin", "hair", "body", "lip", "makeup", "care", "skincare",
  "haircare", "serum", "cream", "oil", "face", "wash", "gel", "bar", "soap",
  "balm", "spray", "with", "for", "and", "the", "your", "best", "new",
  "liquid", "night", "day", "hydrating", "organic", "natural", "premium",
]);

/** Minimum length for a token to count as distinctive. */
const MIN_TERM_LENGTH = 5;

/**
 * Turn arbitrary product/blog fields into a de-duplicated list of
 * word-boundary regexes suitable for a Mongo `$in`.
 */
export function buildTopicPatterns(sources) {
  const terms = new Set();

  for (const source of sources) {
    if (!source) continue;
    const normalised = String(source).toLowerCase().replace(/[_/]+/g, " ").trim();
    if (!normalised) continue;

    // Multi-word phrases are inherently specific — keep them whole.
    if (normalised.includes(" ")) {
      const phrase = normalised.replace(/\s+/g, " ");
      if (phrase.length >= MIN_TERM_LENGTH && !GENERIC_TERMS.has(phrase)) {
        terms.add(phrase);
      }
    }

    // Plus any distinctive single token (catches "retinol" inside a long name).
    for (const token of normalised.split(/[^a-z0-9]+/)) {
      if (token.length >= MIN_TERM_LENGTH && !GENERIC_TERMS.has(token)) {
        terms.add(token);
      }
    }
  }

  // Cap the pattern count so a product with a long taxonomy can't build a
  // pathological query.
  return [...terms]
    .slice(0, 12)
    .map(t => new RegExp(`\\b${escapeStringRegexp(t)}\\b`, "i"));
}
