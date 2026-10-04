import mongoose from "mongoose";

/* =========================================
   Order Item Schema
========================================= */
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  priceAtPurchase: {
    type: Number,
    required: true,
  },
  variant: {
    type: String,
    default: null,
  },
});


/* =========================================
   Shipping Snapshot Schema
========================================= */
const shippingDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    // Required for Indian addresses only — see tracker/schema.js (many countries have
    // no states, and the checkout form allows leaving it blank for them).
    state: {
      type: String,
      default: "",
      required: function () {
        return ["india", "in", "bharat", "ind"].includes(String(this.country || "India").toLowerCase().trim());
      },
    },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      validate: {
        validator: v => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email address"
      }
    },
  },
  { _id: false }
);

/* =========================================
   Billing Snapshot Schema
   Same shape as shipping, minus the required phone: the checkout billing form
   doesn't collect a phone number, so reusing shippingDetailsSchema rejected
   every order placed with a separate billing address.
========================================= */
const billingDetailsSchema = shippingDetailsSchema.clone();
billingDetailsSchema.path("phone").required(false);
billingDetailsSchema.path("phone").default("");


/* =========================================
   Main Order Schema
========================================= */
const orderSchema = new mongoose.Schema(
  {
    // No single index — { user, createdAt } below serves every per-user query.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },

    items: [orderItemSchema],

    totalAmount: {
      type: Number,
      required: true,
    },

    marketing: {
      source: { type: String, default: null },
      medium: { type: String, default: null },
      campaign: { type: String, default: null },
    },

    /* =========================================
       Origin of the order.
       Distinct from `marketing.source` (a UTM value). This records HOW the order
       came into existence, which the admin views use to tell a genuinely abandoned
       customer checkout apart from a draft an admin created by hand.
       Without this path Mongoose silently discards `source: "admin_draft"` on
       create, and `{ source: { $ne: "admin_draft" } }` then matches every order —
       so admin drafts were being counted as abandoned checkouts.
    ========================================= */
    source: {
      type: String,
      enum: ["storefront", "admin_draft"],
      default: "storefront",
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay"],
      default: "cod",
    },

    /* =========================================
       Discount Tracking
    ========================================= */
    isWelcomeOfferApplied: {
      type: Boolean,
      default: false,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    couponCode: {
      type: String,
      default: null,
    },

    appliedCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: false,
    },

    couponDiscount: {
      type: Number,
      default: 0,
    },

    originalAmount: {
      type: Number,
      required: true,
    },

    /* =========================================
       Currency
       All monetary fields above (totalAmount, originalAmount, shippingCost,
       discountAmount, refundAmount) are denominated in THIS currency — not INR.
       `exchangeRate` is the INR → currency rate that was locked in at quote time,
       so INR-equivalent reporting is always recoverable: amount / exchangeRate.

       Legacy orders written before these fields existed have no stored value;
       Mongoose applies the defaults below on hydration, and every read path
       already guards with `order.currency || "INR"`. Those orders were all INR,
       so no backfill is required.
    ========================================= */
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    exchangeRate: {
      type: Number,
      default: 1,
    },

    shippingCost: {
      type: Number,
      default: 0,
    },

    // StoreSettings.codExtraCharge applied to a COD order (already inside totalAmount).
    codCharge: {
      type: Number,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentClaimedAt: {
      type: Date,
      default: null,
    },

    lastClaimFailedAt: {
      type: Date,
      default: null,
    },

    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "return_requested", "returned", "abandoned"],
      default: "pending",
    },

    /* =========================================
       Razorpay Fields
    ========================================= */

    razorpayOrderId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    razorpaySignature: {
      type: String,
      default: null,
    },

    paymentLinkId: {
      type: String,
      default: null,
    },

    paymentLink: {
      type: String,
      default: null,
    },

    // Explicit expiry timestamp — set when the link is generated.
    // Do NOT use updatedAt as a proxy: any write to the order (webhook, admin note)
    // would move updatedAt and break expiry math.
    paymentLinkExpiresAt: {
      type: Date,
      default: null,
    },

    /* =========================================
       Invoice Fields 
    ========================================= */
    invoiceNumber: {
      type: String,
      default: null,
    },

    invoiceGenerated: {
      type: Boolean,
      default: false,
    },

    /* =========================================
       Shiprocket Fields
    ========================================= */

    awb: {
      type: String,
      default: null,
      index: true,
    },

    shiprocketOrderId: {
      type: String,
      default: null,
      index: true,
    },

    shipmentId: {
      type: Number,
      default: null,
    },

    estimatedDeliveryDate: {
      type: Date,
      default: null,
    },

    estimatedDeliveryDays: {
      type: Number,
      default: null,
    },

    estimatedCourierName: {
      type: String,
      default: null,
    },

    eddCalculatedAt: {
      type: Date,
      default: null,
    },

    // Set by the Shiprocket webhook when orderStatus transitions to "delivered".
    // Used to enforce the configurable return window (StoreSettings.returnWindowDays).
    deliveredAt: {
      type: Date,
      default: null,
      index: true,
    },

    shippedAt: {
      type: Date,
      default: null,
    },

    /* =========================================
       Shipping Snapshot
    ========================================= */

    shippingDetails: {
      type: shippingDetailsSchema,
      required: true,
    },

    billingDetails: {
      type: billingDetailsSchema,
      required: false,
      default: null,
    },

    /* =========================================
       Soft Delete
    ========================================= */

    // Not indexed: nearly every order is false, so the index never narrows a query.
    isDeleted: {
      type: Boolean,
      default: false,
    },

    /* =========================================
       Return / Refund Fields
    ========================================= */

    rtoReason: {
      type: String,
      default: null,
    },

    returnStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "completed"],
      default: "none",
    },

    returnReason: {
      type: String,
      default: null,
    },

    returnConditionNotes: {
      type: String,
      default: null,
    },

    returnPhotoUrls: {
      type: [String],
      default: [],
    },

    returnRefundMethod: {
      type: String,
      enum: [null, "original_payment", "replacement"],
      default: null,
    },

    isStockRestored: {
      type: Boolean,
      default: false,
    },

    physicalReceived: {
      type: Boolean,
      default: false,
    },

    returnResolvedAt: {
      type: Date,
      default: null,
    },

    returnRequestedAt: {
      type: Date,
      default: null,
    },

    refundId: {
      type: String,
      default: null,
    },

    refundStatus: {
      type: String,
      enum: [null, "pending", "processed", "failed"],
      default: null,
    },

    refundAmount: {
      type: Number,
      default: null,
    },

    /* =========================================
       Return Tracking (Shiprocket)
    ========================================= */
    returnShiprocketOrderId: {
      type: String,
      default: null,
    },

    returnShipmentId: {
      type: Number,
      default: null,
    },

    returnAwb: {
      type: String,
      default: null,
    },

    /* =========================================
       Admin / Ops Fields
    ========================================= */
    statusHistory: [
      {
        fromStatus: { type: String, default: null },
        toStatus: { type: String, default: null },
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", default: null },
        changedAt: { type: Date, default: Date.now },
        source: {
          type: String,
          enum: ["admin", "system", "payment_gateway", "shiprocket", "razorpay-webhook", "reconciliation", "user"],
          default: "system"
        },
        note: { type: String, default: "" },
      },
    ],

    adminNote: {
      type: String,
      default: "",
    },

    /* =========================================
       Manual Review Flag
       Set when processPaidOrder exhausts all retries with money captured.
       Enables ops query: Order.find({ needsManualReview: true })
    ========================================= */
    needsManualReview: {
      type: Boolean,
      default: false,
      index: true,
    },

    reviewReason: {
      type: String,
      default: null,
    },

    /* =========================================
       Customer Comments
    ========================================= */
    customerComments: [
      {
        text: { type: String, required: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ "shippingDetails.phone": 1 });
orderSchema.index({ "shippingDetails.email": 1 });

// Added compound indexes for optimization
orderSchema.index({ user: 1, createdAt: -1 }, { background: true });
orderSchema.index({ razorpayOrderId: 1 }, { background: true });
orderSchema.index({ razorpayPaymentId: 1 }, { background: true });
orderSchema.index({ returnStatus: 1 }, { background: true });


/* =========================================
   Automatically exclude deleted orders
========================================= */
orderSchema.pre(/^find/, function () {
  this.where({ isDeleted: false });
});


const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);

/**
 * Orders a customer should see as "their orders": excludes abandoned checkouts,
 * unpaid/failed Razorpay attempts, and paid orders still being finalised. Shared by
 * every customer-facing order list — the profile endpoint had no filter, so each
 * abandoned online checkout showed up on the tracking page as a pending order.
 */
/**
 * Product fields embedded when an order's items are populated. Every consumer —
 * order pages, confirmation emails, Shiprocket push (name/sku/hsn/weights) and the
 * returns flow — reads only these. A bare .populate("items.product") pulled whole
 * product documents (descriptions, ingredients, FAQs, every review) into each order
 * response, tens of KB per line item.
 */
export const ORDER_ITEM_PRODUCT_FIELDS = "pid name price images category slug hsn_code product_weight_g product_weight_ml";

export const customerVisibleOrderFilter = (userId) => ({
  user: userId,
  orderStatus: { $ne: "abandoned" },
  $nor: [
    { paymentMethod: "razorpay", paymentStatus: { $in: ["pending", "failed"] } },
    { paymentMethod: "razorpay", paymentStatus: "paid", invoiceGenerated: { $ne: true } },
  ],
});

export default Order;