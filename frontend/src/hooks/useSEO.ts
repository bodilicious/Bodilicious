import { useEffect } from 'react';

const BASE_URL = 'https://bodilicious.in';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const BRAND = 'Bodilicious';

/** Attribute used to scope page-level JSON-LD tags — never touches global org/website schemas */
const LD_ATTR = 'data-bodilicious-ld';

/**
 * Safely serialize a JSON-LD object.
 *
 * Escapes characters that could break out of an inline <script> context:
 *   <  →  \u003c   (closes script tag)
 *   >  →  \u003e   (SGML comment end)
 *   &  →  \u0026   (entity injection)
 *   "  →  \u0022   (attribute injection)
 *   U+2028 → \u2028  (line separator — invalid in raw JS strings)
 *   U+2029 → \u2029  (paragraph separator — same)
 */
function safeStringify(obj: object): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Remove all page-level LD script tags (both new attr and legacy id) synchronously */
function removePageLdTags(): void {
  // New scoped tags
  document.querySelectorAll(`script[${LD_ATTR}]`).forEach(el => el.remove());
  // Legacy single-tag from previous implementation
  document.getElementById('bodilicious-page-jsonld')?.remove();
}

/** Inject one <script type="application/ld+json"> per schema object */
function injectLdTags(schemas: object[]): HTMLScriptElement[] {
  return schemas
    .filter((s): s is object => s !== null && typeof s === 'object')
    .map(schema => {
      const el = document.createElement('script');
      el.type = 'application/ld+json';
      el.setAttribute(LD_ATTR, '');
      el.textContent = safeStringify(schema);
      document.head.appendChild(el);
      return el;
    });
}

export interface SEOConfig {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string;
  ogImage?: string;
  ogImageAlt?: string;
  noIndex?: boolean;
  jsonLd?: object | object[];
}

/**
 * useSEO — client-side meta tag manager for Bodilicious SPA.
 *
 * Updates document.title, meta description, OG/Twitter tags, canonical link,
 * and safely injects per-page JSON-LD structured data (one script tag per schema).
 *
 * JSON-LD scope: only tags carrying [data-bodilicious-ld] are managed here.
 * The static Organization and WebSite schemas in index.html are left untouched.
 *
 * NOTE: If a Content-Security-Policy with script-src is ever added to render.yaml,
 * these inline script tags will need a nonce or sha256 hash to remain functional.
 *
 * Reverts to homepage defaults on unmount.
 */
export function useSEO({
  title,
  description,
  canonical,
  keywords,
  ogImage,
  ogImageAlt,
  noIndex = false,
  jsonLd,
}: SEOConfig) {
  useEffect(() => {
    const fullTitle = title.includes(BRAND) ? title : `${title} | ${BRAND}`;
    const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : `${BASE_URL}/`;
    const xDefaultUrl = canonicalUrl;
    const image = ogImage || DEFAULT_IMAGE;

    // ── 1. Title ───────────────────────────────────────────────
    const prevTitle = document.title;
    document.title = fullTitle;

    // ── 2. Helper: upsert a <meta> tag ─────────────────────────
    const setMeta = (selector: string, attr: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        const [key, val] = selector.replace(/[\[\]"]/g, '').split('=');
        (el as any)[key] = val;
        document.head.appendChild(el);
      }
      (el as any)[attr] = content;
      return el;
    };

    // ── Snapshot previous values before mutating ───────────────
    // Required so cleanup can fully restore every tag we touch,
    // preventing stale meta from leaking between route transitions.
    const prevDescription  = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';
    const prevRobots       = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? 'index, follow';
    const prevOgTitle      = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '';
    const prevOgDesc       = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? '';
    const prevOgUrl        = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content ?? '';
    const prevOgImage      = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';
    const prevOgImageAlt   = document.querySelector<HTMLMetaElement>('meta[property="og:image:alt"]')?.content ?? '';
    const prevTwTitle      = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content ?? '';
    const prevTwDesc       = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content ?? '';
    const prevTwImage      = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content ?? '';
    const prevTwUrl        = document.querySelector<HTMLMetaElement>('meta[name="twitter:url"]')?.content ?? '';
    const prevTwImageAlt   = document.querySelector<HTMLMetaElement>('meta[name="twitter:image:alt"]')?.content ?? '';

    // ── 3. Meta description ─────────────────────────
    setMeta('meta[name="description"]', 'content', description);

    // ── 4. Robots ──────────────────────────────────────────────
    setMeta('meta[name="robots"]', 'content', noIndex ? 'noindex, nofollow' : 'index, follow');

    // ── 5. OG tags ─────────────────────────────────────────────
    const setOg = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setOg('og:title', fullTitle);
    setOg('og:description', description);
    setOg('og:url', canonicalUrl);
    setOg('og:image', image);
    if (ogImageAlt) setOg('og:image:alt', ogImageAlt);

    // ── 6. Twitter tags ────────────────────────────────────────
    const setTwitter = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setTwitter('twitter:title', fullTitle);
    setTwitter('twitter:description', description);
    setTwitter('twitter:image', image);
    setTwitter('twitter:url', canonicalUrl);
    if (ogImageAlt) setTwitter('twitter:image:alt', ogImageAlt);

    // ── 7. Canonical ───────────────────────────────────────────
    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.rel = 'canonical';
      document.head.appendChild(canonicalEl);
    }
    const prevCanonical = canonicalEl.href;
    canonicalEl.href = canonicalUrl;

    // ── 8. Hreflang — self-referencing en-IN + x-default ──────
    // Fixes: "Self-reference hreflang annotation missing",
    //        "Hreflang to non-canonical",
    //        "X-default hreflang annotation missing"
    const upsertHreflang = (hreflang: string, href: string): HTMLLinkElement => {
      let el = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hreflang}"]`);
      if (!el) {
        el = document.createElement('link');
        el.rel = 'alternate';
        el.setAttribute('hreflang', hreflang);
        document.head.appendChild(el);
      }
      el.href = href;
      return el;
    };
    const prevEnIN    = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="en-IN"]')?.href ?? '';
    const prevXDef    = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]')?.href ?? '';
    const hreflangEnIN   = upsertHreflang('en-IN', canonicalUrl);
    const hreflangXDef   = upsertHreflang('x-default', xDefaultUrl);

    // ── 9. JSON-LD — synchronous remove-then-insert ────────────
    // Remove all stale page-level LD tags first (includes legacy id= tag)
    removePageLdTags();

    // Inject new schemas — one <script> per schema object
    if (jsonLd) {
      const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      injectLdTags(schemas);
    }

    // ── Cleanup: restore ALL mutated tags on unmount ───────────
    // Every tag touched above must be restored here so that a component
    // unmounting without an immediate successor (e.g. error boundary,
    // loading race, noindex page) does not leak stale metadata sitewide.
    return () => {
      document.title = prevTitle;
      setMeta('meta[name="description"]', 'content', prevDescription);
      setMeta('meta[name="robots"]',      'content', prevRobots);
      setOg('og:title',     prevOgTitle);
      setOg('og:description', prevOgDesc);
      setOg('og:url',       prevOgUrl);
      setOg('og:image',     prevOgImage);
      if (prevOgImageAlt)  setOg('og:image:alt', prevOgImageAlt);
      setTwitter('twitter:title',       prevTwTitle);
      setTwitter('twitter:description', prevTwDesc);
      setTwitter('twitter:image',       prevTwImage);
      setTwitter('twitter:url',         prevTwUrl);
      if (prevTwImageAlt) setTwitter('twitter:image:alt', prevTwImageAlt);
      if (canonicalEl) canonicalEl.href = prevCanonical;
      // Restore hreflang to homepage defaults on unmount
      if (hreflangEnIN) hreflangEnIN.href = prevEnIN || xDefaultUrl;
      if (hreflangXDef) hreflangXDef.href = prevXDef || xDefaultUrl;
      // Remove page-level LD tags on route change
      removePageLdTags();
    };
  }, [title, description, canonical, ogImage, ogImageAlt, noIndex, jsonLd, keywords]);
}
