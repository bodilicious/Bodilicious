/**
 * send_test_webhook.js — post a correctly HMAC-signed Razorpay webhook at your server.
 *
 * The webhook branches (payment.failed, refund.processed, stale-lock recovery) are the
 * hardest parts of the payment flow to reach by hand — they need a real failed card or a
 * real refund settling. This reproduces them in a second, with a signature the server
 * genuinely verifies, so you are testing the real code path and not a bypass.
 *
 * Signing matches payment/controller.js → razorpayWebhook:
 *   HMAC-SHA256(rawRequestBody, RAZORPAY_WEBHOOK_SECRET)
 * The signature is computed over the exact bytes sent, so the JSON string is built once
 * and reused for both the digest and the request body.
 *
 * Usage:
 *   node scripts/send_test_webhook.js --event payment.captured --order order_XXX --amount 74.85 --currency USD
 *   node scripts/send_test_webhook.js --event payment.failed   --order order_XXX --amount 74.85 --currency USD
 *   node scripts/send_test_webhook.js --event refund.processed --payment pay_XXX  --amount 74.85 --currency USD
 *   node scripts/send_test_webhook.js --event payment.captured --order order_XXX --bad-signature
 *
 * Options:
 *   --url             target (default http://localhost:5000/api/v1/payment/webhook, or
 *                     BACKEND_URL/PORT from .env)
 *   --amount          MAJOR units, as a human writes it: 74.85 not 7485. Converted to
 *                     minor units per currency, the same way Razorpay sends them.
 *   --bad-signature   send a deliberately wrong signature; expect HTTP 400. Worth running
 *                     once to prove the endpoint is actually verifying and not just
 *                     accepting anything you post at it.
 *   --dry-run         print the payload and signature without sending.
 */

import crypto from "crypto";
import dotenv from "dotenv";
import { toRazorpayMinorUnits } from "../utils/currencies.js";

dotenv.config({ path: ".env" });

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const EVENT = flag("event", "payment.captured");
const CURRENCY = (flag("currency", "INR")).toUpperCase();
const AMOUNT_MAJOR = Number(flag("amount", "1499"));
const ORDER_ID = flag("order", null);
const PAYMENT_ID = flag("payment", `pay_QA${Date.now().toString(36).toUpperCase()}`);
const REFUND_ID = flag("refund", `rfnd_QA${Date.now().toString(36).toUpperCase()}`);

const DEFAULT_URL = `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/api/v1/payment/webhook`;
const URL = flag("url", DEFAULT_URL);

const VALID_EVENTS = ["payment.captured", "payment.failed", "refund.processed"];
if (!VALID_EVENTS.includes(EVENT)) {
  console.error(`Unknown --event "${EVENT}". Expected one of: ${VALID_EVENTS.join(", ")}`);
  process.exit(1);
}
if (EVENT !== "refund.processed" && !ORDER_ID) {
  console.error(`--order is required for ${EVENT} (the razorpayOrderId the handler looks the order up by).`);
  console.error(`Get one from: node scripts/seed_test_order.js --state draft`);
  process.exit(1);
}

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!secret) {
  console.error("RAZORPAY_WEBHOOK_SECRET is not set in .env — the server would reject this anyway.");
  process.exit(1);
}

// Razorpay always sends minor units; mis-scaling here is exactly the bug class we fixed.
const amountMinor = toRazorpayMinorUnits(AMOUNT_MAJOR, CURRENCY);
const now = Math.floor(Date.now() / 1000);

const paymentEntity = {
  id: PAYMENT_ID,
  entity: "payment",
  amount: amountMinor,
  currency: CURRENCY,
  status: EVENT === "payment.failed" ? "failed" : "captured",
  order_id: ORDER_ID,
  method: "card",
  captured: EVENT !== "payment.failed",
  email: "qa@example.com",
  contact: "+16175550100",
  notes: {},
  created_at: now,
  ...(EVENT === "payment.failed" && {
    error_code: "BAD_REQUEST_ERROR",
    error_description: "Payment failed (simulated by send_test_webhook.js)",
    error_source: "customer",
    error_reason: "payment_failed",
  }),
};

let payload;
if (EVENT === "refund.processed") {
  payload = {
    refund: {
      entity: {
        id: REFUND_ID,
        entity: "refund",
        amount: amountMinor,
        currency: CURRENCY,
        payment_id: PAYMENT_ID,
        status: "processed",
        speed_processed: "normal",
        notes: {},
        created_at: now,
      },
    },
    payment: { entity: paymentEntity },
  };
} else {
  payload = { payment: { entity: paymentEntity } };
}

const body = {
  entity: "event",
  account_id: "acc_QATEST",
  event: EVENT,
  contains: EVENT === "refund.processed" ? ["refund", "payment"] : ["payment"],
  payload,
  created_at: now,
};

// Sign the exact bytes that go on the wire.
const rawBody = JSON.stringify(body);
const realSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
const signature = has("bad-signature") ? "0".repeat(64) : realSignature;

console.log(`event      ${EVENT}`);
console.log(`target     ${URL}`);
if (ORDER_ID) console.log(`order      ${ORDER_ID}`);
console.log(`payment    ${PAYMENT_ID}`);
if (EVENT === "refund.processed") console.log(`refund     ${REFUND_ID}`);
console.log(`amount     ${CURRENCY} ${AMOUNT_MAJOR}  ->  ${amountMinor} minor units`);
console.log(`signature  ${signature.slice(0, 16)}…${has("bad-signature") ? "  (deliberately invalid)" : ""}`);

if (has("dry-run")) {
  console.log(`\n${rawBody}`);
  process.exit(0);
}

const send = async () => {
  let res;
  try {
    res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: rawBody,
    });
  } catch (err) {
    console.error(`\nCould not reach ${URL} — is the server running?`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  const text = await res.text().catch(() => "");
  console.log(`\nHTTP ${res.status}`);
  console.log(text);

  // Interpret the response so the result is unambiguous.
  if (has("bad-signature")) {
    console.log(res.status === 400
      ? "\nCorrect — an invalid signature was rejected."
      : `\nPROBLEM — expected HTTP 400 for a bad signature, got ${res.status}. The endpoint may not be verifying.`);
  } else if (res.status === 409) {
    console.log("\n409 = the order is actively being processed (claim <2 min old). Razorpay would retry.");
    console.log("To exercise the crash-recovery branch instead: seed with --state stale-lock.");
  } else if (res.status !== 200) {
    console.log(`\nExpected 200. Check the server log for the reason.`);
  } else {
    const hints = {
      "payment.captured": "Order should now be paid, invoiced and in UserProfile.orders. International orders should also be flagged needsManualReview with NO Shiprocket push.",
      "payment.failed": "Order should be paymentStatus 'failed' with isStockRestored true and product stock returned. Re-run this command — stock must NOT be restored twice.",
      "refund.processed": "Order should be paymentStatus 'refunded', auto-cancelled, and stock restored once.",
    };
    console.log(`\n${hints[EVENT]}`);
  }
};

send();
