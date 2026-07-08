import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const sitemapPath = path.join(__dirname, '../../frontend/public/sitemap.xml');

async function generateSitemap() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log('Connected to MongoDB');

    // Mongoose Model for Products
    const ProductSchema = new mongoose.Schema({}, { strict: false });
    const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

    const products = await Product.find({}, 'pid category').lean();
    console.log(`Found ${products.length} active products`);

    // Read current sitemap
    const currentSitemap = fs.readFileSync(sitemapPath, 'utf8');

    // Split at TIER 4 and TIER 5
    const tier4Marker = '<!-- ═══════════════════════════════════════════════════════════\n       TIER 4 — INDIVIDUAL PRODUCT PAGES';
    const tier5Marker = '<!-- ═══════════════════════════════════════════════════════════\n       TIER 5 — DISCOVERY &amp; ENGAGEMENT PAGES';
    
    // Fallback if markers changed
    let topPart = currentSitemap.split(tier4Marker)[0];
    let bottomPart = currentSitemap.split(tier5Marker)[1];
    
    if (!topPart || !bottomPart) {
        // Fallback marker logic
        const t4 = currentSitemap.indexOf('TIER 4');
        const t5 = currentSitemap.indexOf('TIER 5');
        topPart = currentSitemap.substring(0, t4 - 70); // Rough estimate back to the border
        bottomPart = currentSitemap.substring(t5 - 70);
    } else {
        bottomPart = tier5Marker + bottomPart;
    }

    let productXml = `<!-- ═══════════════════════════════════════════════════════════\n       TIER 4 — INDIVIDUAL PRODUCT PAGES (Priority 0.80–0.92)\n       Automatically generated from MongoDB.\n       ═══════════════════════════════════════════════════════════ -->\n`;

    const today = new Date().toISOString().split('T')[0];

    products.forEach(p => {
        // priority logic
        let priority = '0.85';
        if (p.category === 'skin') priority = '0.90';
        else if (p.category === 'hair') priority = '0.88';
        
        productXml += `
  <url>
    <loc>https://www.bodilicious.in/product/${p.pid}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>\n`;
    });

    const newSitemap = topPart + productXml + '\n  ' + bottomPart;
    
    // Also change locs to www.bodilicious.in for consistency with robots.txt
    const finalSitemap = newSitemap.replace(/<loc>https:\/\/bodilicious\.in\//g, '<loc>https://www.bodilicious.in/');

    fs.writeFileSync(sitemapPath, finalSitemap, 'utf8');
    console.log('Successfully updated sitemap.xml');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.connection.close();
  }
}

generateSitemap();
