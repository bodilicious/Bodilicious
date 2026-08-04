# Admin views and Mongo query traps

The admin panel reads orders through several separate queries — dashboard counts, the
orders list, the CSV export, the abandoned-checkout view. They must agree on what they
include, because a disagreement doesn't error: an order simply stops appearing, and
nobody notices until someone goes looking for it.

## `$ne` matches documents where the field is absent

This is the trap most likely to bite in this codebase, because it interacts with
Mongoose's silent field-dropping (see the SKILL.md trap list).

`{ source: { $ne: "admin_draft" } }` reads like "everything except admin drafts". What it
actually means is "every document whose `source` is not the string `admin_draft`" — and a
document with **no** `source` field satisfies that. If nothing ever writes the field, the
clause matches 100% of documents and silently does nothing.

That's exactly what happened: `Order.create({ source: "admin_draft" })` was dropped
because the schema had no such path, so the filter intended to protect admin drafts
excluded nothing, and admin-created drafts were being classified as abandoned customer
checkouts — disappearing from the orders list and turning up in the wrong section.

When writing an exclusion clause, confirm the field is (a) in the schema and (b) actually
written on the documents you care about. A one-line count settles it:

```js
await Order.countDocuments({ source: { $ne: "admin_draft" } })   // === total? clause is inert
```

If a field is genuinely optional and absence should mean "not excluded", say so explicitly
with `$nin: [...]` plus an `$exists` check, or give the schema a default so absence never
occurs. Defaults are the cleaner fix — they make the data uniform instead of pushing the
special case into every query.

## Define shared filters once, as a function

Four separate places needed the same "is this an abandoned checkout" predicate. They were
four copy-pasted object literals. That's fragile in a specific way: the abandoned view is
supposed to show *exactly* what the other views exclude, so an edit to one copy makes
orders vanish from both places simultaneously — invisible in the list AND absent from the
abandoned section.

Extract one definition and use it both ways:

```js
const abandonedCheckoutFilter = () => ({ /* … */ });

Order.find(abandonedCheckoutFilter())              // the dedicated view
{ $nor: [abandonedCheckoutFilter()] }              // everywhere it should be hidden
```

**Make it a function, not a module-level constant.** Any clause containing a relative time
(`createdAt: { $lt: new Date(Date.now() - WINDOW) }`) freezes at module load if it's a
constant — the cutoff stops moving and quietly widens for as long as the process stays up.
On a long-lived server that's a slow drift nobody attributes to the right cause.

## Never hide orders that have money attached

Filtering "noise" out of the admin list is reasonable until the filter catches something
that needs a human.

When a payment is captured but order creation fails, `processPaidOrder` reverts its atomic
claim — leaving `paymentStatus` back at `pending`/`failed` with `orderStatus: "pending"`
and `needsManualReview: true`. Structurally that is **identical** to an abandoned
checkout. Semantically it is the opposite: the customer has been charged and the order
doesn't exist.

Any query that hides unpaid pending orders must therefore carry `needsManualReview:
{ $ne: true }`. The flag is indexed and already alerted on at startup in `server.js` —
treat it as the marker for "this one is not noise".

The same reasoning applies to anything new that hides orders in bulk: ask what the filter
would do to an order where money moved but the record is incomplete.

## Aggregations and currency

Order amounts are denominated in `order.currency`, so `{ $sum: "$totalAmount" }` across
mixed currencies produces a meaningless number — it adds dollars to rupees.

The existing analytics guard with `$ifNull: ["$currency", "INR"]` and total only the INR
rows, counting foreign orders separately. Preserve that shape in new aggregations. The
`$ifNull` matters because documents written before the `currency` path existed have no
value, and `.lean()`/aggregation pipelines don't apply schema defaults.

## Check the whole query builder, not just your edit

These handlers build queries incrementally — a base object, then `if (search)`, `if
(orderStatus)`, `if (startDate)` and so on. A later assignment can overwrite an earlier
key entirely (`query.orderStatus = req.query.orderStatus` silently discards a base
`orderStatus: { $ne: "abandoned" }`).

When adding a clause, read to the end of the function and check nothing reassigns the same
top-level key. Prefer `$and`/`$nor` composition over reassignment when a key might be
touched twice.
