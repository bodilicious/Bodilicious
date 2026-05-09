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
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
  },
  { _id: false }
);


/* =========================================
   Main Order Schema
========================================= */
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
      index: true,
    },

    items: [orderItemSchema],

    totalAmount: {
      type: Number,
      required: true,
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

    couponDiscount: {
      type: Number,
      default: 0,
    },

    originalAmount: {
      type: Number,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "return_requested", "returned"],
      default: "processing",
    },

    /* =========================================
       Razorpay Fields
    ========================================= */

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    razorpaySignature: {
      type: String,
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

    /* =========================================
       Shipping Snapshot
    ========================================= */

    shippingDetails: {
      type: shippingDetailsSchema,
      required: true,
    },

    /* =========================================
       Soft Delete
    ========================================= */

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* =========================================
       Return / Refund Fields
    ========================================= */

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
      enum: [null, "original_payment", "store_credit", "replacement"],
      default: null,
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
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", default: null },
        changedAt: { type: Date, default: Date.now },
        source: {
          type: String,
          enum: ["admin", "system", "payment_gateway", "shiprocket"],
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


/* =========================================
   Automatically exclude deleted orders
========================================= */
orderSchema.pre(/^find/, function () {
  this.where({ isDeleted: false });
});


const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;