import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getCurrencyFractionDigits } from '../utils/currencies';

export function useCurrency() {
  const { userCurrency, storeSettings } = useApp();

  const formatPrice = useCallback((priceInINR: number) => {
    if (userCurrency !== 'INR') {
      const rate = storeSettings?.exchangeRates?.[userCurrency] ||
                   (userCurrency === 'USD' ? (storeSettings?.usdExchangeRate ? 1 / storeSettings.usdExchangeRate : 0.012) : null);

      // If we have no rate at all (currency not in exchange map), fall back to INR display
      if (rate == null) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(priceInINR);
      }

      const convertedPrice = priceInINR * rate;
      const fractionDigits = getCurrencyFractionDigits(userCurrency);

      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: userCurrency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(convertedPrice);
    }

    // Default to INR
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(priceInINR);
  }, [userCurrency, storeSettings?.exchangeRates, storeSettings?.usdExchangeRate]);

  return { formatPrice, userCurrency };
}
