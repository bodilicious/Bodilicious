import mongoose from "mongoose";
import dotenv from "dotenv";
import UserSession from "../audit/sessionModel.js";

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  console.log("=== Testing UserSession Logic ===");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB.");

  try {
    const sessionId = `test-session-${Date.now()}`;
    
    // 1. Test /start simulation
    const session = await UserSession.create({
      session_id: sessionId,
      user_id: new mongoose.Types.ObjectId(),
      start_time: new Date(),
      last_ping: new Date()
    });
    console.log("✅ Session Start created:", session.session_id);

    // 2. Test /ping simulation
    const pingedSession = await UserSession.findOneAndUpdate(
      { session_id: sessionId },
      { $set: { last_ping: new Date(Date.now() + 60000) } }, // +1 min
      { new: true }
    );
    console.log("✅ Session Ping updated last_ping:", pingedSession.last_ping);

    // 3. Test Query-time Stale Cleanup
    // Simulate a crashed session where last_ping was 6 minutes ago
    const crashedSessionId = `test-crash-${Date.now()}`;
    const sixMinsAgo = new Date(Date.now() - 6 * 60000);
    const tenMinsAgo = new Date(Date.now() - 10 * 60000);
    
    await UserSession.create({
      session_id: crashedSessionId,
      start_time: tenMinsAgo,
      last_ping: sixMinsAgo
    });

    const rawSessions = await UserSession.find({ session_id: { $in: [sessionId, crashedSessionId] } }).lean();
    const resolvedSessions = UserSession.resolveStaleSessions(rawSessions);

    const resolvedCrash = resolvedSessions.find(s => s.session_id === crashedSessionId);
    if (resolvedCrash.end_time && resolvedCrash.durationMs === 4 * 60000) {
      console.log("✅ Stale session cleanup resolved correctly. Duration:", resolvedCrash.durationMs, "ms");
    } else {
      console.error("❌ Stale session cleanup failed.", resolvedCrash);
    }

    // 4. Test /end simulation
    const endSession = await UserSession.findOne({ session_id: sessionId });
    const endTime = new Date(endSession.start_time.getTime() + 120000); // +2 mins
    endSession.end_time = endTime;
    endSession.durationMs = endTime.getTime() - endSession.start_time.getTime();
    await endSession.save();

    console.log("✅ Session End updated correctly. Duration:", endSession.durationMs, "ms");

    // Cleanup
    await UserSession.deleteMany({ session_id: { $in: [sessionId, crashedSessionId] } });
    console.log("✅ Test data cleaned up.");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

runTests();
