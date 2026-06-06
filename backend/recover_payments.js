/**
 * ============================================================
 *  PAYMENT RECOVERY SCRIPT
 * ============================================================
 *  Run once on your production server to recover orders that
 *  were charged by Razorpay but never saved to the database
 *  due to the Zod validation bug on POST /api/payment/verify.
 *
 *  What it does:
 *   1. Fetches ALL "captured" payments from Razorpay (paid = captured)
 *   2. Skips any that already have a matching order in MongoDB
 *   3. For each orphaned payment:
 *       a. Reads userId from razorpay order notes
 *       b. Loads the user's current cart (never cleared = still there)
 *       c. Uses the user's default saved address for shipping
 *       d. Recalculates amounts from live product prices
 *       e. Creates the order, deducts stock, links to user profile,
 *          clears the cart — exactly what verifyPayment would have done
 *   4. Flags each recovered order with adminNote for manual review
 *
 *  Usage (on Render shell / SSH into server):
 *    node recover_payments.js
 *
 *  Safe to run multiple times — duplicate-payment guard skips processed ones.
 * ============================================================
 */

import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import Order from "./tracker/models.js";
import UserProfile from "./profile/models.js";
import Product from "./products/models.js";

// Try .env.production first, fall back to .env
import { existsSync } from "fs";
const envFile = existsSync(".env.production") ? ".env.production" : ".env";
console.log(`📄 Loading env from: ${envFile}`);
dotenv.config({ path: envFile });

// ─── Razorpay Client ────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Helper: verify signature ────────────────────────────────────────────────
function isSignatureValid(orderId, paymentId, signature) {
  try {
    const body = orderId + "|" + paymentId;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");
    return expected === signature;
  } catch {
    return false;
  }
}

// ─── Helper: fetch ALL pages from Razorpay (max 100 per page) ────────────────
async function fetchAllCapturedPayments() {
  const allPayments = [];
  let skip = 0;
  const count = 100;

  while (true) {
    const page = await razorpay.payments.all({
      count,
      skip,
    });

    const items = page.items || [];
    // Only keep captured (= successfully charged) payments
    const captured = items.filter((p) => p.status === "captured");
    allPayments.push(...captured);

    // Razorpay returns fewer than `count` on the last page
    if (items.length < count) break;
    skip += count;
  }

  return allPayments;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 3, 
    dbName: process.env.DB_NAME,
  });
  console.log("✅ Connected.\n");

  // 1. Pull captured payments from Razorpay
  console.log("📡 Fetching captured payments from Razorpay…");
  const capturedPayments = await fetchAllCapturedPayments();
  console.log(`   Found ${capturedPayments.length} captured payment(s).\n`);

  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  for (const payment of capturedPayments) {
    const paymentId = payment.id;
    const razorpayOrderId = payment.order_id;

    console.log(`─── Processing payment ${paymentId} (order: ${razorpayOrderId})`);

    // 2. Skip if already in DB (idempotency)
    const exists = await Order.findOne({
      $or: [
        { razorpayPaymentId: paymentId },
        { razorpayOrderId: razorpayOrderId },
      ],
    }).lean();

    if (exists) {
      console.log(`   ✔ Already has DB order ${exists._id}. Skipping.\n`);
      skipped++;
      continue;
    }

    // 3. Get the Razorpay order to read notes (has userId + itemCount)
    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
    } catch (err) {
      console.error(`   ❌ Could not fetch Razorpay order: ${err.message}\n`);
      failed++;
      continue;
    }

    const userId = rzpOrder.notes?.userId;
    if (!userId) {
      console.error(`   ❌ No userId in Razorpay order notes. Cannot recover.\n`);
      failed++;
      continue;
    }

    console.log(`   👤 User ID from notes: ${userId}`);

    // 4. Load user profile (cart + addresses)
    const userProfile = await UserProfile.findById(userId).populate("cart.product");
    if (!userProfile) {
      console.error(`   ❌ UserProfile not found for userId ${userId}.\n`);
      failed++;
      continue;
    }

    // 5. Check cart — it should still be populated (was never cleared due to the bug)
    const cartItems = (userProfile.cart || []).filter(
      (c) => c.product && c.quantity > 0
    );

    if (cartItems.length === 0) {
      console.warn(
        `   ⚠️  Cart is empty for user ${userId}. ` +
        `Cannot reconstruct items. Will flag order as RECOVERY_NO_ITEMS.\n`
      );
      // We'll still create a placeholder so payment is visible in admin panel
    }

    console.log(`   🛒 Cart items found: ${cartItems.length}`);

    // 6. Build shipping details:
    //    Priority: default address → first address → payment contact (partial)
    const defaultAddr =
      userProfile.addresses?.find((a) => a.isDefault) ||
      userProfile.addresses?.[0];

    // Razorpay payment has contact (phone) and email
    const shippingDetails = {
      name: userProfile.name || payment.description || "Recovered Customer",
      phone: defaultAddr?.phone || payment.contact || userProfile.phone || "0000000000",
      address: defaultAddr
        ? `${defaultAddr.houseNumber || ""} ${defaultAddr.addressLine}`.trim()
        : "RECOVERED - Address Unknown",
      city: defaultAddr?.city || "RECOVERED",
      state: defaultAddr?.state || "RECOVERED",
      pincode: defaultAddr?.pincode || "000000",
      email: userProfile.email || payment.email || "",
    };

    console.log(`   📍 Shipping: ${shippingDetails.address}, ${shippingDetails.city}`);

    // 7. Recalculate amounts from live DB (same as verifyPayment does)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let totalAmount = 0;
      let totalWeightGrams = 0;
      const orderItems = [];
      const noItemsFallback = cartItems.length === 0;

      if (!noItemsFallback) {
        for (const cartItem of cartItems) {
          const product = await Product.findById(cartItem.product._id).session(session);
          if (!product) {
            console.warn(`   ⚠️  Product ${cartItem.product._id} not found. Skipping item.`);
            continue;
          }

          const qty = cartItem.quantity || 1;
          totalAmount += product.price * qty;

          const itemWeightG =
            product.product_weight_g ||
            (product.product_weight_ml ? product.product_weight_ml * 1.05 : 200);
          totalWeightGrams += itemWeightG * qty;

          orderItems.push({
            product: product._id,
            quantity: qty,
            priceAtPurchase: product.price,
          });

          // Deduct stock
          product.stock -= qty;
          await product.save({ session });
        }
      }

      // Razorpay amount is in paise — use it as the source of truth for totalAmount
      // if cart was empty or recalculated amount differs significantly
      const rzpAmountINR = rzpOrder.amount / 100;

      // If cart was empty, use Razorpay amount directly (no stock to deduct)
      if (noItemsFallback || orderItems.length === 0) {
        totalAmount = rzpAmountINR;
      }

      const shippingCost = totalAmount >= 999 ? 0 : 99;
      const originalAmount = noItemsFallback ? rzpAmountINR : totalAmount + shippingCost;

      // Welcome offer check
      const existingCount = await Order.countDocuments({
        user: userId,
        orderStatus: { $in: ["pending", "processing", "shipped", "delivered"] },
      }).session(session);

      let discountAmount = 0;
      let isWelcomeOfferApplied = false;
      if (existingCount === 0) {
        isWelcomeOfferApplied = true;
        discountAmount = Math.round(originalAmount * 0.1);
      }

      const finalAmount = Math.max(0, originalAmount - discountAmount);

      // Build admin note
      const amountMismatch =
        Math.abs(finalAmount - rzpAmountINR) > 5
          ? ` ⚠️ Amount mismatch: DB-calc=₹${finalAmount}, Razorpay=₹${rzpAmountINR}.`
          : "";

      const adminNote =
        `🔁 RECOVERED ORDER — Created by payment recovery script. ` +
        `Original verify call failed due to Zod validation bug (missing Razorpay fields in schema). ` +
        (noItemsFallback
          ? `🛒 Cart was already cleared — items are UNKNOWN. Please contact customer and fulfil manually. `
          : `🛒 Items reconstructed from user's uncleared cart. `) +
        `📍 Shipping may be from saved address, not original checkout address — verify with customer if needed.` +
        amountMismatch;

      // 8. Create Order
      const [newOrder] = await Order.create(
        [
          {
            user: userId,
            items: orderItems,
            totalAmount: rzpAmountINR, // Trust Razorpay as the payment source of truth
            discountAmount,
            isWelcomeOfferApplied,
            originalAmount,
            paymentMethod: "razorpay",
            paymentStatus: "paid",
            orderStatus: "pending",
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: payment.signature || null,
            shippingDetails,
            adminNote,
            invoiceNumber: `INV-RECOVERED-${Date.now()}-${userId.toString().slice(-4).toUpperCase()}`,
            invoiceGenerated: true,
            statusHistory: [
              {
                status: "pending",
                changedAt: new Date(payment.created_at * 1000),
                source: "system",
                note: "Recovered by payment recovery script",
              },
            ],
          },
        ],
        { session }
      );

      // 9. Link order to user profile
      await UserProfile.findByIdAndUpdate(
        userId,
        {
          $push: { orders: newOrder._id },
          $set: { cart: [] }, // Clear the cart now
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      console.log(
        `   ✅ RECOVERED order ${newOrder._id} for user ${userId} | Amount: ₹${rzpAmountINR}\n`
      );
      recovered++;

    } catch (txErr) {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();
      console.error(`   ❌ Transaction failed: ${txErr.message}\n`);
      failed++;
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("════════════════════════════════════════");
  console.log("  RECOVERY COMPLETE");
  console.log("════════════════════════════════════════");
  console.log(`  ✅ Recovered : ${recovered}`);
  console.log(`  ⏭️  Skipped   : ${skipped} (already in DB)`);
  console.log(`  ❌ Failed    : ${failed}`);
  console.log("════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  mongoose.disconnect();
  process.exit(1);
});
