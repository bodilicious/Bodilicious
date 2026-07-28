export const BOT_UA_PATTERNS = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot|pinterest/i;

export function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return BOT_UA_PATTERNS.test(userAgent);
}

export function truncateDescription(text, maxLen = 155) {
  if (!text || text.length <= maxLen) return text ?? '';
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

export function safeJsonLd(obj) {
  // BUG FIX 4: The regex replacement `<\/script` produces a literal backslash
  // inside the JSON string, which makes the JSON invalid and breaks parsers.
  // The correct approach is to Unicode-escape the `<` character to `\u003c`,
  // which is valid JSON and prevents early </script> tag termination.
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildProductSchema(product, frontendUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images?.[0] || '',
    description: product.description || '',
    brand: { '@type': 'Brand', name: 'Bodilicious' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: String(product.price),
      availability:
        product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `${frontendUrl}/product/${product.pid}`,
      seller: { '@type': 'Organization', name: 'Bodilicious' },
    },
    ...(product.rating && product.ratingCount && product.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(Number(product.rating).toFixed(1)),
            reviewCount: String(product.ratingCount),
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };
}

export function buildBreadcrumbSchema(product, frontendUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${frontendUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Shop',
        item: `${frontendUrl}/shop`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `${frontendUrl}/product/${product.pid}`,
      },
    ],
  };
}

// Generate the final HTML for a product page
export function renderProductHtml(product, frontendUrl) {
  // SYNC: Must match useSEO logic in frontend/src/pages/ProductPage.tsx L214-216
  const primaryKw = product.seo_keywords?.primary?.[0] ? product.seo_keywords.primary[0].trim() : '';
  const secondaryKw = product.seo_keywords?.secondary?.[0] ? product.seo_keywords.secondary[0].trim() : '';
  
  const pageTitle = primaryKw ? `${product.name} - ${primaryKw} | Bodilicious` : `${product.name} — Bodilicious`;
  const productDesc = truncateDescription(product.description || 'Premium skincare and haircare from Bodilicious.');
  const ogAlt = secondaryKw ? `${product.name} - ${secondaryKw}` : `${product.name} by Bodilicious`;

  const schemas = [
    buildProductSchema(product, frontendUrl),
    buildBreadcrumbSchema(product, frontendUrl)
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(productDesc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${frontendUrl}/product/${product.pid}">
  
  <meta property="og:type" content="product" />
  <meta property="og:url" content="${frontendUrl}/product/${product.pid}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(productDesc)}" />
  <meta property="og:image" content="${escapeHtml(product.images?.[0] ?? '')}" />
  <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(productDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(product.images?.[0] ?? '')}" />

  <script type="application/ld+json">
    ${safeJsonLd(schemas)}
  </script>
</head>
<body>
  <h1>${escapeHtml(product.name)}</h1>
  <p>${escapeHtml(product.description || '')}</p>
  <p>Price: ₹${escapeHtml(String(product.price))}</p>
</body>
</html>`;
}

function escapeHtml(unsafe) {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
