---
name: bodilicious-frontend
description: Money-display and store-settings traps in the Bodilicious storefront (React + Vite). Use this whenever the work touches a price, a total, a currency symbol, the cart / shipping / payment checkout pages, the quote response, `useCurrency`, `storeSettings`, or the admin settings UI. The critical trap is that `formatPrice` CONVERTS from INR while `formatCurrency` formats as-is, and every value the quote endpoint returns is already converted — mixing them up silently renders a $40 cart as $0.46 with no error, no warning and a passing typecheck. Consult this before formatting any amount or reading any `storeSettings` field.
---

# Bodilicious storefront

The storefront's failures are visual and silent: a wrong number renders happily, the
typecheck passes, and nothing logs. The compiler cannot help here because every amount is
just `number` — the currency it's denominated in lives only in your head. This skill
records where that has actually gone wrong.

## The one trap that matters most

Two formatters exist and they are **not** interchangeable:

| Function | Behaviour | Use for |
|---|---|---|
| `formatPrice(x)` (from `useCurrency`) | **converts** `x` from INR into the display currency | values that really are INR |
| `formatCurrency(x, code)` (from `utils/currencies`) | formats `x` as-is in `code` | values already in their final currency |

**Everything the quote endpoint returns is already converted.** `subtotal`, `shippingCost`,
`discountAmount`, `totalAmount` all come back in the checkout currency, not INR. Passing
any of them to `formatPrice` converts a second time.

Concretely, this shipped on the cart page: a US shopper with a ₹1499 cart and ₹2000
international shipping saw

```
Subtotal  $17.24     <- cartTotal is genuinely INR, so correct
Shipping   $0.26     <- already USD, converted again
Total      $0.46     <- already USD, converted again
```

A total smaller than the subtotal directly above it, 87× under, then jumping to $40.24 on
the next page. No error anywhere.

### What is actually in INR

Only these. Everything else in a checkout view came from the quote and is already converted:

- `cartTotal` and `item.product.price` — summed locally from catalogue prices
- `storeSettings.shippingThreshold` / `shippingCost` / `internationalShipping*`
- `Product.price` anywhere in the catalogue

### The established pattern

`ShippingPage` and `PaymentPage` do this correctly — copy them rather than inventing a
variant. Track an `isFetched` flag so pre-quote render still shows something sensible:

```tsx
{quoteData.isFetched && quoteData.subtotal !== undefined
  ? formatCurrency(quoteData.subtotal, quoteData.currency)   // post-quote: already converted
  : formatPrice(cartTotal)}                                  // pre-quote: genuine INR
```

Whenever a component stores quote results in state, store `currency` alongside them. A
bare `number` in state with no currency next to it is how this bug gets reintroduced.

## Display currency vs checkout currency

`userCurrency` is IP-detected (Cloudflare `cf-ipcountry` → `getCurrencyForCountry`) and
manual selection is disabled. It can be any of ~160 currencies, but checkout only supports
the `CHECKOUT_CURRENCIES` set.

`useCurrency` only converts when the currency is in that set **and** the backend supplied a
rate in `storeSettings.checkoutExchangeRates`; otherwise it renders INR — which matches the
backend's own INR fallback, so display and billing stay coherent. Keep that coupling. If
you make display convert a currency checkout can't charge in, you get ₹ line items beside a
€ order total, which is precisely the bug that motivated `checkoutExchangeRates` existing.

Note the ordering hazard: widening the set of currencies with rates makes *any* latent
double-conversion visible to more users. The cart bug above only affected USD shoppers
until EUR/GBP/CAD/AUD/DKK rates were added.

## `storeSettings` has defaults, so missing fields fail silently

`AppContext` seeds `storeSettings` with a full default object and merges the API response
over it. A field the backend stops returning doesn't become `undefined` and doesn't throw —
it silently keeps the default, which is usually the *safe-looking wrong* value (`false`,
`0`, `'IN'`).

Before relying on a settings field in a component, confirm the public handler actually
returns it. `GET /api/v1/settings` deliberately omits some things for payload size —
`supportedCountries` (~2.6 KB) and the full `exchangeRates` map (~3 KB) are not sent.

This one-liner catches drift in both directions:

```bash
node -e "
const fs=require('fs');
const t=fs.readFileSync('frontend/src/context/AppContext.tsx','utf8').split('storeSettings: {')[1].split('\n  };')[0];
const d=fs.readFileSync('backend/settings/controller.js','utf8').split('res.json({')[1].split('});')[0];
const decl=[...t.matchAll(/^\s{4}(\w+)\??:/gm)].map(m=>m[1]);
const ret=new Set([...d.matchAll(/^\s{8}(\w+)[,:]/gm)].map(m=>m[1]));
console.log('expected but never sent:', decl.filter(k=>!ret.has(k)));
"
```

Adding a settings field means touching four places, and skipping any one produces a toggle
that appears to work and does nothing: the Mongoose schema, the `flatFields` save
whitelist, the public response, and the `AppContext` type plus its default.

## Country: name, not ISO code

The backend validates shipping country against `supportedCountries`, which holds full names
(`"United States of America"`). Sending `"US"` is rejected with *"We do not currently ship
to US"*. Use `getCountryNameFromIso()` from `utils/countries.ts` when converting a detected
country code for any request.

That mismatch previously surfaced as a spurious *coupon* error, because the cart's quote
`.catch` funnels every failure into `setCouponError` — so the message you see may have
nothing to do with the actual failure. Read the network response, not the UI copy.

## Testing the storefront

Three caches will serve stale data and look like a broken fix:

- `GET /api/v1/settings` sends `Cache-Control: max-age=300` in production (`no-store` in
  dev, gated on `NODE_ENV`). Test with devtools cache disabled.
- The backend's own `getSettings()` cache holds for 60s.
- Quote rate limits: 60/min for `/quote`, 20/min for init and verify. Repeated manual
  checkout attempts trip these and resemble a bug.

To browse as an international shopper you need `cf-ipcountry` set, which only Cloudflare
can do on a proxied request — use a VPN, or temporarily override `detectedCountryCode` in
the settings response while testing.

## Verify a money change by rendering it, not by reading it

A three-line node script that applies the real rate to the real numbers settles a
double-conversion question faster than re-reading the component, and gives you something
concrete to paste into a PR:

```js
const rate = 0.0115;                       // INR -> USD
const formatPrice = (inr) => inr * rate;   // converts
const formatCurrency = (v) => v;           // formats as-is
console.log(formatPrice(23.00), formatCurrency(23.00));   // 0.26 vs 23.00
```
