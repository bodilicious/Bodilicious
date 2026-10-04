import { cloudinaryUrl } from './cloudinary';
import { IMAGE_VARIANT_FILES } from '../generated/imageVariants';

/**
 * Right-sized product images.
 *
 * Static product photos (/products/*.webp, ~1066×1600) have pre-generated 560 px
 * and 240 px variants (scripts/generate-image-variants.mjs). Cards and thumbnails
 * used to download the full original — 5–20× the pixels they display. Cloudinary
 * uploads get the equivalent width transform instead.
 *
 * Only files listed in the generated manifest are rewritten, so a missing variant
 * can never produce a broken image — anything unknown falls back to the original.
 */
export type ProductImageSize = 'card' | 'thumb';

const WIDTH: Record<ProductImageSize, number> = { card: 560, thumb: 240 };

const LOCAL = /^\/products\/([^/?#]+)(\?[^#]*)?$/;
const CLOUDINARY = /^https?:\/\/res\.cloudinary\.com\//;

const localVariant = (url: string, width: number): string | null => {
  const m = url.match(LOCAL);
  if (!m || !IMAGE_VARIANT_FILES.has(m[1])) return null;
  return `/products/w${width}/${m[1].replace(/\.\w+$/, '.webp')}${m[2] || ''}`;
};

export function productImage(url: string | undefined | null, size: ProductImageSize = 'card'): string {
  if (!url) return '';
  const width = WIDTH[size];
  if (CLOUDINARY.test(url)) return cloudinaryUrl(url, { w: width });
  return localVariant(url, width) ?? url;
}

/**
 * srcset for a product card, so the browser picks 240 / 560 / original by the
 * slot's rendered width and the screen's pixel density. Undefined when no variants
 * exist — the caller then just uses `src`.
 */
export function productSrcSet(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (CLOUDINARY.test(url)) {
    return [240, 560, 1000].map((w) => `${cloudinaryUrl(url, { w })} ${w}w`).join(', ');
  }
  const small = localVariant(url, 240);
  const medium = localVariant(url, 560);
  if (!small || !medium) return undefined;
  return `${small} 240w, ${medium} 560w, ${url} 1066w`;
}
