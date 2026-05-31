import StoreSettings from "./models.js";
import { logAction } from "../admin/controller.js";

/**
 * GET /api/v1/settings
 * Public route to get non-sensitive store settings (like shipping threshold, announcement bar)
 */
export const getSettings = async (req, res) => {
  try {
    let settings = await StoreSettings.findOne();
    if (!settings) {
      // Create defaults if not exists
      settings = await StoreSettings.create({});
    }

    res.json({
      success: true,
      data: {
        storeName: settings.storeName,
        supportEmail: settings.supportEmail,
        shippingThreshold: settings.shippingThreshold,
        shippingCost: settings.shippingCost,
        announcementBar: settings.announcementBar,
        maintenanceMode: req.query.bypass === settings.maintenanceBypassSecret ? false : settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        bestSellerPids: settings.bestSellerPids || [],
        reviewSkinTypeTaggingEnabled: settings.reviewSkinTypeTaggingEnabled ?? true,
        reviewBeforeAfterPhotosEnabled: settings.reviewBeforeAfterPhotosEnabled ?? true,
        reviewVerifiedBadgeEnabled: settings.reviewVerifiedBadgeEnabled ?? true,
        reviewIncentiveEnabled: settings.reviewIncentiveEnabled ?? false,
        reviewIncentiveDiscountPercent: settings.reviewIncentiveDiscountPercent ?? 10,
        reviewModerationEnabled: settings.reviewModerationEnabled ?? true,
      },
    });
  } catch (err) {
    console.error("GetSettings Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/settings
 * Admin route to get all settings (including sensitive ones if any)
 */
export const getAdminSettings = async (req, res) => {
  try {
    let settings = await StoreSettings.findOne();
    if (!settings) {
      settings = await StoreSettings.create({});
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    console.error("GetAdminSettings Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    let settings = await StoreSettings.findOne();
    if (!settings) {
      settings = await StoreSettings.create({});
    }

    const before = settings.toObject();

    // Flat fields
    const flatFields = [
      // General
      "storeName", "supportEmail", "supportPhone", "storeAddress", "currency", "timezone",
      // Orders & Invoicing
      "invoicePrefix", "orderIdStartFrom", "gstNumber", "panNumber",
      // Shipping & Taxes
      "shippingThreshold", "shippingCost", "taxRatePercent",
      // Notifications
      "notifyAdminOnOrder", "adminNotificationEmail", "sendOrderConfirmationToCustomer",
      // Payments
      "codEnabled", "codExtraCharge", "minOrderValueForCOD",
      // Store Preferences
      "returnWindowDays", "lowStockThreshold",
      // System
      "maintenanceMode", "maintenanceMessage", "maintenanceBypassSecret",
      // Returns & Refunds
      "allowReturnOpened", "allowReturnUnopened", "requirePhotoForReturn",
      "adverseReactionReturnEnabled", "adverseReactionWindowDays", "refundMethod",
      // Cold Chain
      "fragilePackagingSurchargeEnabled", "fragilePackagingSurcharge", "showEstimatedDeliveryDate",
      "averageDeliveryDays", "pincodeCheckEnabled", "pincodeServiceabilitySource", "temperatureSensitiveWarningEnabled",
      // Skin Profile
      "skinQuizEnabled", "productCompatibilityWarningsEnabled", "storeSkinProfileOnAccount",
      // Reviews
      "reviewSkinTypeTaggingEnabled", "reviewBeforeAfterPhotosEnabled", "reviewVerifiedBadgeEnabled",
      "reviewIncentiveEnabled", "reviewIncentiveDiscountPercent", "reviewModerationEnabled"
    ];

    for (const field of flatFields) {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    }

    // Array fields
    if (Array.isArray(req.body.returnReasonTags)) {
      settings.returnReasonTags = req.body.returnReasonTags.filter(t => typeof t === "string" && t.trim());
    }
    if (Array.isArray(req.body.bestSellerPids)) {
      settings.bestSellerPids = req.body.bestSellerPids.filter(p => typeof p === "string" && p.trim());
    }

    // Nested fields
    if (req.body.announcementBar) {
      if (req.body.announcementBar.text !== undefined) settings.announcementBar.text = req.body.announcementBar.text;
      if (req.body.announcementBar.isActive !== undefined) settings.announcementBar.isActive = req.body.announcementBar.isActive;
      if (req.body.announcementBar.link !== undefined) settings.announcementBar.link = req.body.announcementBar.link;
    }

    if (req.body.socialLinks) {
      if (req.body.socialLinks.instagram !== undefined) settings.socialLinks.instagram = req.body.socialLinks.instagram;
      if (req.body.socialLinks.facebook !== undefined) settings.socialLinks.facebook = req.body.socialLinks.facebook;
      if (req.body.socialLinks.twitter !== undefined) settings.socialLinks.twitter = req.body.socialLinks.twitter;
      if (req.body.socialLinks.youtube !== undefined) settings.socialLinks.youtube = req.body.socialLinks.youtube;
    }

    if (req.body.seoMeta) {
      if (req.body.seoMeta.title !== undefined) settings.seoMeta.title = req.body.seoMeta.title;
      if (req.body.seoMeta.description !== undefined) settings.seoMeta.description = req.body.seoMeta.description;
      if (req.body.seoMeta.ogImage !== undefined) settings.seoMeta.ogImage = req.body.seoMeta.ogImage;
    }

    // Audit fields
    if (req.user && req.user.uid) {
      settings.lastUpdatedBy = req.user.uid;
    }
    settings.lastUpdatedAt = new Date();

    await settings.save();

    await logAction(req, "store_settings_updated", "settings", settings._id.toString(), {
      before,
      after: settings.toObject()
    });

    res.json({
      success: true,
      data: settings,
      message: "Store settings updated successfully"
    });
  } catch (err) {
    console.error("UpdateSettings Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
