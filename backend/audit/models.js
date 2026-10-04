import mongoose from "mongoose";

const auditLogV2Schema = new mongoose.Schema(
  {
    schema_version: { type: Number, default: 1 },
    event_id: { type: String, required: true, unique: true },
    // Single-field indexes removed — each was the prefix of a compound index below.
    event_type: { type: String, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", default: null },
    session_id: { type: String, default: null },
    timestamp_utc: { type: Date, default: Date.now },
    timestamp_ist: { type: String, required: true },
    environment: { type: String, enum: ["production", "staging", "development"], default: process.env.NODE_ENV || "development" },
    severity: { type: String, enum: ["INFO", "WARNING", "ERROR", "CRITICAL"], default: "INFO" },
    source_system: { type: String, enum: ["backend-api", "razorpay-webhook", "shiprocket-webhook", "frontend"], default: "backend-api" },
    correlation_id: { type: String, default: null },
    request_id: { type: String, default: null },
    network: {
      ip_address: { type: String, default: null },
      user_agent: { type: String, default: null },
      platform: { type: String, enum: ["mobile-web", "desktop-web", "ios", "android", "unknown"], default: "unknown" }
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    flags: {
      is_error: { type: Boolean, default: false },
      is_anomaly: { type: Boolean, default: false },
      is_pii_masked: { type: Boolean, default: true }
    }
  },
  { 
    timestamps: false, 
    collection: "audit_logs_v2" 
  }
);

// Compound indexes
auditLogV2Schema.index({ user_id: 1, timestamp_utc: -1 });
auditLogV2Schema.index({ correlation_id: 1, timestamp_utc: -1 });
auditLogV2Schema.index({ event_type: 1, "flags.is_anomaly": 1, timestamp_utc: -1 });
auditLogV2Schema.index({ event_type: 1, timestamp_utc: -1 });
auditLogV2Schema.index({ severity: 1, timestamp_utc: -1 });

// Plain time index — deliberately NOT a TTL. Audit logs are kept permanently (owner's
// requirement): never add expireAfterSeconds here. utils/indexMaintenance.js removes
// a TTL from this index if one exists on an older database.
auditLogV2Schema.index({ timestamp_utc: 1 });

const AuditLogV2 = mongoose.models.AuditLogV2 || mongoose.model("AuditLogV2", auditLogV2Schema);

export default AuditLogV2;
