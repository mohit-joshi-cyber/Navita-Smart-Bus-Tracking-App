// src/ProtectedWrapper.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Profile from "./profile";

export default function ProtectedWrapper({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  if (user === undefined) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    // Show only the Profile (login/signup) screen if not logged in
    return <Profile />;
  }

  // Authenticated — show the app UI
  return children;
}
