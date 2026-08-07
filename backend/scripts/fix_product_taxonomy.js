/**
 * fix_product_taxonomy.js
 *
 * One-off normalisation of the four taxonomy fields on every product, plus the
 * new `google_product_category`. Run once, then delete or keep for reference.
 *
 *   node scripts/fix_product_taxonomy.js --dry-run     # print the diff, write nothing
 *   node scripts/fix_product_taxonomy.js               # apply
 *
 * ── Why ───────────────────────────────────────────────────────────────────────
 * Three separate problems had accumulated in the catalogue:
 *
 * 1. `category` was inconsistent for identical product kinds. Three bath soaps
 *    sat under "skin" while the other two sat under "body", so the Navbar's
 *    Body › Soaps link (category=body,lip,makeup & sub_category=soap) returned
 *    2 of 5 soaps. A face wash sat under body/face_body_wash.
 *
 * 2. `product_type` was free text, so the Shop page's "Product Type" facet had
 *    31 options for 42 products — most matching exactly one item, which is not
 *    a filter. It also contained junk ("skincare", "Skin care", "cleansing
 *    bar") that rendered as real, meaningless chips. This script collapses it
 *    to a shared vocabulary of 17 types. Granularity that was lost from
 *    product_type ("Barrier repair serum") is still carried by sub_category,
 *    usage.time and the product name.
 *
 * 3. Nothing carried a Google product category, so the Merchant Center feed
 *    derived one from top-level `category` alone — all 24 skin products went
 *    out as the same generic "Skin Care" node.
 *
 * ── The taxonomy strings ──────────────────────────────────────────────────────
 * GOOGLE_CATEGORY values below are verbatim nodes from Google's published
 * taxonomy (2021-09-21), with their numeric IDs in comments:
 *   https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 * Merchant Center silently ignores the attribute and auto-classifies the item
 * if the string is not an exact match, so do not hand-edit these; copy from the
 * file above. `--verify-taxonomy <path>` re-checks them against a local copy.
 */

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
const verifyIdx = process.argv.indexOf('--verify-taxonomy');
const TAXONOMY_FILE = verifyIdx !== -1 ? process.argv[verifyIdx + 1] : null;

// ── Google taxonomy nodes actually used by this catalogue ────────────────────
const G = {
  SKIN_CARE:        'Health & Beauty > Personal Care > Cosmetics > Skin Care',                              // 567
  ACNE:             'Health & Beauty > Personal Care > Cosmetics > Skin Care > Acne Treatments & Kits',     // 481
  MOISTURIZER:      'Health & Beauty > Personal Care > Cosmetics > Skin Care > Lotion & Moisturizer',       // 2592
  SUNSCREEN:        'Health & Beauty > Personal Care > Cosmetics > Skin Care > Sunscreen',                  // 2844
  FACIAL_CLEANSER:  'Health & Beauty > Personal Care > Cosmetics > Skin Care > Facial Cleansers',           // 2526
  LIP_BALM:         'Health & Beauty > Personal Care > Cosmetics > Skin Care > Lip Balms & Treatments > Lip Balms', // 543573
  BAR_SOAP:         'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bar Soap',                 // 2503
  BODY_WASH:        'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Body Wash',                // 2747
  FOUNDATION:       'Health & Beauty > Personal Care > Cosmetics > Makeup > Face Makeup > Foundations & Concealers', // 2765
  LIPSTICK:         'Health & Beauty > Personal Care > Cosmetics > Makeup > Lip Makeup > Lipstick',         // 3021
  SHAMPOO:          'Health & Beauty > Personal Care > Hair Care > Shampoo & Conditioner > Shampoo',        // 543615
  CONDITIONER:      'Health & Beauty > Personal Care > Hair Care > Shampoo & Conditioner > Conditioners',   // 543616
  HAIR_STYLING:     'Health & Beauty > Personal Care > Hair Care > Hair Styling Products',                  // 1901
  HAIR_CARE:        'Health & Beauty > Personal Care > Hair Care',                                          // 486
};

// ── Target state, keyed by pid ───────────────────────────────────────────────
// category ∈ skin | hair | body | makeup | lip | other  (Mongoose enum)
// product_type is the Shop "Product Type" facet — keep it SHARED, not unique.
const TAXONOMY = {
  // ── Face serums ────────────────────────────────────────────────────────────
  // All nine share product_type "Face Serum" so the facet groups them; the
  // specific role stays in sub_category + the name.
  'BD-SER-NIA-SPF30':    { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  'BD-SER-RET':          { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  'BD-SER-VITC':         { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  'BD-SER-HA':           { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  'BD-SER-COQ10':        { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  'BD-SER-GLOW':         { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  'BD-SER-AHA-BHA':      { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.SKIN_CARE },
  // Salicylic + azelaic are marketed against acne/blemishes — the one skin-care
  // leaf Google has that beats the generic node.
  'BD-SER-SAL':          { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.ACNE },
  'BD-SER-AZE':          { category: 'skin', sub_category: 'serum',           product_type: 'Face Serum',       item_form: 'Serum',  google: G.ACNE },

  // ── Moisturizers & creams ──────────────────────────────────────────────────
  // was product_type "skincare" / "Skin care" — junk facet chips.
  'BD-MOIST-PEP':        { category: 'skin', sub_category: 'moisturizer',     product_type: 'Face Moisturizer', item_form: 'Cream',  google: G.MOISTURIZER },
  'BD-MOIST-OATS':       { category: 'skin', sub_category: 'moisturizer',     product_type: 'Face Moisturizer', item_form: 'Cream',  google: G.MOISTURIZER },
  'BD-MOIST-SILICA-OATS':{ category: 'skin', sub_category: 'moisturizer',     product_type: 'Face Moisturizer', item_form: 'Cream',  google: G.MOISTURIZER },
  'BD-RET-CREAM':        { category: 'skin', sub_category: 'night_cream',     product_type: 'Night Cream',      item_form: 'Cream',  google: G.MOISTURIZER },
  'BD-EYE-DAY':          { category: 'skin', sub_category: 'eye_care',        product_type: 'Eye Cream',        item_form: 'Cream',  google: G.MOISTURIZER },
  'BD-EYE-NIGHT':        { category: 'skin', sub_category: 'eye_care',        product_type: 'Eye Cream',        item_form: 'Cream',  google: G.MOISTURIZER },
  'BD-GEL-SAF':          { category: 'skin', sub_category: 'soothing_gel',    product_type: 'Soothing Gel',     item_form: 'Gel',    google: G.MOISTURIZER },

  // ── Sunscreens ─────────────────────────────────────────────────────────────
  // was "Liquid sunscreen" / "Skin care" / "Sunscreen spray" — three chips for
  // three products. The format now lives in item_form, where it belongs.
  'BD-SUN-LIQ':          { category: 'skin', sub_category: 'sunscreen',       product_type: 'Sunscreen',        item_form: 'Liquid', google: G.SUNSCREEN },
  'BD-SUN-PHYS-SPF50':   { category: 'skin', sub_category: 'sunscreen',       product_type: 'Sunscreen',        item_form: 'Cream',  google: G.SUNSCREEN },
  'BD-SUN-HYD-SPF50-SPRAY':{ category:'skin',sub_category: 'sunscreen',       product_type: 'Sunscreen',        item_form: 'Spray',  google: G.SUNSCREEN },

  // ── Face cleansers ─────────────────────────────────────────────────────────
  // BD-CLE-KOJIC-GLY moves out of body/face_body_wash: it is a facewash, and
  // sitting under `body` kept it out of the Face nav and the skin facet.
  'BD-CLE-ACNE':         { category: 'skin', sub_category: 'cleanser',        product_type: 'Face Cleanser',    item_form: 'Gel',    google: G.FACIAL_CLEANSER },
  'BD-CLAY-KAOLIN':      { category: 'skin', sub_category: 'cleanser',        product_type: 'Face Cleanser',    item_form: 'Powder', google: G.FACIAL_CLEANSER },
  'BD-CLE-KOJIC-GLY':    { category: 'skin', sub_category: 'cleanser',        product_type: 'Face Cleanser',    item_form: 'Gel',    google: G.FACIAL_CLEANSER },

  // ── Body ───────────────────────────────────────────────────────────────────
  // Genuinely dual-use, and the Navbar lists "Face & Body Wash" under Body, so
  // `body` is the correct home for these two.
  'BD-CLE-ROSE':         { category: 'body', sub_category: 'face_body_wash',  product_type: 'Face & Body Wash', item_form: 'Gel',    google: G.BODY_WASH },
  'BD-CLE-STRAW':        { category: 'body', sub_category: 'face_body_wash',  product_type: 'Face & Body Wash', item_form: 'Gel',    google: G.BODY_WASH },
  // These three were category "skin" with product_type "cleansing bar" and
  // item_form "bar" — the reason Body › Soaps showed 2 of 5.
  'BD-SOAP-GOAT':        { category: 'body', sub_category: 'soap',            product_type: 'Soap Bar',         item_form: 'Bar',    google: G.BAR_SOAP },
  'BD-SOAP-OLIVE':       { category: 'body', sub_category: 'soap',            product_type: 'Soap Bar',         item_form: 'Bar',    google: G.BAR_SOAP },
  'BD-SOAP-RED-SANDAL-100G':   { category: 'body', sub_category: 'soap',      product_type: 'Soap Bar',         item_form: 'Bar',    google: G.BAR_SOAP },
  'BD-SOAP-TEMPLE-100G':       { category: 'body', sub_category: 'soap',      product_type: 'Soap Bar',         item_form: 'Bar',    google: G.BAR_SOAP },
  'BD-SOAP-FRANKINCENSE-100G': { category: 'body', sub_category: 'soap',      product_type: 'Soap Bar',         item_form: 'Bar',    google: G.BAR_SOAP },

  // ── Lip care ───────────────────────────────────────────────────────────────
  // Balms are Skin Care in Google's taxonomy, NOT Lip Makeup. The tinted one is
  // still a balm — tint is a feature, not the category.
  'BD-LIP-BEET':         { category: 'lip',  sub_category: 'lip_balm',        product_type: 'Lip Balm',         item_form: 'Balm',   google: G.LIP_BALM },
  'BD-LIP-CARROT':       { category: 'lip',  sub_category: 'lip_balm',        product_type: 'Lip Balm',         item_form: 'Balm',   google: G.LIP_BALM },
  'BD-LIP-SUN':          { category: 'lip',  sub_category: 'lip_balm',        product_type: 'Lip Balm',         item_form: 'Balm',   google: G.LIP_BALM },

  // ── Makeup ─────────────────────────────────────────────────────────────────
  'BD-FOUND-FRESH':      { category: 'makeup', sub_category: 'foundation',    product_type: 'Foundation',       item_form: 'Liquid', google: G.FOUNDATION },
  'BD-LIP-MATT':         { category: 'makeup', sub_category: 'lipstick',      product_type: 'Lipstick',         item_form: 'Liquid', google: G.LIPSTICK },

  // ── Hair ───────────────────────────────────────────────────────────────────
  // was "Shampoo" / "Hair shampoo" / "Shampoo bar" — three chips, one type.
  'BD-SHAM-BANANA':      { category: 'hair', sub_category: 'shampoo',         product_type: 'Shampoo',          item_form: 'Liquid', google: G.SHAMPOO },
  'BD-SHAM-DAND':        { category: 'hair', sub_category: 'shampoo',         product_type: 'Shampoo',          item_form: 'Liquid', google: G.SHAMPOO },
  'BD-SHAM-BAR':         { category: 'hair', sub_category: 'shampoo',         product_type: 'Shampoo',          item_form: 'Bar',    google: G.SHAMPOO },
  'BD-COND-KERATIN':     { category: 'hair', sub_category: 'conditioner',     product_type: 'Conditioner',      item_form: 'Cream',  google: G.CONDITIONER },
  'BD-HAIR-SER':         { category: 'hair', sub_category: 'hair_serum',      product_type: 'Hair Serum',       item_form: 'Serum',  google: G.HAIR_STYLING },
  'BD-HAIR-OIL-HERB':    { category: 'hair', sub_category: 'hair_oil',        product_type: 'Hair Oil',         item_form: 'Oil',    google: G.HAIR_CARE },
  // Deliberately the generic Hair Care node, NOT "Hair Loss Treatments" (4766).
  // That leaf pulls items into Merchant Center's healthcare policy review, and
  // these listings make hair-growth claims that would likely be flagged there.
  'BD-HAIR-GROWTH':      { category: 'hair', sub_category: 'scalp_treatment', product_type: 'Scalp Serum',      item_form: 'Serum',  google: G.HAIR_CARE },
  // was product_type "Hair serum" while sub_category said scalp_treatment.
  'BD-HAIR-BABY':        { category: 'hair', sub_category: 'scalp_treatment', product_type: 'Scalp Serum',      item_form: 'Serum',  google: G.HAIR_CARE },
};

const FIELDS = ['category', 'sub_category', 'product_type', 'item_form', 'google_product_category'];

const CATEGORY_ENUM = Product.schema.path('category').enumValues;

/**
 * bulkWrite/updateOne do NOT run Mongoose validators, so a typo in a `category`
 * above would persist happily and only surface later as a ValidationError on an
 * unrelated doc.save(). Check the enum here instead, before touching the DB.
 */
function assertMappingIsValid() {
  const bad = Object.entries(TAXONOMY)
    .filter(([, t]) => !CATEGORY_ENUM.includes(t.category))
    .map(([pid, t]) => `   ${pid}: category "${t.category}" not in [${CATEGORY_ENUM.join(', ')}]`);
  if (bad.length) {
    console.error('✗ Invalid category values in TAXONOMY:\n' + bad.join('\n'));
    process.exit(1);
  }
  // sub_category is stored `lowercase: true`; anything else here would read
  // back different from what we wrote and the diff would never converge.
  const badSub = Object.entries(TAXONOMY)
    .filter(([, t]) => t.sub_category !== t.sub_category.toLowerCase())
    .map(([pid, t]) => `   ${pid}: sub_category "${t.sub_category}" must be lowercase`);
  if (badSub.length) {
    console.error('✗ Invalid sub_category values in TAXONOMY:\n' + badSub.join('\n'));
    process.exit(1);
  }
}

/** Cross-check every GOOGLE node against a local copy of the published taxonomy. */
function verifyTaxonomy(filePath) {
  const valid = new Set(
    fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.slice(l.indexOf(' - ') + 3).trim())
  );
  const bad = Object.entries(G).filter(([, v]) => !valid.has(v));
  if (bad.length) {
    console.error('✗ Not real Google taxonomy nodes:');
    bad.forEach(([k, v]) => console.error(`   ${k}: ${v}`));
    process.exit(1);
  }
  console.log(`✓ All ${Object.keys(G).length} Google taxonomy nodes verified against ${path.basename(filePath)}`);
}

async function run() {
  if (TAXONOMY_FILE) verifyTaxonomy(TAXONOMY_FILE);
  assertMappingIsValid();

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI not set in backend/.env');
  // MONGO_URI carries no database name — server.js supplies it separately via
  // DB_NAME. Omitting it here connects to "test", which exists, returns zero
  // products, and reports a clean "nothing to do" run against the wrong DB.
  if (!process.env.DB_NAME) throw new Error('DB_NAME not set in backend/.env (server.js passes it to mongoose.connect)');
  await mongoose.connect(uri, { dbName: process.env.DB_NAME });
  console.log(`Connected to "${mongoose.connection.name}". Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}\n`);

  // isActive is not filtered: an inactive product still needs correct taxonomy
  // for when it is switched back on.
  const products = await Product.find({}, 'pid name category sub_category product_type item_form google_product_category');

  const unmapped = products.filter((p) => !TAXONOMY[p.pid]);
  const missing = Object.keys(TAXONOMY).filter((pid) => !products.some((p) => p.pid === pid));

  let changedCount = 0;
  const ops = [];
  // Pre-change snapshot of just the five fields we touch, so a bad call on the
  // product_type vocabulary can be reverted without restoring a whole dump.
  const backup = [];

  for (const p of products) {
    const target = TAXONOMY[p.pid];
    if (!target) continue;

    const desired = {
      category: target.category,
      sub_category: target.sub_category,
      product_type: target.product_type,
      item_form: target.item_form,
      google_product_category: target.google,
    };

    const diffs = FIELDS
      .filter((f) => (p[f] || '') !== desired[f])
      .map((f) => `      ${f}: ${JSON.stringify(p[f] || '')} → ${JSON.stringify(desired[f])}`);

    if (!diffs.length) continue;
    changedCount++;
    console.log(`  ${p.pid}  ${p.name}`);
    console.log(diffs.join('\n'));

    backup.push({ pid: p.pid, ...Object.fromEntries(FIELDS.map((f) => [f, p[f] ?? ''])) });
    ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: desired } } });
  }

  console.log(`\n${changedCount} of ${products.length} products need changes.`);
  if (unmapped.length) {
    console.warn(`\n⚠  ${unmapped.length} product(s) in the DB have no entry in TAXONOMY and were left untouched:`);
    unmapped.forEach((p) => console.warn(`   ${p.pid}  ${p.name}`));
  }
  if (missing.length) {
    console.warn(`\n⚠  ${missing.length} pid(s) in TAXONOMY do not exist in the DB:`);
    missing.forEach((pid) => console.warn(`   ${pid}`));
  }

  if (DRY_RUN) {
    console.log('\nDry run — nothing written. Re-run without --dry-run to apply.');
  } else if (ops.length) {
    const backupPath = path.join(
      __dirname,
      `backup_taxonomy_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\nPre-change values saved to ${path.basename(backupPath)} (${backup.length} products).`);

    const res = await Product.bulkWrite(ops, { ordered: false });
    console.log(`\n✓ Applied. matched=${res.matchedCount} modified=${res.modifiedCount}`);
    console.log('\nNext: the Shop facets are served from Product.distinct() with a');
    console.log('5-minute CDN cache (Vercel-CDN-Cache-Control on /api/v1/products),');
    console.log('and the Merchant Center feed is cached 1h at the edge, so allow');
    console.log('~1h before re-fetching https://bodilicious.in/product-feed.xml.');
  } else {
    console.log('\nNothing to do — catalogue already matches.');
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
