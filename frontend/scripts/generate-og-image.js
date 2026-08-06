// One-off generator for the missing frontend/public/og-image.png (1200x630).
// Crops the hero carousel image and overlays brand name + tagline via an SVG layer.
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const WIDTH = 1200;
const HEIGHT = 630;

const svgOverlay = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#3a0d0d" stop-opacity="0.92"/>
      <stop offset="55%" stop-color="#3a0d0d" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#3a0d0d" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>
  <text x="72" y="500" font-family="Georgia, 'Times New Roman', serif" font-size="76" fill="#ffffff" font-weight="600">Bodilicious</text>
  <text x="72" y="556" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#f5e6e6" letter-spacing="1">Premium Skincare &amp; Haircare, made in India</text>
</svg>
`;

async function main() {
  const heroPath = path.join(PUBLIC_DIR, 'assets', 'hero_carousel_1.webp');
  const outPath = path.join(PUBLIC_DIR, 'og-image.png');

  await sharp(heroPath)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png({ quality: 90 })
    .toFile(outPath);

  console.log('Wrote', outPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
