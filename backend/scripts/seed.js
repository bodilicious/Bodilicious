import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../products/models.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚠️  DANGER: This script WIPES ALL PRODUCTS from the database and re-seeds
// from chat/products.json.  Any products added via the Admin panel that are
// NOT in products.json will be PERMANENTLY LOST.
// You MUST pass --confirm-wipe to actually run this.
const CONFIRM_WIPE = process.argv.includes('--confirm-wipe');
if (!CONFIRM_WIPE) {
    console.error('\n🛑  ABORTED: seed.js will wipe ALL products from MongoDB.');
    console.error('    Products added via the Admin panel (not in products.json) will be LOST.');
    console.error('    If you are sure, re-run with:  node seed.js --confirm-wipe\n');
    process.exit(1);
}

mongoose
    .connect(process.env.MONGO_URI, {
        dbName: process.env.DB_NAME,
    })
    .then(async () => {
        console.log("MongoDB connected");

        // 1. Clear database (⚠️  DESTRUCTIVE — guarded by --confirm-wipe above)
        await Product.deleteMany({});
        console.log("Cleared existing products from database.");

        // 2. Read products.json
        const productsPath = path.join(__dirname, '..', 'chat', 'products.json');
        const rawJson = fs.readFileSync(productsPath, 'utf-8');
        const sampleProducts = JSON.parse(rawJson);

        // 3. Map products to the correct format and seed fake images
        const formattedProducts = sampleProducts.map(p => {
            // Give them some default fake images if missing
            const fallbackImages = [
                `https://placehold.co/800x800?text=${p.id}`
            ];

            return {
                pid: p.id,
                name: p.name,
                brand: p.brand || "Bodilicious",
                images: p.images || fallbackImages,
                description: p.description,
                category: p.category,
                sub_category: p.sub_category,
                product_type: p.product_type,
                item_form: p.item_form,
                ingredients: p.ingredients,
                benefits: p.benefits,
                concerns_targeted: p.concerns_targeted || [],
                usage: p.usage,
                price: p.price_inr,
                price_inr: p.price_inr,
                stock: p.availability === "In Stock" ? 100 : 0,
                isActive: true,
                reviews: []
            };
        });

        // 4. Insert all mapped products
        const result = await Product.insertMany(formattedProducts);
        console.log(`Successfully seeded ${result.length} products to database!`);
        process.exit(0);
    })
    .catch((err) => {
        console.error("Database Seeding Failed!", err);
        process.exit(1);
    });
