import StoreSettings from "./models.js";

let settingsCache = null;
let lastFetched = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const getSettings = async () => {
  const now = Date.now();
  if (settingsCache && (now - lastFetched < CACHE_TTL_MS)) {
    return settingsCache;
  }

  try {
    const settings = await StoreSettings.findOne().lean();
    if (settings) {
      settingsCache = settings;
      lastFetched = now;
      return settingsCache;
    }
  } catch (error) {
    console.error("[SettingsCache] Error fetching settings:", error);
  }

  // Fallback defaults if no document exists or error
  return {
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
};

export const clearSettingsCache = () => {
  settingsCache = null;
  lastFetched = 0;
  console.log("[SettingsCache] Cache cleared.");
};
