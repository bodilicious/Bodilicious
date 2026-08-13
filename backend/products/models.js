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

const seoKeywordSchema = new mongoose.Schema(
  {
    primary: { type: [String], default: [] },
    secondary: { type: [String], default: [] },
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

    // Full Google product taxonomy path, e.g.
    // "Health & Beauty > Personal Care > Cosmetics > Skin Care > Sunscreen".
    // Emitted as <g:google_product_category> in the Merchant Center feed
    // (cloudflare-worker/worker.js) and as schema.org `category` on the product
    // page. MUST be an exact node from Google's taxonomy — Merchant Center
    // rejects the attribute outright on any string that isn't in the list, and
    // then silently auto-classifies the item instead:
    //   https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
    // Left blank, the worker falls back to a coarse per-`category` default.
    google_product_category: { type: String, trim: true, default: "" },

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
    seo_keywords: { type: seoKeywordSchema, default: () => ({ primary: [], secondary: [] }) },

    // ── Editorial SEO overrides ───────────────────────────────────────────────
    // All optional. When blank, the shared builders in frontend/src/utils/seo.ts
    // fall back to generated values, so an unfilled product behaves exactly as
    // it does today. Naming matches the Blog model (seo_title/seo_description).
    seo_title:       { type: String, trim: true, maxlength: 200, default: "" },
    seo_description: { type: String, trim: true, maxlength: 500, default: "" },
    // Visible <h1>. Defaults to the product name; useful when the catalogue name
    // is a SKU-ish string but the page should lead with a searchable phrase.
    seo_h1:          { type: String, trim: true, maxlength: 200, default: "" },
    // Visible <h2> subheadings, rendered as real page content for crawlers.
    seo_h2:          { type: [String], default: [] },
    // Alt text for the primary/OG image.
    seo_image_alt:   { type: String, trim: true, maxlength: 300, default: "" },

    // Customer questions rendered as visible page content and FAQPage JSON-LD.
    // Both fields are required per entry — schema.org FAQPage is invalid with a
    // question and no answer, and Google ignores the whole block if any entry
    // is incomplete.
    faqs: {
      type: [
        new mongoose.Schema(
          {
            question: { type: String, trim: true, maxlength: 300, required: true },
            answer: { type: String, trim: true, maxlength: 1000, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    reviews: { type: [reviewSchema], default: [] },

    variants: { type: [String], default: [] },

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