import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: false,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: false,
      index: true,
    },
    action: {
      type: String, // e.g. "stock_manual_edit", "order_status_update", "order_placed", "new_customer"
      required: true,
      index: true,
    },
    targetType: {
      type: String, // "product" | "order" | "user"
      default: null,
    },
    targetId: {
      type: String,
      default: null,
    },
    // Legacy fields (kept for backward compat)
    entity: { type: String, default: null },
    entityId: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed },
    // New structured fields
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    meta: {
      reason: { type: String, default: null }, 
      source: { 
        type: String, 
        enum: ["admin", "customer", "system", "shiprocket", "payment_gateway"],
        default: "admin" 
      },
    },
    ip: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
