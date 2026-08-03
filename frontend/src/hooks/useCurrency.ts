import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getCurrencyFractionDigits, CHECKOUT_CURRENCIES } from '../utils/currencies';

/**
 * Formats INR-denominated catalogue prices for display.
 *
 * The display currency must always match the currency the customer will actually
 * be charged in, otherwise the checkout screen mixes symbols. The backend picks the
 * checkout currency the same way: if it's in CHECKOUT_CURRENCIES and we hold a rate
 * for it, use it — otherwise fall back to INR.
 *
 * This previously hardcoded a rate for USD only, so EUR/GBP/CAD/AUD/DKK shoppers
 * saw ₹ line items next to a €/£ order total.
 */
export function useCurrency() {
  const { userCurrency, storeSettings } = useApp();

  const formatPrice = useCallback((priceInINR: number) => {
    const formatINR = (value: number) =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    if (userCurrency === 'INR') return formatINR(priceInINR);

    // Only convert into a currency we can also charge in — and only when the
    // backend actually supplied a rate for it.
    const rate = CHECKOUT_CURRENCIES.has(userCurrency)
      ? storeSettings?.checkoutExchangeRates?.[userCurrency]
      : undefined;

    // No usable rate → display INR, which is exactly what checkout will fall back to.
    if (!rate || rate <= 0) return formatINR(priceInINR);

    const fractionDigits = getCurrencyFractionDigits(userCurrency);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: userCurrency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(priceInINR * rate);
  }, [userCurrency, storeSettings?.checkoutExchangeRates]);

  return { formatPrice, userCurrency };
}
