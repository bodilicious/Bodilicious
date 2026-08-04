---
name: bodilicious-backend
description: Traps, invariants and verification patterns for the Bodilicious store backend — orders, Razorpay payments, currency, Shiprocket fulfilment, StoreSettings, and returns. Use this whenever the work touches an order, a payment, a refund, a price, a currency, a shipment, a webhook, StoreSettings, or the checkout/cart/quote flow — and also when writing a throwaway script to verify any of that against the real database or a live third-party API. Several bugs in this codebase are silent (Mongoose drops unknown fields with no error; `.lean()` skips schema defaults; Razorpay amounts are minor units; Shiprocket rewrites international addresses to a Delhi placeholder), so consult this before assuming a field persists, an amount is in rupees, or an address survives intact.
---

# Bodilicious backend

Domain knowledge for the store's money-and-parcels paths. The failures here are
disproportionately **silent** — the code runs, returns 200, and produces the wrong
number or ships to the wrong continent. That's why this skill exists: to name the
specific places where "it worked" and "it's correct" come apart.

## Read the right reference

Load only what the task needs:

| Working on | Read |
|---|---|
| Payments, refunds, prices, currency, quotes, webhooks | `references/payments.md` |
| Shipping, Shiprocket, AWBs, returns, international orders | `references/fulfilment.md` |
| Admin lists, dashboard counts, CSV exports, Mongo filters | `references/admin-queries.md` |
| Writing a script to check something against the real DB or a live API | `references/verification.md` |

## The four traps that cause the most damage

These recur. Check them by reflex before trusting any order-related code.

### 1. Mongoose silently drops fields that aren't in the schema

`strict: true` is the default. `Order.create({ currency: "USD" })` succeeds, returns a
document, and stores **nothing** for `currency` if the schema lacks that path. No error,
no warning. A production bug lived here for months: every foreign order was written
without its currency, so a customer charged $49.99 saw "₹49.99" and admin payment links
billed ₹50 instead of $50.

Before trusting any field you see being written, confirm it exists in
`backend/tracker/models.js`. `references/verification.md` has a three-line check.

### 2. `.lean()` skips schema defaults

A `.lean()` query returns the raw BSON. Documents written before a field was added come
back `undefined` rather than taking the schema default. Hydrated (non-lean) queries do
apply defaults. So `order.currency` can be `"INR"` or `undefined` for the *same document*
depending on how it was fetched. Guard reads with `|| "INR"`, and be aware that adding a
schema field does not retroactively fix `.lean()` call sites.

### 3. Update operations skip validators

`findByIdAndUpdate` / `updateOne` do **not** run validators by default. An invalid enum
value persists happily, and then a later `doc.save()` on that document throws a
`ValidationError` far from the cause. This happened with `orderStatus:
"payment_captured_fulfillment_pending"`, which is not in the enum — it also hid the admin
"Push to Shiprocket" button, since that's gated on `pending`/`processing`.

Prefer setting the indexed `needsManualReview` + `reviewReason` flags over inventing
status values. `server.js` already alerts on `needsManualReview` at startup.

Related: `statusHistory.changedBy` is an `ObjectId` ref. Writing the string `"system"`
fails to cast and rejects the whole update — use `changedBy: null` and record system
origin via the `source` field.

### 4. Money is not rupees

Order amounts (`totalAmount`, `originalAmount`, `shippingCost`, `discountAmount`,
`refundAmount`, `priceAtPurchase`) are denominated in `order.currency`, not INR. A
hardcoded `₹` or an `en-IN` format string is a bug on every foreign order. Razorpay
amounts on the wire are **minor units** — use the helpers in `backend/utils/currencies.js`
rather than `* 100` / `/ 100`, which mis-scale JPY (0 decimals) and KWD (3 decimals).

## Before changing anything, know where the gates are

Order flow has several independent enforcement points, and changing one without the
others produces a fix that appears to work in isolation and does nothing in production.
This bit us: international Shiprocket push was fixed inside `pushOrderToShiprocket`, but
`events/orderEvents.js` had `if (isDomestic)` wrapped around the call, so real orders
never reached the fixed code. A direct function-call test passed; a real order would not have.

When gating behaviour, enumerate every layer:

- `events/orderEvents.js` — routes post-payment side effects (fulfilment, email, WhatsApp)
- `tracker/controller.js → createOrder` — the COD path's validation
- `payment/controller.js → getOrderQuote` / `initRazorpayOrder` — the online path's validation, **twice** (a signed quote pins the country but not the store settings, and it stays valid 30 minutes)
- the service function itself — a defensive last line

Trace the call path to the real entry point before concluding a gate works.

## Safety rules for live side effects

Much of this code moves money or books couriers. Some calls cannot be undone by editing
code afterwards.

**Ask the user before**: creating a Shiprocket order or assigning an AWB, issuing or
refunding a Razorpay payment, generating a payment link, or anything that sends email or
WhatsApp to a real customer. `orderEvents.emit("order_placed")` fans out to Resend and a
BullMQ WhatsApp queue — treat any code path that emits it as customer-visible.

**Read-only calls are fine** without asking: Shiprocket auth, serviceability, order
lookups; Razorpay fetches; any `find`. When verifying a change, prefer instrumenting or
mocking `fetch` so nothing leaves the process — `references/verification.md` shows how.

**Seeded test data must be tagged and removable.** `backend/scripts/seed_test_order.js`
marks everything it creates and supports `--cleanup`; extend that rather than inventing
new untagged fixtures.

**Prove signature gates, don't bypass them.** `backend/scripts/send_test_webhook.js` signs
payloads with the real `RAZORPAY_WEBHOOK_SECRET` so the handler's own verification runs.
Sending a `--bad-signature` and confirming a 400 is worth doing once — it distinguishes
"accepted because valid" from "accepted because unchecked".

## Two existing scripts worth reaching for

Both live in `backend/scripts/` and print their own next-step commands:

```bash
# Create a test order in a specific state (draft | paid | delivered | stale-lock)
node scripts/seed_test_order.js --state draft --country "United States of America" --currency USD
node scripts/seed_test_order.js --cleanup

# Fire a genuinely HMAC-signed webhook at a running server
node scripts/send_test_webhook.js --event payment.failed --order order_XXX --amount 40.24 --currency USD
node scripts/send_test_webhook.js --event payment.captured --order order_XXX --dry-run
```

`--state stale-lock` builds the one state that cannot be produced by hand: an order whose
atomic payment claim fired but whose transaction then died. It's the input for the
webhook's crash-recovery branch.

## Testing gotchas that waste time

Three caching layers will serve stale data and look like a broken fix:

- `settings/cache.js` caches `getSettings()` for **60s**. The admin UI clears it on save;
  writing to Mongo directly does not — call `clearSettingsCache()` in scripts.
- `GET /api/v1/settings` sends `Cache-Control: max-age=300`, so browsers hold settings for
  **5 minutes**. Test with devtools cache disabled.
- Rate limits ([`app.js`](../../../backend/app.js)): quote 60/min, init and verify 20/min.
  Repeated manual checkout attempts trip these and resemble a bug.

Country detection comes from the Cloudflare `cf-ipcountry` header and falls back to `IN`.
You can forge it with curl, but **only against the origin** — Cloudflare overwrites the
header on proxied requests.

## A naming trap worth internalising

The backend validates shipping country against `StoreSettings.supportedCountries`, which
holds **full names** (`"United States of America"`). Sending a bare ISO code (`"US"`) is
rejected with *"We do not currently ship to US"*. The frontend has
`getCountryNameFromIso()` in `frontend/src/utils/countries.ts` for this conversion. When
touching any country value, check which representation the receiving code expects — a
mismatch here silently degraded the cart to domestic shipping rates for every
international shopper.
