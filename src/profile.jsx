// src/Profile.jsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, LogIn, LogOut, User, Facebook, Chrome, Sun, Moon } from "lucide-react";

import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "./firebase";

import { translations } from "./translations";

export default function Profile({
  selectedLanguage,
  onLanguageChange,
  onLoginSuccess,
  theme: propTheme,
  onThemeChange,
}) {
  const t = translations[selectedLanguage] || translations.en;

  const [user, setUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Keep an internal theme so the component updates instantly when toggled,
  // while still honoring the parent theme prop if provided.
  const initialLocal = (() => {
    if (typeof propTheme === "string") return propTheme;
    try {
      const stored = localStorage.getItem("theme");
      if (stored) return stored;
    } catch {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  })();

  const [localTheme, setLocalTheme] = useState(initialLocal);

  // When parent prop changes, sync localTheme so UI stays consistent
  useEffect(() => {
    if (typeof propTheme === "string" && propTheme !== localTheme) {
      setLocalTheme(propTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propTheme]);

  // Effective theme used by this component
  const effectiveTheme = typeof propTheme === "string" ? propTheme : localTheme;
  const isDark = effectiveTheme === "dark";

  // Ensure <html>.dark is synced for Tailwind dark: utilities and persist to localStorage.
  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", effectiveTheme);
    } catch (e) {
      // ignore storage errors
    }
  }, [effectiveTheme, isDark]);

  // 🔹 Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && onLoginSuccess) {
        onLoginSuccess();
      }
    });
    return () => unsub();
  }, [onLoginSuccess]);

  // 🔹 Email / password login or signup
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  // 🔹 Google login
  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  // 🔹 Facebook login
  const handleFacebook = async () => {
    setError("");
    try {
      await signInWithPopup(auth, new FacebookAuthProvider());
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  // 🔹 Sign out
  const handleSignOut = async () => {
    await signOut(auth);
    setShowSignOutConfirm(false);
  };

  // 🔹 Toggle Theme
  const toggleTheme = () => {
    const current = effectiveTheme || "light";
    const next = current === "light" ? "dark" : "light";

    // Inform parent if available (preferred) so app root can react
    if (typeof onThemeChange === "function") {
      try {
        onThemeChange(next);
      } catch (e) {
        // ignore parent errors
      }
    }

    // Also update local theme immediately so the Profile UI flips without waiting
    setLocalTheme(next);

    // Keep <html> class in sync in case parent doesn't handle it for some reason
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  };

  // Styling helpers for immediate inline fallback (ensures correct colours even if Tailwind classes are missed)
  const rootBg = isDark ? "#0f172a" : "#f8fafc";
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const textColor = isDark ? "#e2e8f0" : "#1e293b";
  const inputBg = isDark ? "#334155" : "#f1f5f9";
  const borderColor = isDark ? "#475569" : "#e2e8f0";

  return (
    <div
      className="w-full min-h-screen flex justify-center items-start pt-10 pb-20 overflow-y-auto bg-gradient-to-br transition-colors duration-300"
      style={{ 
        background: isDark 
          ? "radial-gradient(ellipse at top, #0f172a, #020617)" 
          : "radial-gradient(ellipse at top, #f0f9ff, #e0f2fe)" 
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md shadow-xl rounded-2xl p-8 flex flex-col gap-8 backdrop-blur-sm border mx-4"
        style={{ 
          background: cardBg,
          borderColor: borderColor,
          boxShadow: isDark 
            ? "0 10px 40px -10px rgba(2, 6, 23, 0.5)" 
            : "0 10px 40px -10px rgba(0, 0, 0, 0.1)"
        }}
      >
        {/* Header with logo - Only shown for non-logged in state */}
        {!user && (
          <div className="flex flex-col items-center gap-2">
            <motion.div 
              className="p-3 rounded-full"
              style={{ background: isDark ? "#2563eb20" : "#dbeafe" }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <User className="h-8 w-8" style={{ color: isDark ? "#3b82f6" : "#2563eb" }} />
            </motion.div>
            <h1 className="text-2xl font-bold" style={{ color: textColor }}>
              {isSignUp ? t.createAccount : t.signIn}
            </h1>
          </div>
        )}

        <AnimatePresence mode="wait">
          {user ? (
            <motion.div
              key="logged-in"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-20 w-20 rounded-full flex items-center justify-center border-4" 
                  style={{ 
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    background: isDark ? "#1e293b" : "#f8fafc"
                  }}
                >
                  <User className="h-10 w-10" style={{ color: isDark ? "#3b82f6" : "#2563eb" }} />
                </div>
                <h2 className="text-xl font-semibold" style={{ color: textColor }}>
                  {t.welcome || "Welcome"}, {user.displayName || user.email}
                </h2>
                <p className="text-sm opacity-75" style={{ color: textColor }}>
                  {user.email}
                </p>
              </div>

              <div className="space-y-6">
                {/* Language Selector */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: isDark ? "#cbd5e1" : "#64748b" }}>
                    {t.appLanguage}
                  </label>
                  <div className="relative">
                    <select
                      className="w-full border rounded-xl p-3 pl-4 appearance-none focus:ring-2 focus:outline-none transition-all"
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                      style={{
                        background: inputBg,
                        color: textColor,
                        borderColor: borderColor,
                      }}
                    >
                      <option value="en">English</option>
                      <option value="hi">हिंदी</option>
                      <option value="gu">ગુજરાતી</option>
                      <option value="mr">मराठी</option>
                      <option value="pa">ਪੰਜਾਬੀ</option>
                      <option value="raj">राजस्थानी</option>
                      <option value="ur">اُردُو</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <svg className="h-5 w-5" style={{ color: textColor }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Theme Toggle */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium" style={{ color: isDark ? "#cbd5e1" : "#64748b" }}>
                    App Theme
                  </label>
                  <motion.button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-3 rounded-xl border transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      background: isDark ? "#334155" : "#f1f5f9",
                      borderColor: borderColor,
                      color: textColor,
                    }}
                  >
                    <span className="flex items-center">
                      {isDark ? (
                        <>
                          <Moon className="h-5 w-5 mr-2" /> Dark Mode
                        </>
                      ) : (
                        <>
                          <Sun className="h-5 w-5 mr-2" /> Light Mode
                        </>
                      )}
                    </span>
                    <div className={`h-6 w-11 rounded-full relative p-1 flex items-center ${isDark ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'}`}>
                      <div className="h-4 w-4 rounded-full bg-white"></div>
                    </div>
                  </motion.button>
                </div>

                {/* Profile actions */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    className="py-2.5 px-4 rounded-xl transition-all border text-sm font-medium"
                    whileHover={{ y: -2 }}
                    style={{
                      borderColor: borderColor,
                      background: isDark ? "#334155" : "#f8fafc",
                      color: textColor,
                    }}
                  >
                    {t.viewProfile}
                  </motion.button>
                  <motion.button
                    className="py-2.5 px-4 rounded-xl transition-all border text-sm font-medium"
                    whileHover={{ y: -2 }}
                    style={{
                      borderColor: borderColor,
                      background: isDark ? "#334155" : "#f8fafc",
                      color: textColor,
                    }}
                  >
                    {t.updatePassword}
                  </motion.button>
                </div>
              </div>

              {/* Sign out */}
              <div className="mt-4">
                <motion.button
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full flex items-center justify-center rounded-xl py-3 transition-all font-medium gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  <LogOut className="h-5 w-5" /> {t.signOut || "Sign Out"}
                </motion.button>

                <AnimatePresence>
                  {showSignOutConfirm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-4 rounded-xl text-center space-y-3 overflow-hidden"
                      style={{
                        background: isDark ? "#7f1d1d20" : "#fef2f2",
                        border: `1px solid ${isDark ? "#7f1d1d40" : "#fecaca"}`,
                        color: isDark ? "#fecaca" : "#dc2626",
                      }}
                    >
                      <p className="font-medium">{t.logoutConfirm}</p>
                      <div className="flex justify-center gap-3">
                        <motion.button
                          onClick={handleSignOut}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{ background: "#dc2626", color: "#fff" }}
                        >
                          {t.yes}
                        </motion.button>
                        <motion.button
                          onClick={() => setShowSignOutConfirm(false)}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium border"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            background: isDark ? "#334155" : "#f8fafc",
                            borderColor: borderColor,
                            color: textColor,
                          }}
                        >
                          {t.cancel}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
                <div className="space-y-1">
                  <div className="flex items-center rounded-xl px-4 py-3 border transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent" 
                    style={{ 
                      background: inputBg, 
                      borderColor: borderColor,
                    }}
                  >
                    <Mail className="h-5 w-5 mr-3" style={{ color: isDark ? "#94a3b8" : "#64748b" }} />
                    <input
                      type="email"
                      placeholder="Email"
                      className="flex-1 bg-transparent outline-none placeholder-opacity-70"
                      style={{ color: textColor }}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center rounded-xl px-4 py-3 border transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent" 
                    style={{ 
                      background: inputBg, 
                      borderColor: borderColor,
                    }}
                  >
                    <Lock className="h-5 w-5 mr-3" style={{ color: isDark ? "#94a3b8" : "#64748b" }} />
                    <input
                      type="password"
                      placeholder="Password"
                      className="flex-1 bg-transparent outline-none placeholder-opacity-70"
                      style={{ color: textColor }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm p-3 rounded-lg text-center"
                    style={{ background: isDark ? "#7f1d1d30" : "#fef2f2", color: "#ef4444" }}
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  type="submit"
                  className="w-full flex items-center justify-center rounded-xl py-3.5 transition-all font-medium gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ background: "#3b82f6", color: "#fff" }}
                >
                  <LogIn className="h-5 w-5" />
                  {isSignUp ? t.signUp : t.signIn}
                </motion.button>
              </form>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t" style={{ borderColor: borderColor }}></div>
                <span className="flex-shrink mx-4 text-sm" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                  Or continue with
                </span>
                <div className="flex-grow border-t" style={{ borderColor: borderColor }}></div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={handleGoogle}
                  className="flex-1 flex items-center justify-center rounded-xl py-3 transition-all border font-medium gap-2"
                  whileHover={{ y: -2 }}
                  style={{
                    background: isDark ? "#334155" : "#f8fafc",
                    borderColor: borderColor,
                    color: textColor,
                  }}
                >
                  <Chrome className="h-5 w-5" /> Google
                </motion.button>
                <motion.button
                  onClick={handleFacebook}
                  className="flex-1 flex items-center justify-center rounded-xl py-3 transition-all font-medium gap-2"
                  whileHover={{ y: -2 }}
                  style={{ background: "#1877F2", color: "#fff" }}
                >
                  <Facebook className="h-5 w-5" /> Facebook
                </motion.button>
              </div>

              <p className="text-center mt-2 text-sm" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}{" "}
                <button 
                  onClick={() => setIsSignUp(!isSignUp)} 
                  className="font-semibold underline underline-offset-2 transition-colors"
                  style={{ color: isDark ? "#3b82f6" : "#2563eb" }}
                >
                  {isSignUp ? t.signIn : t.signUp}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}