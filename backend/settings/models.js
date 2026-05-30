import mongoose from "mongoose";

const storeSettingsSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: "Bodilicious",
    },
    supportEmail: {
      type: String,
      default: "support@bodilicious.in",
    },
    shippingThreshold: {
      type: Number,
      default: 999,
    },
    shippingCost: {
      type: Number,
      default: 99,
    },
    announcementBar: {
      text: { type: String, default: "" },
      isActive: { type: Boolean, default: false },
      link: { type: String, default: "" },
    },
    taxRatePercent: {
      type: Number,
      default: 18,
    }
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
