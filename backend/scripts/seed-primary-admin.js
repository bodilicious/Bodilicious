/**
 * Seed Script: Elevate a user to primary_admin
 * Usage: node scripts/seed-primary-admin.js your@email.com
 *
 * This is the ONLY way to create a primary_admin.
 * The admin panel itself cannot promote anyone to primary_admin.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Resolve .env from backend root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not found in .env");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/seed-primary-admin.js <email>");
  process.exit(1);
}

// Minimal inline schema to avoid importing the full model tree
const userProfileSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: { type: String, enum: ["user", "admin", "primary_admin"], default: "user" },
});

const UserProfile =
  mongoose.models.UserProfile ||
  mongoose.model("UserProfile", userProfileSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅  Connected to MongoDB");

  const user = await UserProfile.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`❌  No user found with email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const previousRole = user.role;
  user.role = "primary_admin";
  await user.save();

  console.log(`\n✅  Success!`);
  console.log(`   Name:  ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role:  ${previousRole}  →  primary_admin\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
