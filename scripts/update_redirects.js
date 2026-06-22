const fs = require('fs');

const redirects = [
  // Pages
  { from: '/pages/about-us', to: '/about' },
  { from: '/pages/brand-story', to: '/brand-story' },
  { from: '/pages/contact-us', to: '/contact' },
  { from: '/pages/privacy-policy', to: '/privacy' },
  { from: '/pages/shipping-and-refund-policy', to: '/shipping-refund' },
  { from: '/pages/terms-and-conditions', to: '/terms' },
  // Products
  { from: '/products/matt-liquid-lipstick', to: '/product/BD-LIP-MATT' },
  { from: '/products/smooth-hair-banana-shampoo', to: '/product/BD-SHAM-BANANA' },
  { from: '/products/spf50-physical-sunscreen', to: '/product/BD-SUN-PHYS-SPF50' },
  { from: '/products/beetroot-lip-balm', to: '/product/BD-LIP-BEET' },
  { from: '/products/neem-green-tea-extracts-rich-salicylic-acid-serum', to: '/product/BD-SER-SAL' },
  { from: '/products/organic-goat-milk-soap', to: '/product/BD-SOAP-GOAT' },
  { from: '/products/tnw-antiacne-face-wash', to: '/product/BD-CLE-ACNE' },
  { from: '/products/ultimate-uv-defense-sunscreen-lip-balm', to: '/product/BD-LIP-SUN' },
  { from: '/products/avobenzone-rich-liquid-sunscreen', to: '/product/BD-SUN-LIQ' },
  { from: '/products/azelaic-acid-serum-for-face', to: '/product/BD-SER-AZE' },
  { from: '/products/best-organic-herbal-hair-oil-for-hair-growth', to: '/product/BD-HAIR-OIL-HERB' },
  { from: '/products/bodilicious-niacinamide-serum', to: '/product/BD-SER-NIA-SPF30' },
  { from: '/products/bodilicious-oats-protein-moisturizer', to: '/product/BD-MOIST-OATS' },
  { from: '/products/bodilicious-saf-gel', to: '/product/BD-GEL-SAF' },
  { from: '/products/carrot-lip-balm', to: '/product/BD-LIP-CARROT' },
  { from: '/products/collagen-booster-retinol-night-repair-serum', to: '/product/BD-SER-RET' },
  { from: '/products/hair-scalp-growth-promoter', to: '/product/BD-HAIR-GROWTH' },
  { from: '/products/hair-serum-for-women-hair-growth', to: '/product/BD-HAIR-SER' },
  { from: '/products/keratin-conditioner', to: '/product/BD-COND-KERATIN' },
  { from: '/products/ketoconazole-antidandruff-shampoo', to: '/product/BD-SHAM-DAND' },
  { from: '/products/kojic-glycolic-infused-facewash', to: '/product/BD-CLE-KOJIC-GLY' },
  { from: '/products/organic-olive-oil-soap', to: '/product/BD-SOAP-OLIVE' },
  { from: '/products/peptide-ceramide-collagen-complex-moisturizer', to: '/product/BD-MOIST-PEP' },
  { from: '/products/rose-face-and-body-wash', to: '/product/BD-CLE-ROSE' },
  { from: '/products/scalp-nourishing-baby-hair-growth-serum', to: '/product/BD-HAIR-BABY' },
  { from: '/products/skin-brightening-vitamin-c-serum', to: '/product/BD-SER-VITC' },
  { from: '/products/strawberry-face-and-body-wash', to: '/product/BD-CLE-STRAW' },
  // Wildcards
  { from: '/collections/*', to: '/shop' },
  { from: '/products/*', to: '/shop' },
  { from: '/pages/*', to: '/' },
  { from: '/blogs/*', to: '/' }
];

const netlifyRedirects = redirects.map(r => `[[redirects]]\n  from = "${r.from}"\n  to = "${r.to}"\n  status = 301`).join('\n\n');

const renderRedirects = redirects.map(r => `      - type: redirect\n        source: ${r.from}\n        destination: ${r.to}`).join('\n');

const netlifyPaths = [
  'c:/Users/admin/Desktop/projects/Bodilicious/netlify.toml',
  'c:/Users/admin/Desktop/projects/Bodilicious/frontend/netlify.toml'
];

netlifyPaths.forEach(p => {
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/# ─── Legacy Shopify Redirects ───+[\s\S]*?(?=# ─── SPA Fallback ───+)/, 
    '# ─── Legacy Shopify Redirects ─────────────────────────────────────────────────\n\n' + netlifyRedirects + '\n\n');
  fs.writeFileSync(p, content);
});

const renderPaths = [
  'c:/Users/admin/Desktop/projects/Bodilicious/render.yaml',
  'c:/Users/admin/Desktop/projects/Bodilicious/frontend/render.yaml'
];

renderPaths.forEach(p => {
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/      - type: redirect[\s\S]*?(?=      - type: rewrite\n        source: \/\*)/, 
    renderRedirects + '\n');
  fs.writeFileSync(p, content);
});

console.log('Redirects updated!');
