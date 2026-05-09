/**
 * convert-images.js
 * 
 * Converts all PNG/JPG images in public/ and public/products/ to WebP format.
 * Run from the frontend/ directory: node convert-images.js
 * 
 * Requires: npm install sharp
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUALITY = 80;

const DIRS = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'public', 'products'),
  path.join(__dirname, 'public', 'ingredients'),
];

let converted = 0;
let skipped = 0;
let errors = 0;
let totalSavedBytes = 0;

async function convertDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found, skipping: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;

    const inputPath = path.join(dir, file);
    const outputPath = path.join(dir, file.replace(/\.(png|jpg|jpeg)$/i, '.webp'));

    // Skip if WebP already exists
    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭  Already exists: ${file}`);
      skipped++;
      continue;
    }

    try {
      const inputSize = fs.statSync(inputPath).size;
      await sharp(inputPath)
        .webp({ quality: QUALITY })
        .toFile(outputPath);
      const outputSize = fs.statSync(outputPath).size;
      const saving = inputSize - outputSize;
      totalSavedBytes += saving;
      converted++;
      console.log(`  ✅ ${file} → ${file.replace(/\.(png|jpg|jpeg)$/i, '.webp')} (${(inputSize/1024/1024).toFixed(1)} MB → ${(outputSize/1024/1024).toFixed(1)} MB, saved ${(saving/1024/1024).toFixed(1)} MB)`);
    } catch (err) {
      console.error(`  ❌ Failed: ${file} — ${err.message}`);
      errors++;
    }
  }
}

console.log('🔄 Starting PNG → WebP conversion...\n');
for (const dir of DIRS) {
  console.log(`📁 Processing: ${dir}`);
  await convertDir(dir);
  console.log('');
}

console.log('─────────────────────────────────────────');
console.log(`✅ Converted: ${converted} files`);
console.log(`⏭  Skipped:   ${skipped} files (already WebP)`);
console.log(`❌ Errors:    ${errors} files`);
console.log(`💾 Total saved: ${(totalSavedBytes / 1024 / 1024).toFixed(1)} MB`);
console.log('\n📌 Next step: run node update-db-images.js to update MongoDB image paths');
