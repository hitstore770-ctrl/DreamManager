import { initializeApp } from "firebase/app";

// TODO: Replace these placeholder values with your actual Firebase project
// credentials (Firebase Console > Project Settings > General > Your apps).
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const app = initializeApp(firebaseConfig);

export default app;
