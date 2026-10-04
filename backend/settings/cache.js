import StoreSettings from "./models.js";

let settingsCache = null;
let lastFetched = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const getSettings = async () => {
  const now = Date.now();
  if (settingsCache && (now - lastFetched < CACHE_TTL_MS)) {
    return settingsCache;
  }

  // Base default values
  const defaultSettings = {
    waAllEnabled: true,
    emailAllEnabled: true,
    waOrderPlacedEnabled: true,
    waStaleCartEnabled: true,
    waOutForDeliveryEnabled: true,
    waTicketRaisedEnabled: true,
    waTicketResolvedEnabled: true,
    waTrendingProductsEnabled: true,
    waReEngagementEnabled: true,
    waPaymentFailureEnabled: true,
    notifyAdminOnOrder: true,
    sendOrderConfirmationToCustomer: true,
    emailReturnApproved: true,
    emailReturnRejected: true,
    emailTicketRaised: true,
    emailTicketReply: true,
    emailTicketResolved: true,
    emailTicketCancelled: true,
  };

  try {
    // Not .lean(): lean results skip schema defaults, so any setting added to the
    // schema after the settings document was created read as `undefined` here —
    // while the admin panel and the public settings endpoint (hydrated documents)
    // showed its default. E.g. reviewModerationEnabled displayed "on" but the server
    // behaved as "off". flattenMaps keeps Map fields as plain objects, as lean did.
    const doc = await StoreSettings.findOne();
    const settings = doc ? doc.toObject({ flattenMaps: true }) : null;
    if (settings) {
      settingsCache = { ...defaultSettings, ...settings };
      lastFetched = now;
      return settingsCache;
    }
  } catch (error) {
    console.error("[SettingsCache] Error fetching settings:", error);
  }

  // Fallback defaults if no document exists or error
  return defaultSettings;
};

export const clearSettingsCache = () => {
  settingsCache = null;
  lastFetched = 0;
  console.log("[SettingsCache] Cache cleared.");
};
