import { EventEmitter } from "events";

export const liveEventEmitter = new EventEmitter();

// activeSessions maps a unique session/IP to a last-seen timestamp
const activeSessions = new Map();

// Cleanup stale sessions every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of activeSessions.entries()) {
    // 5 minutes TTL = 300,000 ms
    if (now - timestamp > 300000) {
      activeSessions.delete(key);
    }
  }
}, 10000);

export const trackActiveSession = (req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  activeSessions.set(ip, Date.now());
  next();
};

export const liveStreamHandler = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send an initial payload with current active sessions
  res.write(`data: ${JSON.stringify({ type: "SYNC", activeVisitors: activeSessions.size })}\n\n`);

  const onEvent = (data) => {
    // Inject the current active visitors count in every message just to keep it updated
    res.write(`data: ${JSON.stringify({ ...data, activeVisitors: activeSessions.size })}\n\n`);
  };

  liveEventEmitter.on("live_event", onEvent);

  req.on("close", () => {
    liveEventEmitter.removeListener("live_event", onEvent);
  });
};

export const emitLiveEvent = (type, metadata) => {
  liveEventEmitter.emit("live_event", { type, metadata, timestamp: new Date() });
};
