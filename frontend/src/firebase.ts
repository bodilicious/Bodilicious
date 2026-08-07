import { initializeApp } from "firebase/app";
import {
    initializeAuth,
    indexedDBLocalPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
} from "firebase/auth";

// Warning: To run properly, replace these mock env defaults safely injected via Vite
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string
};

const app = initializeApp(firebaseConfig);

// initializeAuth() instead of getAuth(): getAuth() installs the default
// popupRedirectResolver, which loads Firebase's cross-origin auth iframe
// (…firebaseapp.com/__/auth/iframe.js, ~93 KB) on EVERY page load — it was the
// longest chain in the critical path even for signed-out visitors who never
// touch sign-in. Omitting the resolver here defers that download until a
// sign-in is actually attempted, where it's passed explicitly (see
// signInWithGoogle in AppContext).
//
// The persistence list mirrors the browser default getAuth() used
// (IndexedDB, falling back to localStorage), so existing sessions keep
// working and nobody gets signed out by this change.
export const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
export const googleProvider = new GoogleAuthProvider();
