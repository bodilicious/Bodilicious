import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../products/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// ⚠️  CRITICAL SAFETY FLAG
// By default this script ONLY syncs (upserts) products from products.json.
// Deletion of DB products NOT in products.json is DISABLED unless you
// explicitly pass --enable-delete.  This prevents wiping out products
// that were added via the Admin panel (e.g. new launches like the
// Frankincense Bath Soap) but were never added to products.json.
const ENABLE_DELETE = process.argv.includes('--enable-delete');

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME,
        });
        console.log("Connected to MongoDB:", process.env.DB_NAME);

        // 1. BACKUP
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, `backup_products_${timestamp}.json`);
        const currentProducts = await Product.find({});
        fs.writeFileSync(backupPath, JSON.stringify(currentProducts, null, 2));
        console.log(`Backup created at: ${backupPath} (${currentProducts.length} items)`);

        // 2. READ SOURCE OF TRUTH
        const productsPath = path.join(__dirname, '..', 'chat', 'products.json');
        const sourceProducts = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
        const sourcePids = new Set(sourceProducts.map(p => p.pid || p.id));

        console.log(`Source of Truth: ${sourceProducts.length} products in products.json`);

        // 3. DIFF ANALYSIS
        const toDelete = currentProducts.filter(p => !sourcePids.has(p.pid));
        const toUpdate = sourceProducts.filter(sp => currentProducts.some(p => p.pid === (sp.pid || sp.id)));
        const toInsert = sourceProducts.filter(sp => !currentProducts.some(p => p.pid === (sp.pid || sp.id)));

        console.log("\n--- Diff Analysis ---");
        console.log(`To Delete (NOT in products.json — admin-panel products): ${toDelete.length}`);
        toDelete.forEach(p => console.log(`  ⚠️  [WOULD DELETE] ${p.name} (${p.pid})`));
        
        console.log(`To Update (Sync): ${toUpdate.length}`);
        console.log(`To Insert (New from JSON): ${toInsert.length}`);
        console.log("---------------------\n");

        // SAFETY CHECK: If products.json has fewer entries than DB, something is wrong.
        // Abort to avoid accidentally mass-deleting real products.
        if (toDelete.length > 0 && !ENABLE_DELETE) {
            console.log(`\n🛑  SAFETY ABORT: ${toDelete.length} DB product(s) are NOT in products.json.`);
            console.log("    These are likely products added via the Admin panel (e.g. new product launches).");
            console.log("    This script will NOT delete them unless you explicitly pass --enable-delete.");
            console.log("    Re-run with --dry-run --enable-delete to preview, or --force --enable-delete to apply.\n");
            if (!DRY_RUN) process.exit(0);
        }

        if (DRY_RUN) {
            console.log("DRY RUN: No changes made to database.");
            process.exit(0);
        }

        if (!FORCE && (toDelete.length > 0 || toInsert.length > 0 || toUpdate.length > 0)) {
            console.log("Aborting. Use --force to apply changes.");
            process.exit(0);
        }

        // 4. EXECUTE
        if (toDelete.length > 0 && ENABLE_DELETE) {
            const deleteResult = await Product.deleteMany({ pid: { $in: toDelete.map(p => p.pid) } });
            console.log(`Deleted ${deleteResult.deletedCount} products.`);
        } else if (toDelete.length > 0) {
            console.log(`Skipped deletion of ${toDelete.length} product(s) (--enable-delete not set).`);
        }

        for (const sp of sourceProducts) {
            const pid = sp.pid || sp.id;
            const updateData = {
                pid: pid,
                name: sp.name,
                brand: sp.brand || "Bodilicious",
                images: sp.images,
                description: sp.description,
                category: sp.category,
                sub_category: sp.sub_category,
                product_type: sp.product_type,
                item_form: sp.item_form,
                ingredients: sp.ingredients,
                benefits: sp.benefits,
                concerns_targeted: sp.concerns_targeted || [],
                usage: sp.usage,
                price: sp.price_inr || sp.price,
                price_inr: sp.price_inr || sp.price,
                stock: sp.stock !== undefined ? sp.stock : (sp.availability === "In Stock" ? 100 : 0),
                isActive: true,
            };

            await Product.findOneAndUpdate(
                { pid: pid },
                { $set: updateData },
                { upsert: true, new: true }
            );
        }
        
        console.log("Database synchronization complete.");
        process.exit(0);
    } catch (err) {
        console.error("Cleanup Failed:", err);
        process.exit(1);
    }
}

cleanup();
