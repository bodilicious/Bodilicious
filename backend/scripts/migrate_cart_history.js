import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "path";

// Support running from backend/scripts or backend/
dotenv.config({ path: resolve(process.cwd(), "../.env") });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: resolve(process.cwd(), ".env") });
}

import "../audit/models.js";
import "../profile/models.js";

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("No MONGO_URI found in environment.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const AuditLogV2 = mongoose.model("AuditLogV2");
  const UserProfile = mongoose.model("UserProfile");

  // Aggregate cart adds per user per product
  console.log("Aggregating historical CART_ITEM_ADDED events...");
  const adds = await AuditLogV2.aggregate([
    { $match: { event_type: "CART_ITEM_ADDED" } },
    {
      $group: {
        _id: { user_id: "$user_id", product_id: "$metadata.targetId" },
        count: { $sum: { $toInt: "$metadata.quantity_added" } },
        lastAddedAt: { $max: "$timestamp_utc" }
      }
    }
  ]);

  console.log(`Found ${adds.length} unique user-product cart additions.`);

  const bulkOps = [];
  const userAdds = {};

  // Group by user
  for (const add of adds) {
    if (!add._id.product_id || !mongoose.isValidObjectId(add._id.product_id)) continue;
    if (!add._id.user_id || !mongoose.isValidObjectId(add._id.user_id)) continue;
    
    if (!userAdds[add._id.user_id]) userAdds[add._id.user_id] = [];
    userAdds[add._id.user_id].push({
      product: new mongoose.Types.ObjectId(add._id.product_id),
      count: add.count || 1, // fallback if quantity_added was missing
      lastAddedAt: add.lastAddedAt
    });
  }

  for (const [userId, items] of Object.entries(userAdds)) {
    bulkOps.push({
      updateOne: {
        filter: { _id: userId },
        update: { $set: { lifetimeCartAdds: items } }
      }
    });
  }

  if (bulkOps.length > 0) {
    console.log(`Executing bulkWrite for ${bulkOps.length} user profiles...`);
    const res = await UserProfile.bulkWrite(bulkOps);
    console.log(`Updated ${res.modifiedCount} user profiles.`);
  } else {
    console.log("No data to migrate.");
  }

  await mongoose.disconnect();
  console.log("Migration complete.");
};

run().catch(console.error);
