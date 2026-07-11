/**
 * currencies.js — Backend source of truth for currency support tiers.
 * Mirrors frontend/src/utils/currencies.ts — keep in sync.
 */

// Tier 1: Razorpay definitively supports these internationally.
const TIER_1_CHECKOUT = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'DKK',
]);

// Tier 2: Likely supported with international payments enabled.
const TIER_2_CHECKOUT = new Set([
]);

export const CHECKOUT_CURRENCIES = new Set([
  ...TIER_1_CHECKOUT,
  ...TIER_2_CHECKOUT,
]);

// Zero minor-unit currencies: amount × 1 (no paise/cents)
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'ISK', 'BIF', 'CLP', 'GNF', 'MGA',
  'PYG', 'RWF', 'UGX', 'XAF', 'XOF', 'XPF',
]);

// Three minor-unit currencies: amount × 1000
export const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'KWD', 'OMR', 'JOD', 'TND',
]);

/**
 * Converts a decimal amount to Razorpay's integer minor-unit amount.
 * USD 12.50 → 1250, JPY 1250 → 1250, KWD 1.250 → 1250
 */
export function toRazorpayMinorUnits(amount, currency) {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return Math.round(amount);
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return Math.round(amount * 1000);
  return Math.round(amount * 100);
}

/**
 * Returns the number of decimal places for a given currency.
 * Used to round converted prices correctly.
 */
export function getCurrencyFractionDigits(currency) {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

/**
 * Rounds a converted price to the correct precision for the currency.
 */
export function roundForCurrency(amount, currency) {
  const digits = getCurrencyFractionDigits(currency);
  return Number(amount.toFixed(digits));
}
