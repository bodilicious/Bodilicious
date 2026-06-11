/**
 * currencies.ts — Single source of truth for currency support tiers.
 *
 * Two tiers:
 *   DISPLAY  — All ~160 currencies (from exchange rate API). Used for price
 *              formatting on the storefront. No Razorpay involvement.
 *   CHECKOUT — Curated static list that Razorpay can process. Tier 1 are
 *              definitively supported; Tier 2 require international payments
 *              to be enabled on the merchant account (which it is in production).
 *
 * Minor-unit rules (Razorpay amount field):
 *   Standard (2 decimal) → multiply by 100   e.g. USD 12.50 → 1250
 *   Zero-decimal          → multiply by 1     e.g. JPY 1250  → 1250
 *   Three-decimal (KWD etc) → multiply by 1000 e.g. KWD 1.250 → 1250
 */

// ─── Checkout-supported currencies ───────────────────────────────────────────
// Tier 1: Razorpay definitively supports these internationally.
const TIER_1_CHECKOUT: readonly string[] = [
  'INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD',
  'CHF', 'HKD', 'JPY', 'MYR', 'NZD', 'SAR', 'ZAR', 'THB',
  'SEK', 'NOK', 'DKK', 'QAR', 'BHD', 'KWD', 'OMR',
];

// Tier 2: Likely supported with international payments enabled.
const TIER_2_CHECKOUT: readonly string[] = [
  'IDR', 'PHP', 'BDT', 'LKR', 'NPR', 'PKR', 'MXN', 'BRL',
  'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'EGP', 'NGN',
  'KES', 'GHS', 'TZS', 'UGX',
];

export const CHECKOUT_CURRENCIES: ReadonlySet<string> = new Set([
  ...TIER_1_CHECKOUT,
  ...TIER_2_CHECKOUT,
]);

// Currencies with zero minor units (no cents/paise) — amount sent as-is to Razorpay
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'JPY', 'KRW', 'VND', 'ISK', 'BIF', 'CLP', 'GNF', 'MGA',
  'PYG', 'RWF', 'UGX', 'XAF', 'XOF', 'XPF',
]);

// Currencies with three minor units — amount multiplied by 1000
export const THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'BHD', 'KWD', 'OMR', 'JOD', 'TND',
]);

/**
 * Returns how many fraction digits this currency uses for display.
 * e.g. JPY → 0, USD → 2, KWD → 3
 */
export function getCurrencyFractionDigits(currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

/**
 * Converts a decimal amount to Razorpay's required integer minor-unit amount.
 * e.g.  USD 12.50  → 1250  (×100)
 *        JPY 1250   → 1250  (×1)
 *        KWD 1.250  → 1250  (×1000)
 */
export function toRazorpayMinorUnits(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return Math.round(amount);
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return Math.round(amount * 1000);
  return Math.round(amount * 100);
}

/**
 * Determines which currency to use at checkout.
 *
 * If the user's selected currency is in CHECKOUT_CURRENCIES → use it directly.
 * Otherwise → fall back to INR with a flag so the UI can show a message.
 */
export function getCheckoutCurrency(selectedCurrency: string): {
  currency: string;
  isFallback: boolean;
} {
  if (CHECKOUT_CURRENCIES.has(selectedCurrency)) {
    return { currency: selectedCurrency, isFallback: false };
  }
  return { currency: 'INR', isFallback: true };
}

/**
 * Formats a label for the currency dropdown.
 * e.g. 'USD' → 'USD – US Dollar'
 */
export const CURRENCY_LABELS: Record<string, string> = {
  INR: 'INR – Indian Rupee',
  USD: 'USD – US Dollar',
  EUR: 'EUR – Euro',
  GBP: 'GBP – British Pound',
  SGD: 'SGD – Singapore Dollar',
  AED: 'AED – UAE Dirham',
  AUD: 'AUD – Australian Dollar',
  CAD: 'CAD – Canadian Dollar',
  CHF: 'CHF – Swiss Franc',
  HKD: 'HKD – Hong Kong Dollar',
  JPY: 'JPY – Japanese Yen',
  MYR: 'MYR – Malaysian Ringgit',
  NZD: 'NZD – New Zealand Dollar',
  SAR: 'SAR – Saudi Riyal',
  ZAR: 'ZAR – South African Rand',
  THB: 'THB – Thai Baht',
  SEK: 'SEK – Swedish Krona',
  NOK: 'NOK – Norwegian Krone',
  DKK: 'DKK – Danish Krone',
  QAR: 'QAR – Qatari Riyal',
  BHD: 'BHD – Bahraini Dinar',
  KWD: 'KWD – Kuwaiti Dinar',
  OMR: 'OMR – Omani Rial',
  IDR: 'IDR – Indonesian Rupiah',
  PHP: 'PHP – Philippine Peso',
  BDT: 'BDT – Bangladeshi Taka',
  LKR: 'LKR – Sri Lankan Rupee',
  NPR: 'NPR – Nepalese Rupee',
  PKR: 'PKR – Pakistani Rupee',
  MXN: 'MXN – Mexican Peso',
  BRL: 'BRL – Brazilian Real',
  PLN: 'PLN – Polish Złoty',
  CZK: 'CZK – Czech Koruna',
  HUF: 'HUF – Hungarian Forint',
  RON: 'RON – Romanian Leu',
  BGN: 'BGN – Bulgarian Lev',
  TRY: 'TRY – Turkish Lira',
  EGP: 'EGP – Egyptian Pound',
  NGN: 'NGN – Nigerian Naira',
  KES: 'KES – Kenyan Shilling',
  GHS: 'GHS – Ghanaian Cedi',
  TZS: 'TZS – Tanzanian Shilling',
  UGX: 'UGX – Ugandan Shilling',
};

// ─── Country → Currency map ───────────────────────────────────────────────────
// ISO 3166-1 alpha-2 country code → ISO 4217 currency code.
// Covers ~200 countries. Falls back to INR if not found.
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // South Asia
  IN: 'INR', NP: 'NPR', LK: 'LKR', BD: 'BDT', PK: 'PKR', BT: 'BTN', MV: 'MVR',

  // East Asia
  JP: 'JPY', CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', MO: 'MOP',

  // Southeast Asia
  SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND',
  MM: 'MMK', KH: 'KHR', LA: 'LAK', BN: 'BND', TL: 'USD',

  // Oceania
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD', PG: 'PGK', SB: 'SBD', WS: 'WST',
  TO: 'TOP', VU: 'VUV', PW: 'USD', FM: 'USD', MH: 'USD', KI: 'AUD',
  NR: 'AUD', TV: 'AUD', CK: 'NZD', NU: 'NZD',

  // Middle East / Gulf
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
  JO: 'JOD', IQ: 'IQD', IR: 'IRR', YE: 'YER', SY: 'SYP', LB: 'LBP',
  IL: 'ILS', PS: 'ILS',

  // Europe — Eurozone
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', FI: 'EUR', IE: 'EUR', GR: 'EUR', LU: 'EUR',
  SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR',
  MT: 'EUR', MC: 'EUR', SM: 'EUR', VA: 'EUR', AD: 'EUR',

  // Europe — Non-Eurozone
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', HR: 'EUR', RS: 'RSD',
  UA: 'UAH', RU: 'RUB', TR: 'TRY', IS: 'ISK', LI: 'CHF', AL: 'ALL',
  BA: 'BAM', MK: 'MKD', ME: 'EUR', XK: 'EUR', MD: 'MDL', BY: 'BYN',
  GE: 'GEL', AM: 'AMD', AZ: 'AZN',

  // North America
  US: 'USD', CA: 'CAD', MX: 'MXN', GT: 'GTQ', BZ: 'BZD', HN: 'HNL',
  SV: 'USD', NI: 'NIO', CR: 'CRC', PA: 'USD',

  // Caribbean
  CU: 'CUP', JM: 'JMD', HT: 'HTG', DO: 'DOP', TT: 'TTD', BB: 'BBD',
  LC: 'XCD', VC: 'XCD', GD: 'XCD', AG: 'XCD', KN: 'XCD', DM: 'XCD',
  BS: 'BSD', TC: 'USD', KY: 'KYD', AW: 'AWG', CW: 'ANG', PR: 'USD',

  // South America
  BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', VE: 'VES',
  EC: 'USD', BO: 'BOB', PY: 'PYG', UY: 'UYU', GY: 'GYD', SR: 'SRD',
  GF: 'EUR', FK: 'FKP',

  // Africa — West
  NG: 'NGN', GH: 'GHS', SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF',
  NE: 'XOF', TG: 'XOF', BJ: 'XOF', GN: 'GNF', SL: 'SLL', LR: 'LRD',
  GM: 'GMD', GW: 'XOF', CV: 'CVE', MR: 'MRU',

  // Africa — East
  KE: 'KES', TZ: 'TZS', UG: 'UGX', ET: 'ETB', RW: 'RWF', BI: 'BIF',
  SO: 'SOS', DJ: 'DJF', ER: 'ERN', SD: 'SDG', SS: 'SSP', MG: 'MGA',
  MU: 'MUR', SC: 'SCR', KM: 'KMF', MZ: 'MZN', ZW: 'ZWL', MW: 'MWK',
  ZM: 'ZMW',

  // Africa — Southern
  ZA: 'ZAR', BW: 'BWP', NA: 'NAD', LS: 'LSL', SZ: 'SZL', AO: 'AOA',

  // Africa — North
  EG: 'EGP', MA: 'MAD', TN: 'TND', LY: 'LYD', DZ: 'DZD',

  // Africa — Central
  CM: 'XAF', CG: 'XAF', CF: 'XAF', GA: 'XAF', TD: 'XAF', GQ: 'XAF',
  CD: 'CDF',

  // Central Asia
  KZ: 'KZT', UZ: 'UZS', TM: 'TMT', KG: 'KGS', TJ: 'TJS',

  // Afghanistan / Mongolia
  AF: 'AFN', MN: 'MNT',
};

/**
 * Returns the appropriate currency code for a given ISO country code.
 * Used for auto-detecting currency from IP-detected country on first visit.
 *
 * Priority:
 *   1. Exact match in COUNTRY_CURRENCY_MAP
 *   2. Fallback to INR (safe default for a store based in India)
 */
export function getCurrencyForCountry(countryCode: string): string {
  if (!countryCode) return 'INR';
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] ?? 'INR';
}

