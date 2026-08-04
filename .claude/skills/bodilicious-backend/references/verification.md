# Verification scripts

How to check a claim about this codebase against the real database or a live third-party
API, without side effects and without wasting a turn on avoidable errors.

The value of these scripts is that they replace inference with evidence. "I added the
field, so it persists" is a guess; a script that constructs the document and prints the
value is proof — and it takes about ninety seconds.

## Where to put the script

**Write it into `backend/`, not the scratchpad and not `/tmp`.** Node resolves bare
imports (`mongoose`, `dotenv`) against the nearest `node_modules`, so a script anywhere
else dies with `ERR_MODULE_NOT_FOUND` before running a single line. Use a leading
underscore so it's obviously temporary, and delete it in the same command:

```bash
cd backend && cat > _check.mjs <<'EOF'
...
EOF
timeout 120 node _check.mjs 2>&1 | grep -vE "dotenv|MONGOOSE|trace-warnings|Warning:"; rm -f _check.mjs
```

The `grep -vE` filter matters more than it looks — dotenv banners, the duplicate-index
warning on `razorpayOrderId`, and Node deprecation notices bury real output otherwise.

## The connection preamble

```js
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
```

`DB_NAME` is separate from the URI here (`myappdb`) — omitting it connects to the wrong
database and everything looks empty.

## Two things that will hang or crash the script

**Register models before `.populate()`.** Importing `Order` alone and then populating
`items.product` throws `MissingSchemaError: Schema hasn't been registered for model
"Product"`. The import is what registers it:

```js
const Order = (await import("./tracker/models.js")).default;
await import("./products/models.js");   // registers Product for populate
```

**End with `process.exit(0)`.** Importing anything that reaches `whatsapp/queue.js` opens
Redis/BullMQ handles that keep the event loop alive forever — the script completes its
work, prints nothing further, and sits until the command times out. Closing the mongoose
connection is not enough.

If you need the mongoose instance without a bare import, `Model.base` gives it to you:

```js
const mongoose = Order.base;   // works from any registered model
```

## Instrumenting `fetch` instead of mocking blindly

To prove a guard prevents an outbound call, record every call and assert on the count.
This is stronger than reading the code, and it's safe:

```js
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("shiprocket")) calls.push({ url: u, body: opts?.body });
  return realFetch(url, opts);          // still real — read-only probes are fine
};
```

To guarantee nothing leaves the process, return a canned response instead of delegating:

```js
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("auth/login")) return { ok: true, json: async () => ({ token: "fake" }) };
  calls.push({ url: String(url), body: JSON.parse(opts.body) });
  return { ok: true, json: async () => ({ shipment_id: 0, order_id: "MOCK" }), text: async () => "" };
};
Order.findByIdAndUpdate = async () => ({});   // don't write mock ids into the DB
```

Distinguish **auth** calls from **create** calls when counting. A guard that blocks
shipment creation still authenticates first, so `calls.length === 0` is the wrong
assertion — filter for `orders/create`.

## Checking whether a field actually persists

The highest-value three lines in this file. Mongoose reports no error when it drops a
field, so construct the document and read the value back:

```js
const doc = new Order({ /* required fields */, currency: "USD", exchangeRate: 0.012 });
console.log("currency:", doc.currency);          // undefined => not in the schema
console.log("validates:", !doc.validateSync());
```

`validateSync()` also confirms enum and cast rules without touching the database — use it
to prove a value is invalid (`changedBy: "system"` fails to cast) rather than asserting it.

## Structuring assertions

A tiny helper makes results scannable and gives a non-zero exit on failure:

```js
let pass = 0, fail = 0;
const check = (name, cond, detail = "") =>
  cond ? (pass++, console.log("  PASS " + name))
       : (fail++, console.log("  FAIL " + name + " " + detail));
// ...
console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
```

Name assertions after the behaviour, not the mechanism: *"international COD blocked"*
beats *"serverAllows returns false"*. Where it clarifies things, assert the old broken
behaviour too — *"the old flat floor was ~87x too generous in USD"* documents why the
change matters and fails loudly if someone reverts it.

**Treat a failing assertion as possibly correct.** When a check written against a fresh
change fails, the change is the more likely culprit. One such failure here revealed that a
forced reconciliation run re-armed its own 4-hour skip window — a real bug found by
trusting the test over the code.

## Restoring state

Scripts that flip settings must put them back, and must verify the restore. Assigning a
previously-`undefined` value via `$set` is a silent no-op, because Mongoose strips
`undefined` — so "restore the original" leaves the flag on:

```js
const original = await StoreSettings.findOne().lean();
// ... mutate and test ...
await StoreSettings.updateOne({ _id: original._id }, { $set: { codInternationalEnabled: false } });
clearSettingsCache();
console.log("restored:", (await getSettings()).codInternationalEnabled);   // always print it
```

Call `clearSettingsCache()` after any direct write, or the 60-second in-memory cache will
serve the old value to the very code you're testing.
