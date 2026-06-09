import mongoose from "mongoose";

const userSessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile", default: null, index: true },
    start_time: { type: Date, required: true, default: Date.now },
    end_time: { type: Date, default: null },
    last_ping: { type: Date, required: true, default: Date.now },
    durationMs: { type: Number, default: 0 },
    network: {
      ip_address: { type: String, default: null },
      user_agent: { type: String, default: null }
    }
  },
  {
    timestamps: true,
    collection: "user_sessions"
  }
);

// Indexes
userSessionSchema.index({ user_id: 1, start_time: -1 });
// 6-month TTL for lightweight session history analytics
userSessionSchema.index({ start_time: -1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Static helper to cleanly resolve stale sessions at query time
userSessionSchema.statics.resolveStaleSessions = function(sessions) {
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  
  return sessions.map(session => {
    // If it has no explicit end time
    if (!session.end_time) {
      const pingAge = now - new Date(session.last_ping).getTime();
      // If the last ping was more than 5 minutes ago, consider it closed
      if (pingAge > STALE_THRESHOLD_MS) {
        session.end_time = session.last_ping;
        session.durationMs = new Date(session.last_ping).getTime() - new Date(session.start_time).getTime();
      }
    }
    return session;
  });
};

const UserSession = mongoose.models.UserSession || mongoose.model("UserSession", userSessionSchema);

export default UserSession;
