/**
 * Bodilicious product → Amazon listing URL map.
 *
 * HOW TO USE:
 *   - Replace each `null` with the real Amazon.in product URL once you have it.
 *   - A `null` entry means "not on Amazon" — the AmazonBadge component will
 *     not render for that product. No code change needed, just fill in the URL.
 *   - Format: 'https://www.amazon.in/dp/BXXXXXXXXX'
 *
 * IMPORTANT: Do NOT use affiliate/shortened links here. Use canonical Amazon dp/ URLs
 * so the `sameAs` structured data is clean and Google can resolve the entity.
 */
export const AMAZON_LINKS: Record<string, string | null> = {
  // ─── Serums ───────────────────────────────────────────────────────────────
  'BD-SER-VITC':       'https://www.amazon.in/dp/B0BVBDFKM7',  // Vitamin C Serum
  'BD-SER-AZE':        'https://www.amazon.in/dp/B0BVBP2KHH',  // Azelaic Acid Serum
  'BD-SER-RET':        'https://www.amazon.in/dp/B0BFD9STGH',  // Retinol Serum
  'BD-SER-HA':         'https://www.amazon.in/dp/B094FQY4D7',  // Hyaluronic Acid Serum
  'BD-SER-SAL':        'https://www.amazon.in/dp/B0BVBL84HX',  // Salicylic Acid Serum
  'BD-SER-AHA-BHA':    'https://www.amazon.in/dp/B094FZV9RV',  // AHA + BHA Serum
  'BD-SER-NIA-SPF30':  'https://www.amazon.in/dp/B09GFS9MGK',  // Niacinamide + SPF30 Serum
  'BD-SER-COQ10':      'https://www.amazon.in/dp/B09GFM7GNB',  // CoQ10 Serum
  'BD-SER-GLOW':       null,  // Glow Serum

  // ─── Moisturisers ─────────────────────────────────────────────────────────
  'BD-MOIST-PEP':          'https://www.amazon.in/dp/B0BT234NJS',  // Peptide Moisturiser
  'BD-MOIST-OATS':         'https://www.amazon.in/dp/B094FPHYNB',  // Oat Moisturiser
  'BD-MOIST-SILICA-OATS':  null,  // Silica + Oat Moisturiser

  // ─── Cleansers & Clay ─────────────────────────────────────────────────────
  'BD-CLE-ACNE':      null,  // Acne Face Wash
  'BD-CLE-KOJIC-GLY': 'https://www.amazon.in/dp/B09GFS8LYY',  // Kojic + Glycolic Cleanser
  'BD-CLE-ROSE':      'https://www.amazon.in/dp/B0BV717Q3X',  // Rose Cleanser
  'BD-CLE-STRAW':     null,  // Strawberry Cleanser
  'BD-CLAY-KAOLIN':   'https://www.amazon.in/dp/B09GFXLY6M',  // Kaolin Clay Mask

  // ─── Sunscreens ───────────────────────────────────────────────────────────
  'BD-SUN-PHYS-SPF50':      'https://www.amazon.in/dp/B094FJV8GB',  // Physical SPF50
  'BD-SUN-LIQ':             'https://www.amazon.in/dp/B0B8HB634T',  // Liquid Sunscreen
  'BD-SUN-HYD-SPF50-SPRAY': null,  // Hydrating SPF50 Spray

  // ─── Eye Care ─────────────────────────────────────────────────────────────
  'BD-EYE-DAY':   null,  // Day Eye Cream

  // ─── Retinol ──────────────────────────────────────────────────────────────
  'BD-RET-CREAM': 'https://www.amazon.in/dp/B094FHW6QL',  // Retinol Cream

  // ─── Gel ──────────────────────────────────────────────────────────────────
  'BD-GEL-SAF': 'https://www.amazon.in/dp/B09YNGXJ9X',  // Saffron Gel

  // ─── Hair Care ────────────────────────────────────────────────────────────
  'BD-HAIR-OIL-HERB': 'https://www.amazon.in/dp/B0BZRPQHFF',  // Herbal Hair Oil
  'BD-HAIR-SER':      'https://www.amazon.in/dp/B0948Z3CMJ',  // Hair Serum
  'BD-HAIR-BABY':     null,  // Baby Hair Care
  'BD-HAIR-GROWTH':   'https://www.amazon.in/dp/B09493ND49',  // Hair Growth Treatment
  

  // ─── Shampoos ─────────────────────────────────────────────────────────────
  'BD-SHAM-DAND':   null,  // Anti-Dandruff Shampoo
  'BD-SHAM-BAR':    'https://www.amazon.in/dp/B0DM18NSNN',  
  'BD-SHAM-BANANA': 'https://www.amazon.in/dp/B0BV7227LG',  // Banana Shampoo

  // ─── Conditioners ─────────────────────────────────────────────────────────
  'BD-COND-KERATIN': 'https://www.amazon.in/dp/B0BV63KHL7',  // Keratin Conditioner

  // ─── Soaps ────────────────────────────────────────────────────────────────
  'BD-SOAP-GOAT':             'https://www.amazon.in/dp/B09GFT5Y7M',  // Goat Milk Soap
  'BD-SOAP-OLIVE':             'https://www.amazon.in/dp/B09GFTP1D7',  // Olive Soap
  'BD-SOAP-RED-SANDAL-100G':  null,  // Red Sandal Soap
  'BD-SOAP-FRANKINCENSE-100G':null,  // Frankincense Soap
  'BD-SOAP-TEMPLE-100G':      null,  // Temple Soap

  // ─── Lip Care ─────────────────────────────────────────────────────────────
  'BD-LIP-SUN':   null,  // Lip Sunscreen
  'BD-LIP-CARROT':'https://www.amazon.in/dp/B094FW6CX9',  // Carrot Lip Balm
  'BD-LIP-BEET':  'https://www.amazon.in/dp/B0B87T2RMC',  // Beetroot Lip Balm
  'BD-LIP-MATT':  'https://www.amazon.in/dp/B0BX29ZST8',  // Matte Lip Balm

  // ─── Foundation ───────────────────────────────────────────────────────────
  'BD-FOUND-FRESH': null,  // Fresh Foundation
};

/** Returns the Amazon URL for a product, or null if it's not listed. */
export function getAmazonUrl(pid: string): string | null {
  return AMAZON_LINKS[pid] ?? null;
}
