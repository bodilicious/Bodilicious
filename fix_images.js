const fs = require('fs');
const files = [
  'frontend/src/components/Navbar.tsx',
  'frontend/src/pages/CartPage.tsx',
  'frontend/src/pages/ConfirmationPage.tsx',
  'frontend/src/pages/OrderDetailsPage.tsx',
  'frontend/src/pages/PaymentPage.tsx',
  'frontend/src/pages/RitualFinderPage.tsx',
  'frontend/src/pages/ShippingPage.tsx',
  'frontend/src/pages/TrackingPage.tsx'
];
files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  text = text.replace(/className="([^"]*)w-full h-full object-cover([^"]*)"/g, 'className="$1w-full h-full object-contain p-1 mix-blend-multiply$2"');
  text = text.replace(/className="([^"]*)w-12 h-12 object-cover([^"]*)"/g, 'className="$1w-12 h-12 object-contain p-0.5 mix-blend-multiply$2"');
  fs.writeFileSync(f, text);
});
console.log('Images updated to object-contain');
