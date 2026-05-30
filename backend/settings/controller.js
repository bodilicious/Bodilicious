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

/**
 * PUT /api/v1/admin/settings
 * Update global store settings
 */
export const updateSettings = async (req, res) => {
  try {
    let settings = await StoreSettings.findOne();
    if (!settings) {
      settings = await StoreSettings.create({});
    }

    const {
      storeName,
      supportEmail,
      shippingThreshold,
      shippingCost,
      announcementBar,
      taxRatePercent
    } = req.body;

    const before = settings.toObject();

    if (storeName !== undefined) settings.storeName = storeName;
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    if (shippingThreshold !== undefined) settings.shippingThreshold = shippingThreshold;
    if (shippingCost !== undefined) settings.shippingCost = shippingCost;
    if (taxRatePercent !== undefined) settings.taxRatePercent = taxRatePercent;
    
    if (announcementBar) {
      if (announcementBar.text !== undefined) settings.announcementBar.text = announcementBar.text;
      if (announcementBar.isActive !== undefined) settings.announcementBar.isActive = announcementBar.isActive;
      if (announcementBar.link !== undefined) settings.announcementBar.link = announcementBar.link;
    }

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
