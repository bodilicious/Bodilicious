/**
 * update-db-images.js
 * 
 * Updates all product image URLs in MongoDB from .png / .jpg to .webp
 * Run AFTER convert-images.js has finished converting files on disk.
 * 
 * Run from backend/ directory: node scripts/update-db-images.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ No MONGODB_URI found in .env');
  process.exit(1);
}

// Minimal schema just to update images
const ProductSchema = new mongoose.Schema({ images: [String] }, { strict: false });
const Product = mongoose.model('Product', ProductSchema);

function toPngToWebp(url) {
  if (!url) return url;
  return url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
}

async function run() {
  const DB_NAME = process.env.DB_NAME || 'myappdb';
  console.log(`🔌 Connecting to MongoDB (DB: ${DB_NAME})...`);
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log('✅ Connected\n');

  const products = await Product.find({});
  console.log(`📦 Found ${products.length} products\n`);

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const oldImages = product.images || [];
    const newImages = oldImages.map(toPngToWebp);

    const hasChanges = oldImages.some((img, i) => img !== newImages[i]);
    if (!hasChanges) {
      skipped++;
      continue;
    }

    product.images = newImages;
    await product.save();
    console.log(`  ✅ Updated: ${product.pid || product._id}`);
    console.log(`     Before: ${oldImages[0]}`);
    console.log(`     After:  ${newImages[0]}\n`);
    updated++;
  }

  console.log('─────────────────────────────────────');
  console.log(`✅ Updated: ${updated} products`);
  console.log(`⏭  Skipped: ${skipped} products (already correct or no images)`);

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected. Done!');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
