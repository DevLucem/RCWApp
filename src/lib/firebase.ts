import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const globalWithFirebase = globalThis as any;

let app: FirebaseApp;
if (!globalWithFirebase.firebaseApp) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  globalWithFirebase.firebaseApp = app;
} else {
  app = globalWithFirebase.firebaseApp;
}

let db: Firestore;
if (!globalWithFirebase.firebaseDb) {
  db = getFirestore(app);
  globalWithFirebase.firebaseDb = db;
} else {
  db = globalWithFirebase.firebaseDb;
}

export { app, db };
