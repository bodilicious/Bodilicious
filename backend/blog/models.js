import mongoose from "mongoose";

// ────────────────────────────────────────────────────────────────────────────
// BlogCategory — controlled list (not freeform strings)
// ────────────────────────────────────────────────────────────────────────────
const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
  },
  { timestamps: true }
);

export const BlogCategory =
  mongoose.models.BlogCategory ||
  mongoose.model("BlogCategory", blogCategorySchema);

const seoKeywordSchema = new mongoose.Schema(
  {
    primary: { type: [String], default: [] },
    secondary: { type: [String], default: [] },
    tertiary: { type: [String], default: [] },
  },
  { _id: false }
);

// ────────────────────────────────────────────────────────────────────────────
// Blog
// ────────────────────────────────────────────────────────────────────────────
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },

    // Unique, URL-safe identifier. Set from title if not provided; collision-handled in controller.
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },

    // Rich-text HTML content from Tiptap editor. Sanitised with DOMPurify on the public page.
    content: { type: String, default: "" },

    // Short summary for listing cards / SERP fallback.
    excerpt: { type: String, trim: true, maxlength: 500, default: "" },

    // Cloudinary secure_url for the cover image.
    coverImage: { type: String, trim: true, default: "" },

    // Set server-side from req.user.id — never accepted from client input.
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },

    // Controlled category list (ObjectId refs) + freeform string tags.
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "BlogCategory" }],
    tags: { type: [String], default: [] },

    // SEO fields — description is more important than keywords for modern search engines.
    seo_title:       { type: String, trim: true, maxlength: 300, default: "" },
    seo_description: { type: String, trim: true, maxlength: 500, default: "" },
    seo_keywords:    { type: seoKeywordSchema, default: () => ({ primary: [], secondary: [], tertiary: [] }) },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    // Stamped automatically on first draft → published transition. Never manually editable.
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique slug index (already enforced by schema field, explicit index here for clarity)
blogSchema.index({ slug: 1 }, { unique: true });

// Compound index for fast public listing queries (published posts, newest first)
blogSchema.index({ status: 1, publishedAt: -1 });

// Optional: text index for future on-site blog search
blogSchema.index({ title: "text", content: "text" });

blogSchema.set("autoCreate", true);

const Blog = mongoose.models.Blog || mongoose.model("Blog", blogSchema);

export default Blog;
