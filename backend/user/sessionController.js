import UserSession from "../audit/sessionModel.js";
import UserProfile from "../profile/models.js";

/**
 * POST /api/v1/user/session/start
 * Starts a new session
 */
export const startSession = async (req, res) => {
  try {
    const { session_id, network } = req.body;
    if (!session_id) return res.status(400).json({ success: false, message: "session_id is required" });

    // Use token-derived user_id if present
    const user_id = req.user ? req.user._id : null;

    const newSession = await UserSession.findOneAndUpdate(
      { session_id },
      {
        $setOnInsert: { start_time: new Date() },
        $set: {
          user_id,
          last_ping: new Date(),
          network: {
            ip_address: network?.ip_address || req.ip,
            user_agent: network?.user_agent || req.headers["user-agent"]
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (user_id) {
      await UserProfile.findByIdAndUpdate(user_id, { $inc: { lifetimeSessions: 1 } });
    }

    res.json({ success: true, data: newSession });
  } catch (err) {
    console.error("StartSession Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/user/session/ping
 * Updates last_ping for a session
 */
export const pingSession = async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ success: false, message: "session_id is required" });

    const updated = await UserSession.findOneAndUpdate(
      { session_id },
      { $set: { last_ping: new Date() } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Session not found" });
    
    // Send 204 No Content for lightweight pings
    res.status(204).send();
  } catch (err) {
    console.error("PingSession Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/user/session/end
 * Ends a session explicitly
 */
export const endSession = async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ success: false, message: "session_id is required" });

    const session = await UserSession.findOne({ session_id });
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const end_time = new Date();
    const durationMs = end_time.getTime() - new Date(session.start_time).getTime();

    session.end_time = end_time;
    session.last_ping = end_time;
    session.durationMs = durationMs;

    await session.save();

    res.status(204).send();
  } catch (err) {
    console.error("EndSession Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
