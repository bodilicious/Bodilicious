# Payments, currency and refunds

The full narrative flow lives in `backend/ORDER_PAYMENT_WORKFLOW.md` and is worth reading
for the three-step quote → init → verify sequence and the retry/webhook/reconciliation
safety net. That document describes intent; this one records where intent and behaviour
have diverged, and the invariants worth preserving.

Treat the workflow doc as descriptive rather than authoritative — it has drifted from the
code before (it documents an invoice format and a cron cadence that no longer match).

## Currency invariants

**Every monetary field on an Order is denominated in `order.currency`.** That includes
`totalAmount`, `originalAmount`, `shippingCost`, `discountAmount`, `refundAmount`, and
`items[].priceAtPurchase`. Only *catalogue* prices (`Product.price`) are reliably INR.

Consequences worth holding onto:

- A hardcoded `₹` or `toLocaleString("en-IN")` is a bug on every foreign order. Format via
  the order's own currency.
- `exchangeRate` is the INR→currency rate locked at quote time, so INR-equivalent
  reporting stays recoverable as `amount / exchangeRate`.
- Aggregations must not sum `totalAmount` across mixed currencies. The existing analytics
  guard with `$ifNull: ["$currency", "INR"]` and only total the INR rows — preserve that
  shape when adding new aggregations.

### Minor units

Razorpay sends and receives integer **minor units**. Use `toRazorpayMinorUnits` /
`fromRazorpayMinorUnits` from `backend/utils/currencies.js` — never `* 100` or `/ 100`.
The multiplier is currency-dependent:

| Currency class | Factor | Example |
|---|---|---|
| Most (USD, EUR, INR…) | 100 | USD 12.50 → 1250 |
| Zero-decimal (JPY, KRW, VND…) | 1 | JPY 1250 → 1250 |
| Three-decimal (KWD, BHD, OMR…) | 1000 | KWD 1.250 → 1250 |

Every checkout currency currently happens to be 2-decimal, which means a `/100` bug is
*latent* rather than visible. Adding JPY or KWD to `CHECKOUT_CURRENCIES` would activate it,
so fix these on sight rather than reasoning "it works today".

Webhook payloads (`payment.amount`, `refund.amount`) are minor units and carry their own
`currency` field — prefer that over the order's when handling an orphaned payment, since
there may be no order to read from.

### Display vs checkout currency

Two distinct concepts, and conflating them produces mixed-symbol checkout screens:

- **Display**: any of ~160 currencies, chosen from the IP-detected country.
- **Checkout**: must be in `CHECKOUT_CURRENCIES` (Razorpay-supported). Anything else falls
  back to INR with `isFallback: true`.

The rule that keeps them coherent: only display in a foreign currency when checkout can
also charge in it and a rate is available; otherwise display INR, matching the fallback.
`GET /api/v1/settings` exposes `checkoutExchangeRates` (the small supported set) for this.
The full ~150-currency map is deliberately withheld from that public endpoint for payload size.

## Idempotency: the atomic claim

`processPaidOrder` is reachable from three independent paths — the frontend `/verify`
call, the `payment.captured` webhook, and the reconciliation cron. They race by design.

The gate is a single `findOneAndUpdate` that flips `paymentStatus` to `"paid"` and returns
the pre-update document. Exactly one caller wins; the others get `null` and return
"Already processed". **It runs outside the Mongoose transaction on purpose**, so that if
the transaction aborts the claim persists and the order stays recoverable rather than
being silently reprocessed.

Two consequences that look like bugs but aren't:

- A claimed-but-unfinished order (`paymentStatus: "paid"`, `invoiceGenerated: false`, not
  in `UserProfile.orders`) is the signature of a crashed transaction. The webhook treats a
  lock older than 2 minutes as stale and reprocesses; younger than that, it returns 409 so
  Razorpay retries.
- On transaction failure the claim is explicitly reverted to its prior state so the
  reconciliation cron — which queries `pending`/`failed` — can pick the order up again.

If you change any of this, preserve the property that **no path can complete an order
twice**, and that a failure leaves the order in a state some other path will still find.

## Quote signing

`/quote` returns a base64 payload plus an HMAC over it, keyed on `RAZORPAY_KEY_SECRET`.
`/razorpay/init` recomputes and compares before trusting any amount. The signature covers
the country, the user, the amounts and a 30-minute expiry.

What the signature does **not** cover is store settings. A quote issued while
international shipping was enabled stays valid for 30 minutes after it's switched off, so
`initRazorpayOrder` re-checks `internationalShippingEnabled`, `internationalCheckoutEnabled`
and `supportedCountries` independently. Any new setting that can forbid an order needs the
same treatment in both places.

### Price-drift tolerance

`init` re-computes the total and compares it to the quoted one within a tolerance. Scale
any absolute floor by the exchange rate — a flat `1` means ₹1 domestically but $1
internationally, roughly 87× wider, and quietly absorbs genuine price changes at the
store's expense.

## Failure modes with real money attached

- **202, not 500.** If the signature verified, Razorpay has captured the payment. Returning
  500 tells the customer it failed while their money is gone. `/verify` returns 202 with
  `paymentCaptured: true` and lets the webhook finish the job.
- **`needsManualReview`** is the indexed escape hatch for "money taken, order not
  completed". `server.js` alerts on it at startup. Prefer it over inventing status values.
- **Orphaned payments** (captured with no matching order) are auto-refunded and logged at
  CRITICAL. Amount and currency must come from the Razorpay entity — there's no order.
- **Reconciliation** has an idle-skip that suppresses runs for 4 hours after an empty one.
  A manual admin trigger must pass `{ force: true }` to bypass it, and a forced run that
  finds nothing must *not* re-arm the window — an order younger than the 3-minute minimum
  age is invisible to the query, and re-arming would hide it for another 4 hours.
