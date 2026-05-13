// src/ProtectedWrapper.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

export default function ProtectedWrapper({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out, object = signed in

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
    });
    return () => unsub();
  }, []);

  if (user === undefined) {
    return (
      <div
        className="flex items-center justify-center h-dvh w-full"
        style={{
          backgroundColor: "var(--app-bg)",
          color: "var(--app-text)",
        }}
      >
        <div
          className="rounded-2xl px-5 py-4 shadow-lg"
          style={{
            backgroundColor: "var(--app-surface)",
            border: "1px solid var(--app-border)",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  return children;
}
