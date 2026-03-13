// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // <-- ADD THIS

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAagfZMlddjvvE_oV2rNU5p1tVzqUNuP_A",
  authDomain: "navita-log.firebaseapp.com",
  projectId: "navita-log",
  storageBucket: "navita-log.firebasestorage.app",
  messagingSenderId: "841720523317",
  appId: "1:841720523317:web:eb59ad453b40b28cb19f7c",
  measurementId: "G-MQW93XNGED"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Auth
export const auth = getAuth(app);
