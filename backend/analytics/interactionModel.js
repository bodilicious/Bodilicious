import mongoose from "mongoose";

const userInteractionLogSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "UserProfile", 
      required: true,
      index: true
    },
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product", 
      required: true,
      index: true
    },
    eventType: {
      type: String,
      enum: ["view", "cart_add", "cart_remove"],
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      default: null // Only used for cart_add / cart_remove
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { 
    timestamps: true,
    collection: "analytics_interaction_logs"
  }
);

// Compound index for user activity timeline
userInteractionLogSchema.index({ userId: 1, createdAt: -1 });

export const UserInteractionLog = mongoose.models.UserInteractionLog || mongoose.model("UserInteractionLog", userInteractionLogSchema);
export default UserInteractionLog;
