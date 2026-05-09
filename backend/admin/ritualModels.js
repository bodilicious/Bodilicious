import mongoose from "mongoose";

const ritualResponseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    focusArea: {
      type: String,
      default: null,
    },
    skinType: {
      type: String,
      default: null,
    },
    concerns: {
      type: [String],
      default: [],
    },
    goal: {
      type: String,
      default: null,
    },
    routineTime: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["started", "completed", "viewed_recommendations", "placed_order"],
      default: "started",
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  { timestamps: true }
);

ritualResponseSchema.index({ createdAt: -1 });

const RitualResponse =
  mongoose.models.RitualResponse ||
  mongoose.model("RitualResponse", ritualResponseSchema);

export default RitualResponse;
