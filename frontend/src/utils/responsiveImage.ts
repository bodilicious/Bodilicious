import { cloudinaryUrl } from './cloudinary';

/**
 * Builds a `srcset` for the two image sources this site actually serves:
 *
 *  - Local banners in /assets/banners/, which have a pre-generated `-640`
 *    variant committed alongside the 1024w base file (see the optimized
 *    assets in frontend/public/assets/banners).
 *  - Cloudinary uploads, where the width is requested via a URL transform.
 *
 * Returns undefined for anything else (blob: previews, one-off external
 * URLs, images with no known smaller variant) so the caller just renders a
 * plain `src` — a wrong srcset is worse than none, because the browser would
 * fetch a URL that 404s.
 */
export function buildSrcSet(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  // 768w matters more than it looks: a typical phone renders this card ~327 CSS
  // px wide at DPR 2, i.e. ~654 device px. Without a 768w step the browser has
  // to jump straight to the 1024w file to stay sharp.
  const localBanner = url.match(/^(\/assets\/banners\/[^/]+)\.webp$/);
  if (localBanner) {
    const base = localBanner[1];
    return `${base}-640.webp 640w, ${base}-768.webp 768w, ${url} 1024w`;
  }

  if (/^https?:\/\/res\.cloudinary\.com\//.test(url)) {
    return [640, 768, 1024]
      .map((w) => `${cloudinaryUrl(url, { w })} ${w}w`)
      .join(', ');
  }

  return undefined;
}

/**
 * Default `sizes` for the homepage category grid: one full-width column on
 * mobile, three columns (so roughly a third of the viewport) from `md` up.
 * Matches the `grid-cols-1 md:grid-cols-3` layout it is used with.
 */
export const CATEGORY_GRID_SIZES = '(min-width: 768px) 33vw, 100vw';
