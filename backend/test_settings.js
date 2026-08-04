import "dotenv/config";
import mongoose from "mongoose";
import { getSettings } from "./settings/cache.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const settings = await getSettings();
  console.log(JSON.stringify(settings, null, 2));
  await mongoose.disconnect();
}

run();
