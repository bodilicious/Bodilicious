/**
 * Run against production to seed variants on BD-FOUND-FRESH.
 *
 * Usage:
 *   MONGO_URI="<your-production-uri>" DB_NAME="<prod-db-name>" node scripts/seed_foundation_variants.js
 *
 * Or just set MONGO_URI and DB_NAME in your .env and run:
 *   node scripts/seed_foundation_variants.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (won't override already-set env vars, so MONGO_URI=... prefix works)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.DB_NAME || 'bodilicious';

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is not set. Set it in .env or as an env var.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`Connected to MongoDB (db: ${DB_NAME})`);

  const result = await mongoose.connection.db
    .collection('products')
    .updateOne(
      { pid: 'BD-FOUND-FRESH' },
      { $set: { variants: ['Fair Skin', 'Bold Skin', 'Medium Skin'] } }
    );

  if (result.matchedCount === 0) {
    console.warn('⚠️  BD-FOUND-FRESH not found in this database.');
  } else if (result.modifiedCount === 1) {
    console.log('✅  Variants set: Fair Skin, Bold Skin, Medium Skin');
  } else {
    console.log('ℹ️  No change — variants were already set correctly.');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
