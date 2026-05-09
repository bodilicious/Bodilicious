import mongoose from "mongoose";

const stockHistorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    delta: { type: Number, required: true }, // positive = stock added, negative = stock removed
    beforeStock: { type: Number, required: true },
    afterStock: { type: Number, required: true },
    reason: {
      type: String,
      required: true,
      enum: [
        "po_receipt",
        "manual_adjustment",
        "order_placed",
        "order_cancelled",
      ],
    },
    sourceModule: {
      type: String,
      required: true,
      enum: ["procurement", "orders", "admin"],
    },
    sourceId: { type: String, default: null }, // PO ID, order ID, etc.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Immutable — never allow updates after insert (enforced in service layer)
stockHistorySchema.index({ product: 1, createdAt: -1 });
stockHistorySchema.index({ sourceModule: 1, sourceId: 1 });

const StockHistory =
  mongoose.models.StockHistory ||
  mongoose.model("StockHistory", stockHistorySchema);

export default StockHistory;
