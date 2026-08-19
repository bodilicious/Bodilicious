import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// ⚠️ BANDWIDTH NOTE: firebase-admin makes two persistent outbound HTTP connections
// to Google's servers from process start, regardless of user activity:
//   1. googleapis.com — fetches JWT signing keys every ~5 minutes (key rotation)
//   2. oauth2.googleapis.com — refreshes service-account token every ~55 minutes
// This accounts for ~300 outbound HTTP calls/day and is expected/unavoidable with
// Firebase Auth. It is counted as "Service-Initiated" bandwidth on Render.
// There is no SDK option to disable these; they are required for token verification.

// Guard against accidental double-initialization (e.g. in test environments)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Unescape literal \n sequences and trim whitespace
    privateKey = privateKey.replace(/\\n/g, "\n").trim();
    // Strip wrapping single or double quotes if present
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1).replace(/\\n/g, "\n").trim();
    }
  }

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "bodilicious-d38a3.appspot.com"
      });
      console.log("[Firebase Admin] Initialized successfully.");
    } catch (err) {
      console.error("[Firebase Admin] Initialization failed:", err.message);
    }
  } else {
    console.warn(
      "[Firebase Admin] ⚠️ Firebase credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) not found or incomplete in .env. Auth verification will be disabled until configured."
    );
  }
}

export default admin;
