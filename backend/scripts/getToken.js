import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, getIdToken } from 'firebase/auth';
import dotenv from 'dotenv';
dotenv.config({ path: '../frontend/.env' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function getToken() {
  const email = process.argv[2];
  const password = process.argv[3];
  
  if(!email || !password) {
    console.error("Usage: node getToken.js <email> <password>");
    process.exit(1);
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await getIdToken(userCredential.user);
    console.log(token);
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}

getToken();
