import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Normalize the private key regardless of how the env var was set:
// - Render/Vercel may store literal \n (escaped newline as text)
// - Some systems double-escape to \\n
// - Some add surrounding quotes
function parsePrivateKey(raw) {
  if (!raw) return undefined;
  return raw
    .replace(/^["']|["']$/g, "")   // strip surrounding quotes
    .replace(/\\\\n/g, "\n")        // double-escaped \\n → actual newline
    .replace(/\\n/g, "\n");         // single-escaped \n → actual newline
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "bodilicious-d38a3.appspot.com"
});

export default admin;
