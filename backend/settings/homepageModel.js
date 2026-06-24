import mongoose from "mongoose";

const heroSlideSchema = new mongoose.Schema({
  imageUrl: { type: String, default: '' },
  imageAlt: { type: String, maxlength: 100, default: '' },
  eyebrow: { type: String, maxlength: 200, default: '' },
  title: { type: String, maxlength: 80, default: '' },
  highlight: { type: String, maxlength: 80, default: '' },
  subtitle: { type: String, maxlength: 500, default: '' },
  ctaText: { type: String, maxlength: 50, default: '' },
  ctaLink: { type: String, maxlength: 200, default: '' },
  ctaSecondaryText: { type: String, maxlength: 50, default: '' },
  ctaSecondaryLink: { type: String, maxlength: 200, default: '' },
  overlayDesktop: { type: String, maxlength: 200, default: '' },
  order: { type: Number, required: true, default: 0 },
});

const categorySchema = new mongoose.Schema({
  label: { type: String, maxlength: 50, default: 'New Category' },
  filterId: { type: String, maxlength: 50, default: 'all' },
  imageUrl: { type: String, default: '' },
  imageAlt: { type: String, maxlength: 100, default: '' },
  description: { type: String, maxlength: 150, default: "" },
  order: { type: Number, required: true, default: 0 },
  isVisible: { type: Boolean, default: true },
});

const promiseSchema = new mongoose.Schema({
  icon: { type: String, maxlength: 50, default: 'Leaf' },
  title: { type: String, maxlength: 80, default: '' },
  description: { type: String, maxlength: 500, default: '' },
  order: { type: Number, required: true, default: 0 },
});

const reviewSchema = new mongoose.Schema({
  rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
  comment: { type: String, maxlength: 1000, default: '' },
  user: { type: String, maxlength: 100, default: '' },
  productName: { type: String, maxlength: 100, default: '' },
  date: { type: String, maxlength: 50, default: '' },
  isVerified: { type: Boolean, default: false },
  order: { type: Number, required: true, default: 0 },
});

const faqSchema = new mongoose.Schema({
  question: { type: String, maxlength: 200, default: '' },
  answer: { type: String, maxlength: 1000, default: '' },
  order: { type: Number, required: true, default: 0 },
  isVisible: { type: Boolean, default: true },
});

const sectionTitlesSchema = new mongoose.Schema({
  bestSellersTitle: { type: String, maxlength: 100, default: "Best Sellers" },
  bestSellersSubtitle: { type: String, maxlength: 100, default: "Discover" },
  newArrivalsTitle: { type: String, maxlength: 100, default: "New Arrivals" },
  newArrivalsSubtitle: { type: String, maxlength: 100, default: "Just Landed" },
  categoriesTitle: { type: String, maxlength: 100, default: "Category" },
  categoriesSubtitle: { type: String, maxlength: 100, default: "Shop by" },
  promisesTitle: { type: String, maxlength: 100, default: "Why Bodilicious?" },
  promisesSubtitle: { type: String, maxlength: 100, default: "Our Promise" },
  reviewsTitle: { type: String, maxlength: 100, default: "What Our Customers Say" },
  reviewsSubtitle: { type: String, maxlength: 100, default: "Real Results" },
  faqTitle: { type: String, maxlength: 100, default: "Frequently Asked Questions" },
  faqSubtitle: { type: String, maxlength: 100, default: "Queries" },
  ctaTitle: { type: String, maxlength: 100, default: "Start Your Targeted Care Journey" },
  ctaSubtitle: { type: String, maxlength: 100, default: "Look Good, Feel Good" },
  ctaDescription: { type: String, maxlength: 300, default: "Discover skincare and haircare products made to solve real concerns with trusted, handmade, dermatologically tested formulations." },
  ctaButtonText: { type: String, maxlength: 50, default: "Shop Now" },
});

const videoSnippetSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  caption: { type: String, maxlength: 100, default: '' },
  order: { type: Number, required: true, default: 0 },
});

const contentSchema = new mongoose.Schema({
  heroSlides: { type: [heroSlideSchema], default: [] },
  categories: { type: [categorySchema], default: [] },
  promises: { type: [promiseSchema], default: [] },
  amazonReviews: { type: [reviewSchema], default: [] },
  faqs: { type: [faqSchema], default: [] },
  videoSnippets: { type: [videoSnippetSchema], default: [] },
  sectionTitles: { type: sectionTitlesSchema, default: () => ({}) },
  bestSellerMode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  bestSellerPids: { type: [String], default: [] },
  newArrivalMode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  newArrivalPids: { type: [String], default: [] },
  status: { type: String, enum: ['draft', 'published'], required: true },
  updatedBy: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date, default: null },
  version: { type: Number, default: 1 }
}, { _id: false });

const homepageContentSchema = new mongoose.Schema(
  {
    draft: { type: contentSchema, default: () => ({ status: 'draft' }) },
    published: { type: contentSchema, default: () => ({ status: 'published' }) }
  },
  { timestamps: true }
);

// Enforce singleton
homepageContentSchema.pre("save", async function () {
  if (this.isNew) {
    const count = await mongoose.model("HomepageContent").countDocuments();
    if (count > 0) {
      throw new Error("Only one HomepageContent document can exist.");
    }
  }
});

const HomepageContent = mongoose.model("HomepageContent", homepageContentSchema);

export default HomepageContent;
