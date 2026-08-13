import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    firebaseUID: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    avatar: {
      type: String,
    },

    phone: {
      type: String,
    },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
    },

    dateOfBirth: {
      type: Date,
    },

    skinType: {
      type: String,
      enum: ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal'],
    },

    skinConcerns: [{
      type: String,
      enum: ['Acne', 'Dark Spots', 'Aging', 'Pigmentation', 'Dullness', 'Dryness'],
    }],

    preferredRoutine: {
      type: String,
      enum: ['Morning Routine', 'Night Routine', 'Both'],
    },

    addresses: [
      {
        isDefault: { type: Boolean, default: false },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        houseNumber: { type: String }, // Optional
        addressLine: { type: String, required: true },
        area: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, default: 'India' },
        pincode: { type: String, required: true },
      }
    ],

    recentlyBought: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],

    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        variant: {
          type: String,
          default: null,
        },
      }
    ],

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    welcomeOfferUsed: {
      type: Boolean,
      default: false,
    },
    cartUpdatedAt: {
      type: Date,
      default: null,
    },
    whatsappOptIn: {
      type: Boolean,
      default: false,
    },
    lastReEngagementSentAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'primary_admin'],
      default: 'user',
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },

    // CRM / Segmentation
    segment: {
      type: [String],
      enum: ["new", "loyal", "at_risk", "high_value"],
      default: [],
      index: true,
    },
    adminNotes: {
      type: String,
      default: "",
    },
    lifetimeSpend: {
      type: Number,
      default: 0,
    },
    cartHistory: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        timesAdded: { type: Number, default: 0 },
        timesRemoved: { type: Number, default: 0 },
        lastAddedAt: { type: Date, default: null },
        lastRemovedAt: { type: Date, default: null }
      }
    ],
    productViewCounts: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        count: { type: Number, default: 0 },
        lastViewedAt: { type: Date, default: null }
      }
    ],
    lifetimeSessions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userProfileSchema.index({ email: 1 });
userProfileSchema.index({ phone: 1 }, { background: true });
userProfileSchema.index({ createdAt: -1 });
userProfileSchema.index({ role: 1 });
userProfileSchema.index({ lifetimeSpend: -1 });
userProfileSchema.index({ "cartHistory.productId": 1 });
userProfileSchema.index({ "productViewCounts.productId": 1 });

const UserProfile =
  mongoose.models.UserProfile ||
  mongoose.model("UserProfile", userProfileSchema);

export default UserProfile;
