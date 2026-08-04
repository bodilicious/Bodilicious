import "dotenv/config";
import mongoose from "mongoose";
import StoreSettings from "./settings/models.js";
import { clearSettingsCache } from "./settings/cache.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const settings = await StoreSettings.findOne();
  if (settings) {
    settings.internationalShippingEnabled = true;
    settings.internationalCheckoutEnabled = true;
    await settings.save();
    
    // Clear in-memory cache
    clearSettingsCache();
    
    console.log("International shipping and checkout have been enabled.");
  } else {
    console.log("No settings found.");
  }
  
  await mongoose.disconnect();
}

run();
