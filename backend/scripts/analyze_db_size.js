/**
 * analyze_db_size.js
 * 
 * Connects to MongoDB and produces a detailed breakdown of:
 *  1. Total DB size & each collection's storage size
 *  2. Average document size per collection
 *  3. Largest individual documents (top-5 per collection)
 *  4. Fields that are bloating documents (arrays, embedded docs, base64 strings)
 *  5. Duplicate / orphaned data hints
 * 
 * READ-ONLY — this script never writes, updates, or deletes anything.
 * 
 * Run: node scripts/analyze_db_size.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function bar(ratio, width = 30) {
  const filled = Math.round(ratio * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

/**
 * Recursively estimate the in-memory JSON size of a document's fields.
 * Returns { fieldPath: byteEstimate } for the top-level and nested paths.
 */
function fieldSizes(obj, prefix = '') {
  const results = {};
  if (typeof obj !== 'object' || obj === null) return results;

  for (const [key, val] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const serialised = JSON.stringify(val);
    const size = Buffer.byteLength(serialised ?? '', 'utf8');
    results[fieldPath] = size;

    // Recurse one level into plain objects (not arrays, not ObjectIDs, not Dates)
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      !(val instanceof Date) &&
      !val._bsontype
    ) {
      const nested = fieldSizes(val, fieldPath);
      Object.assign(results, nested);
    }
  }
  return results;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 3,
    dbName: process.env.DB_NAME,
  });
  const db = mongoose.connection.db;
  console.log(`\n✅  Connected to: ${process.env.DB_NAME}\n`);

  // 1. DB-level stats
  const dbStats = await db.command({ dbStats: 1, scale: 1 });
  const totalDataSize = dbStats.dataSize;
  const totalStorageSize = dbStats.storageSize;
  const totalIndexSize = dbStats.indexSize;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DATABASE OVERVIEW');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Data size    : ${fmtBytes(totalDataSize)}`);
  console.log(`  Storage size : ${fmtBytes(totalStorageSize)}`);
  console.log(`  Index size   : ${fmtBytes(totalIndexSize)}`);
  console.log(`  Collections  : ${dbStats.collections}`);
  console.log(`  Objects      : ${dbStats.objects.toLocaleString()}\n`);

  // 2. Per-collection breakdown
  const collections = await db.listCollections().toArray();
  const collStats = [];

  for (const col of collections) {
    const stats = await db.command({ collStats: col.name, scale: 1 });
    collStats.push({
      name: col.name,
      count: stats.count,
      avgDocSize: stats.avgObjSize || 0,
      dataSize: stats.size,
      storageSize: stats.storageSize,
      indexSize: stats.totalIndexSize,
      nindexes: stats.nindexes,
    });
  }

  // Sort by data size descending
  collStats.sort((a, b) => b.dataSize - a.dataSize);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  COLLECTION BREAKDOWN  (sorted by data size)');
  console.log('═══════════════════════════════════════════════════════════════');

  const longestName = Math.max(...collStats.map(c => c.name.length), 10);

  for (const c of collStats) {
    const ratio = totalDataSize > 0 ? c.dataSize / totalDataSize : 0;
    const pct = (ratio * 100).toFixed(1).padStart(5);
    const name = c.name.padEnd(longestName + 2);
    console.log(
      `  ${name}  ${bar(ratio, 25)}  ${pct}%   ${fmtBytes(c.dataSize).padStart(10)}  ` +
      `docs: ${String(c.count).padStart(6)}  avgDoc: ${fmtBytes(c.avgDocSize).padStart(8)}  ` +
      `idx: ${fmtBytes(c.indexSize).padStart(8)}`
    );
  }

  // 3. Deep-dive: per-collection field analysis
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FIELD-LEVEL BLOAT ANALYSIS  (top collections)');
  console.log('═══════════════════════════════════════════════════════════════');

  // Analyse the top 8 collections by data size (or all if fewer)
  const topCollections = collStats.slice(0, 8);

  for (const c of topCollections) {
    if (c.count === 0) continue;

    const coll = db.collection(c.name);

    // Sample up to 200 docs
    const sampleSize = Math.min(200, c.count);
    const docs = await coll.find({}).limit(sampleSize).toArray();

    // --- largest individual documents ---
    const docSizes = docs.map(d => ({
      id: d._id,
      size: Buffer.byteLength(JSON.stringify(d), 'utf8'),
      doc: d,
    }));
    docSizes.sort((a, b) => b.size - a.size);
    const top5 = docSizes.slice(0, 5);

    // --- aggregate field sizes across the sample ---
    const fieldTotals = {}; // fieldPath -> total bytes across sample
    const fieldCounts = {}; // fieldPath -> number of docs that have this field

    for (const d of docs) {
      const sizes = fieldSizes(d);
      for (const [fp, sz] of Object.entries(sizes)) {
        fieldTotals[fp] = (fieldTotals[fp] || 0) + sz;
        fieldCounts[fp] = (fieldCounts[fp] || 0) + 1;
      }
    }

    // Top fields by average size
    const fieldAvg = Object.entries(fieldTotals)
      .filter(([fp]) => !fp.includes('._id')) // skip nested _ids
      .map(([fp, total]) => ({
        field: fp,
        avgBytes: total / (fieldCounts[fp] || 1),
        presentIn: fieldCounts[fp],
      }))
      .sort((a, b) => b.avgBytes - a.avgBytes)
      .slice(0, 15);

    console.log(`\n  ── ${c.name.toUpperCase()} ──`);
    console.log(`     Docs in DB: ${c.count}  |  Sample: ${docs.length}  |  AvgDoc: ${fmtBytes(c.avgDocSize)}`);

    // Detect arrays / embedded docs that are potential bloat
    const arrayFields = [];
    const base64Fields = [];
    for (const d of docs.slice(0, 20)) {
      for (const [key, val] of Object.entries(d)) {
        if (Array.isArray(val) && val.length > 10) {
          arrayFields.push({ field: key, length: val.length });
        }
        if (typeof val === 'string' && val.length > 500 && /^[A-Za-z0-9+/=]{100,}$/.test(val.substring(0, 200))) {
          base64Fields.push({ field: key, len: val.length });
        }
      }
    }

    if (fieldAvg.length > 0) {
      console.log('     Top fields by avg byte size:');
      for (const f of fieldAvg) {
        const pct = c.avgDocSize > 0
          ? ((f.avgBytes / c.avgDocSize) * 100).toFixed(1)
          : '?';
        const presentPct = ((f.presentIn / docs.length) * 100).toFixed(0);
        console.log(
          `       ${f.field.padEnd(40)} avg: ${fmtBytes(f.avgBytes).padStart(9)}  (${pct.padStart(5)}% of avg doc)  in ${presentPct}% of docs`
        );
      }
    }

    if (arrayFields.length > 0) {
      const unique = [...new Map(arrayFields.map(f => [f.field, f])).values()];
      console.log(`     ⚠️  Large arrays detected: ${unique.map(f => `${f.field}[${f.length}+]`).join(', ')}`);
    }
    if (base64Fields.length > 0) {
      console.log(`     ⚠️  Possible base64/binary strings: ${base64Fields.map(f => f.field).join(', ')}`);
    }

    console.log('     Top 5 largest individual documents:');
    for (const ds of top5) {
      let hint = '';
      // Try to find a human-readable label
      const d = ds.doc;
      hint = d.name || d.email || d.uid || d.orderId || d.sessionId || d.eventType || String(d._id);
      console.log(`       ${String(hint).substring(0, 50).padEnd(52)} ${fmtBytes(ds.size)}`);
    }
  }

  // 4. Index efficiency check
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  INDEX OVERHEAD');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const c of collStats) {
    if (c.indexSize === 0 && c.count === 0) continue;
    const ratio = c.dataSize > 0 ? (c.indexSize / c.dataSize) : 0;
    const flag = ratio > 1.5 ? ' ⚠️  INDEX > DATA (possible over-indexing)' : '';
    console.log(
      `  ${c.name.padEnd(longestName + 2)}  idx/data: ${(ratio * 100).toFixed(0).padStart(4)}%  ` +
      `(idx: ${fmtBytes(c.indexSize)}  data: ${fmtBytes(c.dataSize)})${flag}`
    );
  }

  // 5. Summary & recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY & RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════');

  const biggestColl = collStats[0];
  const oversizedIndexColls = collStats.filter(c => c.count > 0 && c.indexSize > c.dataSize);
  const hugeAvgDoc = collStats.filter(c => c.avgDocSize > 50 * 1024); // > 50 KB avg

  if (biggestColl) {
    console.log(`  • Biggest collection: "${biggestColl.name}" uses ${fmtBytes(biggestColl.dataSize)} (${((biggestColl.dataSize/totalDataSize)*100).toFixed(1)}% of DB)`);
  }
  if (oversizedIndexColls.length) {
    console.log(`  • Over-indexed collections (index > data): ${oversizedIndexColls.map(c => c.name).join(', ')}`);
  }
  if (hugeAvgDoc.length) {
    console.log(`  • Collections with very large avg document (>50KB): ${hugeAvgDoc.map(c => `${c.name} (${fmtBytes(c.avgDocSize)})`).join(', ')}`);
  }

  console.log('\n  Common causes of MongoDB bloat:');
  console.log('    1. Embedded arrays that grow unbounded (cart history, audit logs, events)');
  console.log('    2. Storing large strings/binary data (base64 images, HTML, JSON blobs)');
  console.log('    3. Duplicate data across collections (user info copied into every order)');
  console.log('    4. Old/abandoned sessions, analytics events, or temp records piling up');
  console.log('    5. Indexes on high-cardinality or rarely-queried fields');

  console.log('\n✅  Analysis complete. No data was modified.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
