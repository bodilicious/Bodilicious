import mongoose from "mongoose";

const userInteractionLogSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "UserProfile",
      required: true
    },
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product",
      required: true
    },
    eventType: {
      type: String,
      enum: ["view", "cart_add", "cart_remove"],
      required: true
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

// Kept permanently (owner's requirement — no TTL). Nothing in the app queries this
// collection yet, so it carries no secondary indexes: the four it had were
// rewritten on every product view / cart change for no reader. Add a query index
// alongside the first feature that reads it.

export const UserInteractionLog = mongoose.models.UserInteractionLog || mongoose.model("UserInteractionLog", userInteractionLogSchema);
export default UserInteractionLog;
