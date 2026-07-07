import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, _id: true }
);

const ingredientSchema = new mongoose.Schema(
  {
    key_actives: { type: [String], default: [] },
    botanical_extracts: { type: [String], default: [] },
    others: { type: [String], default: [] },
  },
  { _id: false }
);

const usageSchema = new mongoose.Schema(
  {
    time: { type: String, trim: true, default: "" },
    frequency: { type: String, trim: true, default: "" },
    routine_step: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    pid: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    brand: { type: String, default: "Bodilicious", trim: true },
    images: {
      type: [String],
      required: true,
      validate: [
        { validator: (arr) => arr.length > 0, message: "At least one image is required" },
        { validator: (arr) => arr.length <= 15, message: "Maximum 15 images allowed" }
      ],
    },
    description: { type: String, required: true, trim: true, maxlength: 5000 },

    category: {
      type: String,
      enum: ["skin", "hair", "body", "makeup", "lip", "other"],
      required: true,
      lowercase: true,
      trim: true,
    },
    sub_category: { type: String, trim: true, lowercase: true },
    product_type: { type: String, trim: true },
    item_form: { type: String, trim: true },

    ingredients: { type: ingredientSchema, default: () => ({}) },
    benefits: { type: [String], default: [] },
    concerns_targeted: { type: [String], default: [] },
    usage: { type: usageSchema, default: () => ({}) },

    price: { type: Number, required: true, min: 0 },
    price_inr: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    expectedLifespanDays: { type: Number, default: 45 },
    product_weight_ml: { type: Number, min: 0 },
    product_weight_g: { type: Number, min: 0 },
    availability: {
      type: String,
      enum: ["In Stock", "Out of Stock", "Preorder", "Discontinued"],
      default: "In Stock",
    },

    skin_type_suitable: { type: [String], default: [] },
    skin_type_not_suitable: { type: [String], default: [] },
    hair_type_suitable: { type: [String], default: [] },

    how_to_use: { type: [String], default: [] },
    tips: { type: [String], default: [] },
    texture: { type: String, trim: true },
    warnings: { type: [String], default: [] },
    is_active_based: { type: Boolean, default: false },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    reviews: { type: [reviewSchema], default: [] },

    isActive: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 5 },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ product_type: 1 });
productSchema.index({ concerns_targeted: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ isActive: 1 });
// Compound index for category/brand/price browse paths
productSchema.index({ category: 1, brand: 1, price: 1 }, { background: true });

// Sparse index on embedded review author — enables fast lookup of all reviews left by a user
// without scanning every product document's reviews array. Sparse = excluded from index if field absent.
productSchema.index({ "reviews.user": 1 }, { sparse: true });

productSchema.set("autoCreate", true);

productSchema.methods.calculateRatings = function () {
  this.ratingCount = this.reviews.length;
  this.rating =
    this.ratingCount === 0
      ? 0
      : this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.ratingCount;
};

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export const initProductCollection = async () => {
  await Product.createCollection();
};

export default Product;