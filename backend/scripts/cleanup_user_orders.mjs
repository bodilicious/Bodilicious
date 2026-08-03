/**
 * cleanup_user_orders.mjs
 *
 * Tasks:
 *  1. Delete ALL orders for jacksonraj0711@gmaill.com
 *  2. Remove duplicate UserProfile documents (same email appears more than once),
 *     keeping the NEWEST document (latest createdAt) per email — this is the "current"
 *     user. All older duplicates are removed.
 *
 * Run: node --env-file=.env scripts/cleanup_user_orders.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load .env from the backend root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Minimal schemas (no need to load every module) ────────────────────────────

const userProfileSchema = new mongoose.Schema(
  {
    firebaseUID: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String },
    role: { type: String },
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", required: true },
  },
  { timestamps: true }
);

const UserProfile =
  mongoose.models.UserProfile || mongoose.model("UserProfile", userProfileSchema);

const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deleteOrdersForEmail(email) {
  console.log(`\n─── Step 1: Delete orders for ${email} ───`);

  // Find all UserProfile _id values that match this email
  const users = await UserProfile.find(
    { email: email.toLowerCase() },
    { _id: 1, firebaseUID: 1, name: 1, createdAt: 1 }
  ).lean();

  if (users.length === 0) {
    console.log(`  No UserProfile found for ${email}. Skipping order deletion.`);
    return [];
  }

  const userIds = users.map((u) => u._id);
  console.log(`  Found ${users.length} UserProfile(s) for ${email}:`);
  users.forEach((u) =>
    console.log(`    _id=${u._id}  firebaseUID=${u.firebaseUID}  createdAt=${u.createdAt}`)
  );

  // Count orders first
  const orderCount = await Order.countDocuments({ user: { $in: userIds } });
  console.log(`  Orders to delete: ${orderCount}`);

  if (orderCount === 0) {
    console.log("  No orders found. Nothing to delete.");
    return userIds;
  }

  const result = await Order.deleteMany({ user: { $in: userIds } });
  console.log(`  ✓ Deleted ${result.deletedCount} orders.`);

  return userIds;
}

async function removeDuplicateUsers() {
  console.log(`\n─── Step 2: Remove duplicate UserProfile documents ───`);

  // Aggregate to find emails with more than one UserProfile
  const duplicates = await UserProfile.aggregate([
    {
      $group: {
        _id: "$email",
        count: { $sum: 1 },
        docs: {
          $push: {
            _id: "$_id",
            firebaseUID: "$firebaseUID",
            name: "$name",
            createdAt: "$createdAt",
          },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { "_id": 1 } },
  ]);

  if (duplicates.length === 0) {
    console.log("  No duplicate emails found. Nothing to remove.");
    return;
  }

  console.log(`  Found ${duplicates.length} email(s) with duplicates:`);

  let totalRemoved = 0;

  for (const group of duplicates) {
    const email = group._id;

    // Sort docs so that the NEWEST (latest createdAt) comes first → keep index 0
    const sorted = group.docs.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const keep = sorted[0];
    const toRemove = sorted.slice(1);

    console.log(`\n  Email: ${email}`);
    console.log(`    KEEP  → _id=${keep._id}  firebaseUID=${keep.firebaseUID}  createdAt=${keep.createdAt}`);
    toRemove.forEach((d) =>
      console.log(`    DELETE→ _id=${d._id}  firebaseUID=${d.firebaseUID}  createdAt=${d.createdAt}`)
    );

    const removeIds = toRemove.map((d) => d._id);

    // Reassign any orphaned orders to the surviving user before deleting old profiles
    const orderReassign = await Order.updateMany(
      { user: { $in: removeIds } },
      { $set: { user: keep._id } }
    );
    if (orderReassign.modifiedCount > 0) {
      console.log(
        `    ↳ Reassigned ${orderReassign.modifiedCount} orders to surviving user.`
      );
    }

    // Delete the old (duplicate) profiles
    const del = await UserProfile.deleteMany({ _id: { $in: removeIds } });
    console.log(`    ↳ Deleted ${del.deletedCount} duplicate profile(s).`);
    totalRemoved += del.deletedCount;
  }

  console.log(`\n  ✓ Total duplicate profiles removed: ${totalRemoved}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const TARGET_EMAIL = "jacksonraj0711@gmaill.com";

  console.log("Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME || "myappdb",
  });
  console.log("Connected.\n");

  try {
    // 1. Delete all orders for the target email
    await deleteOrdersForEmail(TARGET_EMAIL);

    // 2. Remove duplicate user profiles across ALL emails
    await removeDuplicateUsers();

    console.log("\n✅  Cleanup complete.");
  } catch (err) {
    console.error("\n❌  Error during cleanup:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

main();
