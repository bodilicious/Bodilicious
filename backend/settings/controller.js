import StoreSettings from "./models.js";
import HomepageContent from "./homepageModel.js";
import { COUNTRIES } from "../utils/countries.js";
import { logAction } from "../admin/controller.js";
import { clearSettingsCache } from "./cache.js";

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

    // Determine country code from Cloudflare header, fallback to 'IN'
    const cfCountry = req.headers['cf-ipcountry'];
    const detectedCountryCode = cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1' 
        ? cfCountry 
        : 'IN';

    // Check for stale exchange rate (> 48 hours)
    if (settings.exchangeRatesLastUpdated) {
        const msSinceUpdate = Date.now() - new Date(settings.exchangeRatesLastUpdated).getTime();
        if (msSinceUpdate > 48 * 60 * 60 * 1000) {
            console.warn(`[WARNING] Exchange Rates are stale! Last updated: ${settings.exchangeRatesLastUpdated}`);
        }
    } else {
        console.warn("[WARNING] Exchange Rates have never been updated.");
    }

    res.json({
      success: true,
      data: {
        storeName: settings.storeName,
        supportEmail: settings.supportEmail,
        shippingThreshold: settings.shippingThreshold,
        shippingCost: settings.shippingCost,
        announcementBar: settings.announcementBar,
        launchModal: settings.launchModal,
        maintenanceMode: req.query.bypass === settings.maintenanceBypassSecret ? false : settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        bestSellerPids: settings.bestSellerPids || [],
        internationalShippingEnabled: settings.internationalShippingEnabled,
        internationalCheckoutEnabled: settings.internationalCheckoutEnabled,
        internationalShippingCost: settings.internationalShippingCost,
        internationalShippingThreshold: settings.internationalShippingThreshold,
        supportedCountries: settings.supportedCountries || COUNTRIES,
        reviewSkinTypeTaggingEnabled: settings.reviewSkinTypeTaggingEnabled ?? true,
        reviewBeforeAfterPhotosEnabled: settings.reviewBeforeAfterPhotosEnabled ?? true,
        reviewVerifiedBadgeEnabled: settings.reviewVerifiedBadgeEnabled ?? true,
        reviewIncentiveEnabled: settings.reviewIncentiveEnabled ?? false,
        reviewIncentiveDiscountPercent: settings.reviewIncentiveDiscountPercent ?? 10,
        reviewModerationEnabled: settings.reviewModerationEnabled ?? true,
        autoCurrencySwitchingEnabled: settings.autoCurrencySwitchingEnabled ?? true,
        detectedCountryCode,
        usdExchangeRate: settings.usdExchangeRate || 83.5,
        exchangeRates: settings.exchangeRates || {},
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
      "waAllEnabled", "emailAllEnabled", "waOrderPlacedEnabled", "waStaleCartEnabled",
      "waOutForDeliveryEnabled", "waTicketRaisedEnabled", "waTicketResolvedEnabled",
      "waTrendingProductsEnabled", "waReEngagementEnabled", "waPaymentFailureEnabled",
      "emailReturnApproved", "emailReturnRejected", "emailTicketRaised",
      "emailTicketReply", "emailTicketResolved", "emailTicketCancelled",
      // Payments
      "codEnabled", "codExtraCharge", "minOrderValueForCOD",
      // Store Preferences
      "returnWindowDays", "lowStockThreshold",
      // System
      "maintenanceMode", "maintenanceMessage", "maintenanceBypassSecret",
      // Returns & Refunds
      "allowReturnOpened", "allowReturnUnopened", "requirePhotoForReturn",
      "adverseReactionReturnEnabled", "adverseReactionWindowDays", "refundMethod",
      // Cold Chain & International
      "fragilePackagingSurchargeEnabled", "fragilePackagingSurcharge", "showEstimatedDeliveryDate",
      "averageDeliveryDays", "pincodeCheckEnabled", "pincodeServiceabilitySource", "temperatureSensitiveWarningEnabled",
      "internationalShippingEnabled", "internationalCheckoutEnabled", "autoCurrencySwitchingEnabled", "internationalShippingCost", "internationalShippingThreshold",
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
    if (Array.isArray(req.body.supportedCountries)) {
      settings.supportedCountries = req.body.supportedCountries.filter(c => typeof c === "string" && c.trim());
    }

    // Nested fields
    if (req.body.announcementBar) {
      if (req.body.announcementBar.text !== undefined) settings.announcementBar.text = req.body.announcementBar.text;
      if (req.body.announcementBar.isActive !== undefined) settings.announcementBar.isActive = req.body.announcementBar.isActive;
      if (req.body.announcementBar.link !== undefined) settings.announcementBar.link = req.body.announcementBar.link;
    }

    if (req.body.launchModal) {
      const lm = req.body.launchModal;
      if (lm.isActive    !== undefined) settings.launchModal.isActive    = lm.isActive;
      if (lm.badge       !== undefined) settings.launchModal.badge       = lm.badge;
      if (lm.title       !== undefined) settings.launchModal.title       = lm.title;
      if (lm.description !== undefined) settings.launchModal.description = lm.description;
      if (lm.ctaLabel    !== undefined) settings.launchModal.ctaLabel    = lm.ctaLabel;
      if (lm.ctaLink     !== undefined) settings.launchModal.ctaLink     = lm.ctaLink;
      if (lm.image       !== undefined) settings.launchModal.image       = lm.image;
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

    clearSettingsCache();

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

// ------------------------------------------------------------------
// HOMEPAGE CONTENT BUILDER
// ------------------------------------------------------------------
import sanitizeHtml from "sanitize-html";

const sanitizeOptions = {
  allowedTags: [], // Strip all HTML tags
  allowedAttributes: {}
};

const sanitizeContent = (data, keyName = '') => {
  // Do not sanitize URL fields to prevent &amp; encoding from destroying query parameters
  if (typeof data === 'string') {
    const isUrlField = ['url', 'link', 'imageUrl', 'ctaLink', 'videoUrl', 'src'].includes(keyName);
    if (isUrlField || data.startsWith('http://') || data.startsWith('https://')) {
      return data;
    }
    const sanitized = sanitizeHtml(data, sanitizeOptions);
    return sanitized
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeContent(item, keyName));
  }
  if (data && typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = sanitizeContent(value, key);
    }
    return cleaned;
  }
  return data;
};

export const getHomepageContent = async (req, res) => {
  try {
    const content = await HomepageContent.findOne();
    if (!content) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: content.published });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getHomepageDraft = async (req, res) => {
  try {
    let content = await HomepageContent.findOneAndUpdate(
      {},
      { $setOnInsert: { draft: { status: 'draft' }, published: { status: 'published' } } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: content.draft });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateHomepageDraft = async (req, res) => {
  try {
    let content = await HomepageContent.findOneAndUpdate(
      {},
      { $setOnInsert: { draft: { status: 'draft' }, published: { status: 'published' } } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Sanitize input
    const sanitizedBody = sanitizeContent(req.body);

    const existingDraft = content.draft ? (typeof content.draft.toObject === 'function' ? content.draft.toObject() : content.draft) : {};
    content.draft = {
      ...existingDraft,
      ...sanitizedBody,
      status: 'draft',
      updatedAt: new Date(),
      updatedBy: req.user ? req.user.uid : null
    };

    await content.save();
    res.json({ success: true, data: content.draft });
  } catch (err) {
    console.error("UpdateHomepageDraft Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const publishHomepageContent = async (req, res) => {
  try {
    const content = await HomepageContent.findOne();
    if (!content) {
      return res.status(404).json({ success: false, message: "No content to publish" });
    }

    if (!content.draft) {
       return res.status(400).json({ success: false, message: "Draft is empty" });
    }

    const version = (content.published && content.published.version ? content.published.version : 0) + 1;

    const draftObj = typeof content.draft.toObject === 'function' ? content.draft.toObject() : { ...content.draft };
    content.published = {
      ...draftObj,
      status: 'published',
      publishedAt: new Date(),
      updatedBy: req.user ? req.user.uid : null,
      version
    };

    await content.save();
    
    // Log action
    if (req.user) {
      await logAction(req, "homepage_published", "settings", content._id.toString(), { version });
    }

    res.json({ success: true, data: content.published });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const revertHomepageDraft = async (req, res) => {
  try {
    const content = await HomepageContent.findOne();
    if (!content) {
      return res.status(404).json({ success: false, message: "No content found" });
    }

    const existingPublished = content.published ? (typeof content.published.toObject === 'function' ? content.published.toObject() : content.published) : {};
    content.draft = {
      ...existingPublished,
      status: 'draft',
      updatedAt: new Date()
    };

    await content.save();
    res.json({ success: true, data: content.draft });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
