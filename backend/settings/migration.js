import StoreSettings from "./models.js";

export const runSettingsMigration = async () => {
  try {
    const count = await StoreSettings.countDocuments();
    if (count === 0) {
      console.log("[SettingsMigration] No settings found. Creating default document...");
      await StoreSettings.create({});
      return;
    }

    // Settings exist, apply new flags via $set if missing (Mongoose strict schema handles default setting but sometimes we need to enforce it)
    const settings = await StoreSettings.findOne();
    if (settings) {
      let changed = false;
      
      const booleanFlags = [
        "waAllEnabled", "emailAllEnabled", 
        "waOrderPlacedEnabled", "waStaleCartEnabled", "waOutForDeliveryEnabled",
        "waTicketRaisedEnabled", "waTicketResolvedEnabled", "waTrendingProductsEnabled", 
        "waReEngagementEnabled", "waPaymentFailureEnabled",
        "emailReturnApproved", "emailReturnRejected", "emailTicketRaised",
        "emailTicketReply", "emailTicketResolved", "emailTicketCancelled"
      ];

      for (const flag of booleanFlags) {
        if (settings[flag] === undefined) {
          settings[flag] = true;
          changed = true;
        }
      }

      if (changed) {
        await settings.save();
        console.log("[SettingsMigration] Applied missing notification flags to StoreSettings.");
      }
    }
  } catch (error) {
    console.error("[SettingsMigration] Failed to run migration:", error);
  }
};
