// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // <-- ADD THIS

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "your credentials ",
  authDomain: "your credentials",
  projectId: "your credentials",
  storageBucket: "your credentials",
 
  appId: "your credentials",
  measurementId: "your credentials"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Auth
export const auth = getAuth(app);
