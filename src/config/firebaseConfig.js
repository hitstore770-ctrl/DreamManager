import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDjVNEV0W6ejuHN-aXuU6NjpyUUnjPfGxM",
  authDomain: "givad-ceced.firebaseapp.com",
  projectId: "givad-ceced",
  storageBucket: "givad-ceced.firebasestorage.app",
  messagingSenderId: "860004540516",
  appId: "1:860004540516:web:aa13789edd08e6811d3f71",
  measurementId: "G-HD3SVYBT2N"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const isFirebaseConfigured = true;
