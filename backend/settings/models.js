import mongoose from "mongoose";
import { COUNTRIES } from "../utils/countries.js";

const storeSettingsSchema = new mongoose.Schema(
  {
    // 1. General Info
    storeName: { type: String, default: "Bodilicious" },
    supportEmail: { type: String, default: "bodiliciousnaturalproducts@gmail.com" },
    supportPhone: { type: String, default: "+91 9894451947" },
    storeAddress: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    usdExchangeRate: { type: Number, default: 83.5 },
    usdExchangeRateLastUpdated: { type: Date, default: null },
    exchangeRates: { type: Map, of: Number, default: {} },
    exchangeRatesLastUpdated: { type: Date, default: null },
    timezone: { type: String, default: "Asia/Kolkata" },

    // 2. Orders & Invoicing
    invoicePrefix: { type: String, default: "BOD-" },
    orderIdStartFrom: { type: Number, default: 1000 },
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },

    // 3. Shipping & Taxes
    shippingThreshold: { type: Number, default: 999 },
    shippingCost: { type: Number, default: 99 },
    taxRatePercent: { type: Number, default: 18 },

    // 4. Notifications
    // Master Switches
    waAllEnabled: { type: Boolean, default: true },
    emailAllEnabled: { type: Boolean, default: true },

    // WhatsApp Triggers
    waOrderPlacedEnabled: { type: Boolean, default: true },
    waStaleCartEnabled: { type: Boolean, default: true },
    waOutForDeliveryEnabled: { type: Boolean, default: true },
    waTicketRaisedEnabled: { type: Boolean, default: true },
    waTicketResolvedEnabled: { type: Boolean, default: true },
    waTrendingProductsEnabled: { type: Boolean, default: true },
    waReEngagementEnabled: { type: Boolean, default: true },
    waPaymentFailureEnabled: { type: Boolean, default: true },

    // Email Triggers
    notifyAdminOnOrder: { type: Boolean, default: true },
    adminNotificationEmail: { type: String, default: "admin@bodilicious.in" },
    sendOrderConfirmationToCustomer: { type: Boolean, default: true },
    emailReturnApproved: { type: Boolean, default: true },
    emailReturnRejected: { type: Boolean, default: true },
    emailTicketRaised: { type: Boolean, default: true },
    emailTicketReply: { type: Boolean, default: true },
    emailTicketResolved: { type: Boolean, default: true },
    emailTicketCancelled: { type: Boolean, default: true },

    // 5. Payments
    codEnabled: { type: Boolean, default: true },
    codExtraCharge: { type: Number, default: 0 },
    minOrderValueForCOD: { type: Number, default: 0 },

    // 6. Store Preferences
    returnWindowDays: { type: Number, default: 7 },
    lowStockThreshold: { type: Number, default: 10 },

    // 7. Storefront
    announcementBar: {
      text: { type: String, default: "" },
      isActive: { type: Boolean, default: false },
      link: { type: String, default: "" },
    },
    launchModal: {
      isActive:    { type: Boolean, default: false },
      badge:       { type: String, default: "Just Launched" },
      title:       { type: String, default: "New Collection" },
      description: { type: String, default: "Discover our latest additions, crafted with rare botanical extracts." },
      ctaLabel:    { type: String, default: "Explore Collection" },
      ctaLink:     { type: String, default: "/shop" },
      image:       { type: String, default: "" },
    },
    socialLinks: {
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      youtube: { type: String, default: "" }
    },
    seoMeta: {
      title: { type: String, default: "Bodilicious" },
      description: { type: String, default: "Premium skincare and wellness products" },
      ogImage: { type: String, default: "" }
    },

    // 8. System
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: "We are currently updating our store. Please check back soon!" },
    maintenanceBypassSecret: { type: String, default: "" },

    // 9. Returns & Refunds
    allowReturnOpened: { type: Boolean, default: false },
    allowReturnUnopened: { type: Boolean, default: true },
    requirePhotoForReturn: { type: Boolean, default: true },
    adverseReactionReturnEnabled: { type: Boolean, default: true },
    adverseReactionWindowDays: { type: Number, default: 14 },
    refundMethod: { type: String, default: "original", enum: ["original", "store_credit", "both"] },
    returnReasonTags: {
      type: [String],
      default: [
        "Wrong Product",
        "Adverse Reaction",
        "Damaged in Transit",
        "Product Not as Described",
        "Changed Mind",
        "Expired / Near Expiry",
        "Packaging Defect"
      ]
    },

    // 10. Best Sellers (Homepage curation)
    bestSellerPids: { type: [String], default: [] },

    // 11. Shipping & Cold Chain
    fragilePackagingSurchargeEnabled: { type: Boolean, default: false },
    fragilePackagingSurcharge: { type: Number, default: 0 },
    showEstimatedDeliveryDate: { type: Boolean, default: true },
    averageDeliveryDays: { type: Number, default: 5 },
    pincodeCheckEnabled: { type: Boolean, default: false },
    pincodeServiceabilitySource: { type: String, default: "manual", enum: ["manual", "shiprocket", "delhivery"] },
    temperatureSensitiveWarningEnabled: { type: Boolean, default: true },
    internationalShippingEnabled: { type: Boolean, default: false },
    internationalCheckoutEnabled: { type: Boolean, default: false },
    autoCurrencySwitchingEnabled: { type: Boolean, default: true },
    internationalShippingCost: { type: Number, default: 2000 },
    internationalShippingThreshold: { type: Number, default: 10000 },
    supportedCountries: { type: [String], default: COUNTRIES },

    // 12. Skin Profile & Personalisation
    skinQuizEnabled: { type: Boolean, default: true },
    productCompatibilityWarningsEnabled: { type: Boolean, default: true },
    storeSkinProfileOnAccount: { type: Boolean, default: true },

    // 13. Reviews & Social Proof
    reviewSkinTypeTaggingEnabled: { type: Boolean, default: true },
    reviewBeforeAfterPhotosEnabled: { type: Boolean, default: true },
    reviewVerifiedBadgeEnabled: { type: Boolean, default: true },
    reviewIncentiveEnabled: { type: Boolean, default: false },
    reviewIncentiveDiscountPercent: { type: Number, default: 10 },
    reviewModerationEnabled: { type: Boolean, default: true },

    // Audit
    lastUpdatedBy: { type: String, default: null },
    lastUpdatedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Enforce singleton
storeSettingsSchema.pre("save", async function () {
  if (this.isNew) {
    const count = await mongoose.model("StoreSettings").countDocuments();
    if (count > 0) {
      throw new Error("Only one StoreSettings document can exist.");
    }
  }
});

const StoreSettings = mongoose.model("StoreSettings", storeSettingsSchema);

export default StoreSettings;
