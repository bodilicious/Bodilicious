import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
    sourceModule: { type: String, required: true, trim: true },
    sourceModel: { type: String, default: null, trim: true },
    sourceId: { type: String, default: null },
    recipientRole: { type: String, default: "admin" },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientRole: 1, isRead: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
