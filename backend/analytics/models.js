import mongoose from "mongoose";

// 1. Daily Sales Aggregate View
// Granularity: One document per day
const dailySalesSchema = new mongoose.Schema({
  date_string: { type: String, required: true, index: true, unique: true }, // Format: YYYY-MM-DD
  gross_revenue: { type: Number, default: 0 },
  net_revenue: { type: Number, default: 0 },
  order_count: { type: Number, default: 0 },
  refund_count: { type: Number, default: 0 },
  average_order_value: { type: Number, default: 0 },
  last_aggregated_at: { type: Date, default: Date.now }
}, { timestamps: true });

// 2. Product Velocity View
// Granularity: One document per product per day
const productVelocitySchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  date_string: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
  views: { type: Number, default: 0 }, // If tracked in audit logs
  carts: { type: Number, default: 0 },
  purchases: { type: Number, default: 0 },
  revenue_generated: { type: Number, default: 0 },
  last_aggregated_at: { type: Date, default: Date.now }
}, { timestamps: true });
// Compound index for fast upserts
productVelocitySchema.index({ product_id: 1, date_string: 1 }, { unique: true });

// 3. Customer Cohort View
const customerCohortViewSchema = new mongoose.Schema(
  {
    cohort_month: { type: String, required: true, index: true }, // Format: YYYY-MM
    month_index: { type: Number, required: true },               // 0 = acquisition month
    total_users_in_cohort: { type: Number, default: 0 },
    active_users: { type: Number, default: 0 },
    revenue_retained: { type: Number, default: 0 },
    last_aggregated_at: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: "analytics_cohort_view" }
);
customerCohortViewSchema.index({ cohort_month: 1, month_index: 1 }, { unique: true });

/**
 * Advanced Product Intelligence View
 * Caches frequently bought together pairings and repeat purchase rates
 */
const productIntelligenceViewSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    product_name: { type: String, required: true },
    repeat_purchase_rate: { type: Number, default: 0 }, // Percentage 0-100
    total_unique_buyers: { type: Number, default: 0 },
    revenue_generated: { type: Number, default: 0 },
    frequently_bought_together: [
      {
        paired_product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        paired_product_name: { type: String },
        co_occurrences: { type: Number, default: 0 }
      }
    ]
  },
  { timestamps: true, collection: "analytics_product_intelligence" }
);

export const DailySalesView = mongoose.models.DailySalesView || mongoose.model("DailySalesView", dailySalesSchema);
export const ProductVelocityView = mongoose.models.ProductVelocityView || mongoose.model("ProductVelocityView", productVelocitySchema);
export const CustomerCohortView = mongoose.models.CustomerCohortView || mongoose.model("CustomerCohortView", customerCohortViewSchema);
export const ProductIntelligenceView = mongoose.models.ProductIntelligenceView || mongoose.model("ProductIntelligenceView", productIntelligenceViewSchema);
