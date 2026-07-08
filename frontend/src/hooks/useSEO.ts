import { useEffect } from 'react';

const BASE_URL = 'https://www.bodilicious.in';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const BRAND = 'Bodilicious';

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
 * useSEO — lightweight client-side meta tag manager for Bodilicious SPA.
 *
 * Updates document.title, meta description, OG/Twitter tags, and canonical link.
 * Optionally injects a JSON-LD script block for structured data.
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
    const fullTitle = title.includes(BRAND) ? title : `${title} — ${BRAND}`;
    const canonicalUrl = canonical
      ? `${BASE_URL}${canonical}`
      : BASE_URL + '/';
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

    // ── 3. Meta description & Keywords ─────────────────────────
    setMeta('meta[name="description"]', 'content', description);
    if (keywords) {
      setMeta('meta[name="keywords"]', 'content', keywords);
    }

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

    // ── 8. JSON-LD ─────────────────────────────────────────────
    const JSON_LD_ID = 'bodilicious-page-jsonld';
    let ldEl = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
    let prevLd: string | null = null;

    if (jsonLd) {
      if (!ldEl) {
        ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.id = JSON_LD_ID;
        document.head.appendChild(ldEl);
      }
      prevLd = ldEl.textContent;
      ldEl.textContent = JSON.stringify(
        Array.isArray(jsonLd) ? jsonLd : jsonLd
      );
    }

    // ── Cleanup: restore defaults on unmount ───────────────────
    return () => {
      document.title = prevTitle;
      // Restore canonical to homepage default
      if (canonicalEl) canonicalEl.href = prevCanonical;
      // Remove page-level JSON-LD or restore previous
      if (ldEl) {
        if (prevLd) {
          ldEl.textContent = prevLd;
        } else {
          ldEl.remove();
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonical, ogImage, noIndex]);
}
