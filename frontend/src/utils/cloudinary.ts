/**
 * Injects Cloudinary transformation parameters into a Cloudinary URL.
 *
 * Given a raw URL like:
 *   https://res.cloudinary.com/diannamdd/image/upload/v123/folder/image.png
 *
 * Returns:
 *   https://res.cloudinary.com/diannamdd/image/upload/f_auto,q_auto,w_600/v123/folder/image.png
 *
 * Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryUrl(
  url: string | undefined | null,
  options: { w?: number; h?: number; q?: number | 'auto'; f?: string } = {}
): string {
  if (!url) return '';

  const CLOUDINARY_PATTERN = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/;
  const match = url.match(CLOUDINARY_PATTERN);
  if (!match) return url; // Not a Cloudinary URL -- return as-is

  const prefix = match[1];
  const rest = url.slice(prefix.length);

  // Don't double-inject if transformations already present
  if (/^[a-z_,0-9]+\//.test(rest)) return url;

  // Build transformation string
  const transforms: string[] = ['f_auto', `q_${options.q ?? 'auto'}`];
  if (options.w) transforms.push(`w_${options.w}`);
  if (options.h) transforms.push(`h_${options.h}`);

  return `${prefix}${transforms.join(',')}/` + rest;
}
