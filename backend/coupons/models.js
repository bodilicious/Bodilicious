import mongoose from "mongoose";

/* =========================================
   Coupon Schema
========================================= */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["percentage", "flat", "free_shipping"],
      required: true,
    },
    value: {
      type: Number,
      default: 0, // 0 for free_shipping type
    },
    maxDiscountCap: {
      type: Number,
      default: null, // null = no cap
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: null, // null = unlimited
    },
    totalCap: {
      type: Number,
      default: null, // null = unlimited
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    // Per-user usage counts, keyed by UserProfile _id (string). Lets a single
    // atomic findOneAndUpdate enforce perUserLimit the same way usageCount
    // enforces totalCap — see claimCouponUsage in coupons/controller.js.
    usesByUser: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    allowsStacking: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1 });
couponSchema.index({ expiresAt: 1 });

/* =========================================
   Coupon Use Schema (attribution join table)
========================================= */
const couponUseSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true,
    },
    discountApplied: {
      type: Number,
      required: true,
    },
    orderTotal: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

couponUseSchema.index({ coupon: 1, user: 1 });
couponUseSchema.index({ user: 1, coupon: 1 }, { background: true });
couponUseSchema.index({ createdAt: -1 });

const Coupon = mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
const CouponUse = mongoose.models.CouponUse || mongoose.model("CouponUse", couponUseSchema);

export { Coupon, CouponUse };
export default Coupon;
