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
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/^['"']|['"']$/g, "")
        : undefined,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "bodilicious-d38a3.appspot.com"
  });
}

export default admin;
