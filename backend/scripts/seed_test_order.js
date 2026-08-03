/**
 * seed_test_order.js — create a test order in a specific state, for manual QA.
 *
 * Saves you from paying through checkout every time you want to exercise the
 * international fulfilment, return, webhook or reconciliation paths.
 *
 * Usage:
 *   node scripts/seed_test_order.js --state draft --country "United States of America" --currency USD
 *   node scripts/seed_test_order.js --state paid --country India --currency INR
 *   node scripts/seed_test_order.js --state delivered --country "United States of America"
 *   node scripts/seed_test_order.js --state stale-lock
 *   node scripts/seed_test_order.js --cleanup
 *
 * States:
 *   draft       paymentStatus "pending" + razorpayOrderId set. The state a real order
 *               is in between /razorpay/init and payment. Feed the razorpayOrderId to
 *               send_test_webhook.js, or let the reconcile endpoint find it.
 *   paid        fully processed, invoice generated, in UserProfile.orders. Use for
 *               display / payment-link / admin checks.
 *   delivered   paid + delivered, so a return can be requested against it.
 *   stale-lock  paymentStatus "paid" but invoiceGenerated false, claimed >2 min ago and
 *               NOT in UserProfile.orders — i.e. the claim fired and the transaction
 *               died. Reproduces the crash-recovery branch of the webhook, which is
 *               effectively impossible to trigger by hand.
 *
 * Everything it creates is tagged so --cleanup can remove it without touching real data.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../tracker/models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";

dotenv.config({ path: ".env" });

// Tags used to find and remove everything this script creates.
const TEST_PID = "qa-test-serum";
const TEST_UID = "QA_TEST_USER";
const TEST_MARKER = "[qa-seed]";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const STATE = flag("state", "draft");
const COUNTRY = flag("country", "United States of America");
const CURRENCY = (flag("currency") || (COUNTRY.toLowerCase() === "india" ? "INR" : "USD")).toUpperCase();
const QTY = Number(flag("qty", "1"));

const isIndia = ["india", "in", "bharat", "ind"].includes(COUNTRY.toLowerCase().trim());

// Roughly ₹87/USD — only needs to be plausible, not live.
const RATE = CURRENCY === "INR" ? 1 : Number(flag("rate", "0.0115"));

const cleanup = async () => {
  const orders = await Order.deleteMany({ adminNote: new RegExp(TEST_MARKER.replace(/[[\]]/g, "\\$&")) });
  const users = await UserProfile.deleteMany({ firebaseUID: new RegExp(`^${TEST_UID}`) });
  const products = await Product.deleteMany({ pid: TEST_PID });
  console.log(`Removed ${orders.deletedCount} order(s), ${users.deletedCount} user(s), ${products.deletedCount} product(s).`);
};

const ensureProduct = async () => {
  let product = await Product.findOne({ pid: TEST_PID });
  if (product) {
    // Top the stock back up so repeated runs don't run dry.
    if (product.stock < 100) await Product.updateOne({ _id: product._id }, { $set: { stock: 100 } });
    return product;
  }
  [product] = await Product.create([{
    pid: TEST_PID,
    name: "QA Test Serum",
    slug: TEST_PID,
    images: ["https://placehold.co/600x600/png"],
    description: "Seeded by scripts/seed_test_order.js for manual QA. Safe to delete.",
    category: "skin",
    price: 1499,          // INR — catalogue prices are always INR
    stock: 100,
    product_weight_g: 120,
  }]);
  console.log(`Created test product ${TEST_PID} (₹${product.price}, stock ${product.stock})`);
  return product;
};

const ensureUser = async () => {
  const uid = `${TEST_UID}_${isIndia ? "IN" : "INTL"}`;
  let user = await UserProfile.findOne({ firebaseUID: uid });
  if (!user) {
    [user] = await UserProfile.create([{
      firebaseUID: uid,
      name: isIndia ? "QA Domestic" : "QA International",
      email: `${uid.toLowerCase()}@example.com`,
      phone: isIndia ? "9894451947" : "+16175550100",
    }]);
    console.log(`Created test user ${user.email}`);
  }
  return user;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  console.log(`Connected to ${mongoose.connection.name}\n`);

  if (has("cleanup")) {
    await cleanup();
    await mongoose.connection.close();
    return;
  }

  if (!["draft", "paid", "delivered", "stale-lock"].includes(STATE)) {
    console.error(`Unknown --state "${STATE}". Expected: draft | paid | delivered | stale-lock`);
    process.exit(1);
  }

  const product = await ensureProduct();
  const user = await ensureUser();

  // Price maths mirrors getOrderQuote: compute in INR, then convert once.
  const subtotalINR = product.price * QTY;
  const shippingINR = isIndia
    ? (subtotalINR >= 999 ? 0 : 99)
    : (subtotalINR >= 10000 ? 0 : 2000);
  const round = (v) => Number((v * RATE).toFixed(CURRENCY === "INR" ? 0 : 2));

  const subtotal = round(subtotalINR);
  const shippingCost = round(shippingINR);
  const totalAmount = round(subtotalINR + shippingINR);

  const paid = STATE === "paid" || STATE === "delivered";
  const razorpayOrderId = `order_QA${Date.now().toString(36).toUpperCase()}`;
  const razorpayPaymentId = paid || STATE === "stale-lock" ? `pay_QA${Date.now().toString(36).toUpperCase()}` : null;

  const [order] = await Order.create([{
    user: user._id,
    items: [{ product: product._id, quantity: QTY, priceAtPurchase: product.price }],
    totalAmount,
    originalAmount: subtotal + shippingCost,
    shippingCost,
    discountAmount: 0,
    currency: CURRENCY,
    exchangeRate: RATE,
    paymentMethod: "razorpay",
    paymentStatus: STATE === "draft" ? "pending" : "paid",
    orderStatus: STATE === "delivered" ? "delivered" : (paid ? "processing" : "pending"),
    razorpayOrderId,
    razorpayPaymentId,
    invoiceGenerated: paid,
    invoiceNumber: paid ? `INV-QA-${Date.now().toString(36).toUpperCase()}` : null,
    // stale-lock: claimed >2 min ago so the webhook treats it as a crashed transaction
    paymentClaimedAt: STATE === "stale-lock" ? new Date(Date.now() - 5 * 60 * 1000) : (paid ? new Date() : null),
    deliveredAt: STATE === "delivered" ? new Date() : null,
    adminNote: `${TEST_MARKER} seeded ${new Date().toISOString()} state=${STATE}`,
    shippingDetails: isIndia
      ? { name: "QA Domestic", phone: "9894451947", address: "12 Test Street", city: "Chennai",
          state: "Tamil Nadu", pincode: "600081", country: "India", email: user.email }
      : { name: "QA International", phone: "+16175550100", address: "12 Beacon St", city: "Boston",
          state: "MA", pincode: "02108", country: COUNTRY, email: user.email },
  }]);

  // Only a fully-processed order belongs in UserProfile.orders. stale-lock must NOT be
  // there — that mismatch is exactly what the webhook uses to detect a dead transaction.
  if (paid) {
    await UserProfile.updateOne({ _id: user._id }, { $addToSet: { orders: order._id } });
  }

  const short = order._id.toString().slice(-6).toUpperCase();
  console.log(`Created ${STATE} order #${short}`);
  console.log(`  _id             ${order._id}`);
  console.log(`  razorpayOrderId ${razorpayOrderId}`);
  if (razorpayPaymentId) console.log(`  razorpayPaymentId ${razorpayPaymentId}`);
  console.log(`  destination     ${COUNTRY} (${isIndia ? "domestic" : "international"})`);
  console.log(`  amount          ${CURRENCY} ${totalAmount}  (subtotal ${subtotal} + shipping ${shippingCost})`);
  console.log(`  user            ${user.email}`);

  console.log("\nNext:");
  if (STATE === "draft") {
    console.log(`  node scripts/send_test_webhook.js --event payment.captured --order ${razorpayOrderId} --amount ${totalAmount} --currency ${CURRENCY}`);
    console.log(`  node scripts/send_test_webhook.js --event payment.failed   --order ${razorpayOrderId} --amount ${totalAmount} --currency ${CURRENCY}`);
    console.log(`  ...or POST /api/v1/payment/admin/reconcile (needs a real captured payment at Razorpay to recover).`);
  }
  if (STATE === "stale-lock") {
    console.log(`  node scripts/send_test_webhook.js --event payment.captured --order ${razorpayOrderId} --amount ${totalAmount} --currency ${CURRENCY}`);
    console.log(`  Expect: "Force-releasing STALE 'paid' lock" in the server log, then the order completes.`);
  }
  if (STATE === "delivered") {
    console.log(`  Request a return as this customer, then confirm Shiprocket got NO reverse pickup`);
    console.log(`  and the order has needsManualReview: true.`);
  }
  if (STATE === "paid") {
    console.log(`  Open the order in admin: amounts must render in ${CURRENCY}, and a payment link`);
    console.log(`  generated for it must bill ${CURRENCY} ${totalAmount} — not ₹${totalAmount}.`);
  }
  console.log(`\n  Clean up with: node scripts/seed_test_order.js --cleanup`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error("Seed failed:", err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
