# Shiprocket fulfilment

Shiprocket handles both domestic and international lanes, but the integration was written
domestic-first and several helpers actively corrupt international data. The distinction
runs through everything below.

Use the exported `isIndiaOrder(order)` from `backend/tracker/shiprocketservice.js` rather
than re-implementing the country check — the accepted domestic spellings are
`india`, `in`, `bharat`, `ind`, and a missing country means domestic (the schema default).

## The address-mangling trap

The domestic payload builder coerces values to satisfy Indian courier validation:

```js
finalPincode = safePincode.length === 6 ? safePincode : "110001";   // Delhi
finalPhone   = safePhone.length >= 10 ? safePhone.slice(-10) : "9999999999";
```

For a domestic order this is a reasonable last resort. For an international one it is
destructive: `"02108"` is a valid Boston ZIP, and coercing it to `"110001"` produces a
payload whose country says United States and whose postcode says Delhi. Left unguarded,
this books a real courier against a fake address.

The same rewrite exists in `createShiprocketReturn`, which additionally hardcodes
`pickup_country: "India"` — an international return would schedule a reverse pickup from
a Delhi address the customer has never visited.

**When touching either payload builder, keep the domestic and international branches
visibly distinct.** Domestic sanitises; international must pass the address through
untouched, including the `+country-code` phone and alphanumeric postcodes (UK, Canada).

## What is actually true about the API

Verified against the live account rather than inferred:

- **Order creation uses one endpoint for both lanes**: `POST /v1/external/orders/create/adhoc`.
  There is no separate international create path. Earlier assumptions to the contrary were wrong.
- **Serviceability does differ.** The domestic route rejects a US postcode outright
  (`{"message":"Invalid Delivery Pincode","status":400}`), which is precisely why the
  `110001` coercion was introduced. The international route is
  `GET /v1/external/courier/international/serviceability?pickup_postcode=…&delivery_country=US&weight=…`.
- **Shiprocket classifies the order itself** from the address. A correctly-built payload
  comes back with `is_international: 1`, and `GET /v1/external/orders?is_international=1`
  lists them. The dashboard has a separate Domestic/International dropdown — an
  international order will never appear under Domestic, which is a common false alarm.
- **No extra customs fields are required to create the order.** It succeeds with the same
  `order_items` shape as domestic. Customs correctness is still a real-world concern (see below).

## `shipping_is_billing` is not honoured for international orders

The payload historically sent only `billing_*` fields plus `shipping_is_billing: true`,
trusting Shiprocket to copy one to the other. It does that domestically. It does **not**
do it for international orders — the created order came back with:

```json
"errors": {
  "shipping_phone":   "Customer phone is empty",
  "shipping_pincode": "Delivery pincode is empty"
}
```

The order exists, shows `NEW`, and looks fine in a list view, but it is **unshippable** —
the dashboard surfaces it as *"Action needed: some orders are missing required
information"*. That banner is the symptom to recognise; the `errors` object on
`GET /v1/external/orders/show/{id}` is where the actual reason lives.

The fix is to send the full `shipping_*` block explicitly rather than relying on the copy.
It costs nothing domestically (identical values) and is what makes an international order
dispatchable. If you ever see an order created successfully but flagged in the dashboard,
fetch it by id and read `errors` before guessing.

## The gate

International auto-push is off unless `SHIPROCKET_INTERNATIONAL_ENABLED=true`. It fails
closed deliberately: if the payload is wrong, the failure mode is a physical parcel going
to a real wrong address, so the safe default is to flag the order for manual fulfilment.

The gate exists in **two** places and both matter:

1. `events/orderEvents.js` decides whether to call the push at all.
2. `pushOrderToShiprocket` re-checks as a last line of defence.

Changing only the service function produces a fix that passes a direct-call test and does
nothing for real orders. Verify against the routing in `orderEvents.js`, not just the
function.

## AWB assignment is deliberately skipped

After creating the order the code stores `shiprocketOrderId` and `shipmentId` but does
**not** request an AWB, so the order stays in Shiprocket's "New" tab for manual courier
selection. This is intentional — don't "fix" it by auto-assigning. It also makes test
orders harmless: no courier is booked and nothing is charged until someone picks one.

## Status sync

The Shiprocket webhook maps carrier statuses onto `orderStatus` and only ever moves
**forward** — a `shipped` order won't be downgraded to `processing` by a late event.
Preserve that when adding statuses. History accumulates in `statusHistory[]`; remember
`changedBy` is an ObjectId ref, so system-origin entries use `changedBy: null` plus
`source: "system"`.

## COD

Domestic COD is normal. **International COD has no collection mechanism** — no
international courier, Shiprocket's SRX lanes included, collects cash abroad. It's gated
behind `StoreSettings.codInternationalEnabled` (default off) and every such order is
flagged `needsManualReview` so it can't quietly reach dispatch unpaid.

Two things to keep right if you touch this:

- **Declare the real payment method** in the Shiprocket payload. Forcing `"Prepaid"` on an
  international COD order tells Shiprocket the parcel is already paid for, and ships goods
  with nothing collected. If a lane can't support COD, a loud rejection is the better outcome.
- **Shipping cost must use the international rate card.** `createOrder` historically
  computed domestic rates only, which was harmless while COD was India-only but charges
  ₹99 for a ₹2000 shipment the moment international COD is enabled. Mirror `getOrderQuote`.

## Real-world correctness the API won't enforce

Creation succeeding is not the same as the parcel clearing customs:

- **HSN codes.** Every item falls back to `33049910` because no product sets `hsn_code`.
  Shiprocket accepts it; destination customs authorities are the ones who check.
- **Duties.** Of the couriers available on the US lane, only SRX DDP is delivered-duty-paid.
  On the others the customer is billed on arrival — which must match the customs
  disclosure shown at checkout.
- **Placeholder data.** Shiprocket flags orders with "Info missing" when contact details
  look synthetic. Seeded test orders will trip this; a real address is needed to validate
  the lane end to end.
