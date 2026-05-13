// src/profile.jsx

import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

import {
  LogIn,
  LogOut,
  Sun,
  Moon,
  Eye,
  EyeOff,
  WifiOff,
  Mail,
  Lock,
  Globe,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  Trash2,
  MessageSquare,
  Heart,
} from "lucide-react";

import {
  onAuthStateChanged,
  onIdTokenChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  deleteUser,
} from "firebase/auth";

import { auth } from "./firebase";
import { translations } from "./translations";

const Lottie = lazy(() => import("lottie-react"));
import busAnimation from "./assets/bus.json";

// ─────────────────────────────────────────────────────────────────────────────
// Industrial error mapping — no raw Firebase messages exposed to users
// ─────────────────────────────────────────────────────────────────────────────
const parseError = (err) => {
  const code = err?.code || "";
  const msg = err?.message || "";

  if (code.includes("auth/invalid-email")) return "Invalid email address.";
  if (code.includes("auth/user-not-found")) return "No account found with this email.";
  if (code.includes("auth/wrong-password")) return "Incorrect password. Please try again.";
  if (code.includes("auth/invalid-credential")) return "Incorrect email or password.";
  if (code.includes("auth/email-already-in-use")) return "This email is already registered.";
  if (code.includes("auth/weak-password")) return "Password must be at least 8 characters.";
  if (code.includes("auth/too-many-requests")) return "Too many attempts. Please try again later.";
  if (code.includes("auth/network-request-failed")) return "Network error. Check your connection.";
  if (code.includes("auth/popup-closed-by-user")) return "Login cancelled.";
  if (code.includes("auth/requires-recent-login"))
    return "For security, please sign out and sign in again before deleting your account.";
  if (msg.includes("Google login failed")) return msg;

  return "Something went wrong. Please try again.";
};

// ─────────────────────────────────────────────────────────────────────────────
// Strict input validation
// ─────────────────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateInputs = (email, password, isSignUp) => {
  if (!emailRegex.test(email)) return "Invalid email format.";

  if (isSignUp) {
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return "Password must be 8+ chars with uppercase, lowercase, and a number.";
    }
  } else {
    if (password.length < 6) return "Password must be at least 6 characters.";
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Retry strategy
// ─────────────────────────────────────────────────────────────────────────────
const retry = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (e) {
    if (retries <= 0) throw e;
    await new Promise((r) => setTimeout(r, 1000));
    return retry(fn, retries - 1);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeUser(user) {
  if (!user) return null;
  return {
    uid: user.uid || user.userId || user.id || null,
    email: user.email || null,
    displayName: user.displayName || user.name || null,
    photoURL: user.photoUrl || user.photoURL || null,
  };
}

async function getNativeTokenWithRetry(retries = 6, delayMs = 350) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const result = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
      const token = result?.token || null;
      if (token) {
        sessionStorage.setItem("token", token);
        return token;
      }
    } catch (e) {
      if (attempt === retries - 1) {
        console.error("[NativeAuth] Token fetch failed", e);
      }
    }
    await sleep(delayMs);
  }
  return null;
}

async function getWebToken(user) {
  try {
    if (!user || typeof user.getIdToken !== "function") return null;
    const token = await user.getIdToken(true);
    if (token) {
      sessionStorage.setItem("token", token);
      return token;
    }
  } catch (e) {
    console.error("[WebAuth] Token fetch failed", e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact support — opens default mail client
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORT_EMAIL = "makerstudiovu@gmail.com";

const openSupportMail = () => {
  const subject = encodeURIComponent("Navita App – Support / Feedback");
  const body = encodeURIComponent(
    "Hi Maker Studios,\n\nI need help with the following:\n\n[Describe your issue or feedback here]\n\nThank you!"
  );
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function Profile({
  selectedLanguage,
  onLanguageChange,
  onLoginSuccess,
  onAuthChange,
  theme,
  onThemeChange,
}) {
  const t = translations[selectedLanguage] || translations.en;

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role] = useState("user");
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(null);
  const lastClickRef = useRef(0);
  const lastEmittedUidRef = useRef(null);

  // ── Delete account state ──────────────────────────────────────────────────
  // deleteStep: 1 = warning screen, 2 = email confirmation screen
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isDark = theme === "dark";

  // ── Helpers ───────────────────────────────────────────────────────────────
  const emitUserToParent = (u) => {
    const normalized = normalizeUser(u);
    const uid = normalized?.uid || null;
    if (!normalized) {
      lastEmittedUidRef.current = null;
      onAuthChange?.(null);
      return;
    }
    if (uid && lastEmittedUidRef.current === uid) return;
    lastEmittedUidRef.current = uid;
    onAuthChange?.(normalized);
    onLoginSuccess?.();
  };

  const setLocalUser = (u) => setUser(normalizeUser(u));

  // ── Native auth state + token listeners ───────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let sub1, sub2, cancelled = false;

    const init = async () => {
      try {
        sub1 = await FirebaseAuthentication.addListener("authStateChange", async ({ user }) => {
          if (cancelled) return;
          setLoading(false);
          if (!user) {
            sessionStorage.removeItem("token");
            setLocalUser(null);
            emitUserToParent(null);
            return;
          }
          setLocalUser(user);
          const token = await getNativeTokenWithRetry();
          if (!token) {
            setError("Signed in, but the token is not ready yet. Please wait a moment and retry.");
            return;
          }
          emitUserToParent(user);
        });

        sub2 = await FirebaseAuthentication.addListener("idTokenChange", async ({ user }) => {
          if (cancelled) return;
          if (!user) { sessionStorage.removeItem("token"); return; }
          await getNativeTokenWithRetry();
        });

        const current = await FirebaseAuthentication.getCurrentUser();
        if (cancelled) return;
        setLoading(false);

        if (current.user) {
          setLocalUser(current.user);
          const token = await getNativeTokenWithRetry();
          if (token) {
            emitUserToParent(current.user);
          } else {
            setError("Signed in, but the token is not ready yet. Please wait a moment and retry.");
          }
        } else {
          sessionStorage.removeItem("token");
          setLocalUser(null);
        }
      } catch (e) {
        console.error("[NativeAuth init]", e);
        setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      sub1?.remove?.();
      sub2?.remove?.();
    };
  }, []);

  // ── Web OAuth redirect handler ────────────────────────────────────────────
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    getRedirectResult(auth).catch((err) => setError(parseError(err)));
  }, []);

  // ── Web auth observer + token refresh ─────────────────────────────────────
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const unsubToken = onIdTokenChanged(auth, async (u) => {
      if (u) { await getWebToken(u); }
      else { sessionStorage.removeItem("token"); }
    });

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setLoading(false);
      setLocalUser(u);
      emitUserToParent(u);
      if (u) { await getWebToken(u); }
      else { sessionStorage.removeItem("token"); }
    });

    return () => { unsubToken(); unsubAuth(); };
  }, []);

  // ── Memoised avatar ───────────────────────────────────────────────────────
  const avatar = useMemo(() => {
    const seed = user?.email || user?.displayName || "user";
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
  }, [user]);

  // ── Pre-auth guard ────────────────────────────────────────────────────────
  const preAuthCheck = () => {
    if (Date.now() - lastClickRef.current < 1000) return false;
    lastClickRef.current = Date.now();
    if (!navigator.onLine) { setError("No internet connection."); return false; }
    if (navigator.webdriver) { setError("Automated access is not allowed."); return false; }
    if (blockedUntil && Date.now() < blockedUntil) {
      const secs = Math.ceil((blockedUntil - Date.now()) / 1000);
      setError(`Too many attempts. Try again in ${secs}s.`);
      return false;
    }
    return true;
  };

  const recordAttempt = () => {
    const next = attempts + 1;
    setAttempts(next);
    if (next > 5) {
      setBlockedUntil(Date.now() + 30000);
      setError("Too many failed attempts. Please wait 30 seconds.");
    }
  };

  // ── Email / password auth ─────────────────────────────────────────────────
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    if (!preAuthCheck()) return;

    const validationError = validateInputs(email, password, isSignUp);
    if (validationError) return setError(validationError);

    setAuthLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

      if (Capacitor.isNativePlatform()) {
        if (isSignUp) {
          await retry(() => FirebaseAuthentication.createUserWithEmailAndPassword({ email, password }));
        } else {
          await retry(() => FirebaseAuthentication.signInWithEmailAndPassword({ email, password }));
        }
        setError(""); setEmail(""); setPassword(""); setAttempts(0);
        const token = await getNativeTokenWithRetry();
        if (!token) setError("Signed in, but the token is not ready yet. Please wait a moment and retry.");
      } else {
        const result = await retry(() =>
          isSignUp
            ? createUserWithEmailAndPassword(auth, email, password)
            : signInWithEmailAndPassword(auth, email, password)
        );
        await getWebToken(result?.user || auth.currentUser);
        setEmail(""); setPassword(""); setAttempts(0);
      }
    } catch (err) {
      recordAttempt();
      setError(parseError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Google auth ───────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!preAuthCheck()) return;
    setAuthLoading(true);
    setError("");
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        if (!result?.user) throw new Error("Google login failed. Please try again.");
        setLocalUser(result.user);
        const token = await getNativeTokenWithRetry();
        if (token) { emitUserToParent(result.user); }
        else { setError("Signed in, but the token is not ready yet. Please wait a moment and retry."); }
      } else {
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      }
    } catch (err) {
      setError(parseError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      } else {
        await signOut(auth);
      }
      sessionStorage.removeItem("token");
      lastEmittedUidRef.current = null;
      setLocalUser(null);
      onAuthChange?.(null);
    } catch (err) {
      console.error("[Auth] Sign out error:", err);
    } finally {
      setConfirmLogout(false);
    }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const openDeleteModal = () => {
    setDeleteStep(1);       // always start at warning screen
    setDeleteEmail("");     // clear any leftover input
    setDeleteError("");
    setConfirmDelete(true);
  };

  const closeDeleteModal = () => {
    setConfirmDelete(false);
    setDeleteStep(1);
    setDeleteEmail("");
    setDeleteError("");
  };

  // Warning screen → email confirmation screen
  const handleDeleteProceed = () => setDeleteStep(2);

  // Email confirmation → delete
  const handleDeleteConfirm = async (e) => {
    e?.preventDefault();
    setDeleteError("");

    // Resolve the signed-in account's email
    const accountEmail =
      user?.email ||
      (Capacitor.isNativePlatform() ? null : auth.currentUser?.email) ||
      null;

    if (!accountEmail) {
      setDeleteError("Unable to verify your account. Please sign out and sign in again.");
      return;
    }

    // Gate: typed email must match exactly (case-insensitive)
    if (!deleteEmail || deleteEmail.trim().toLowerCase() !== accountEmail.trim().toLowerCase()) {
      setDeleteError("The email you entered does not match your account. Please try again.");
      return;
    }

    setDeleteLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // Capacitor plugin operates on the currently authenticated user only
        await FirebaseAuthentication.deleteUser();
      } else {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error("No authenticated user found.");
        // Firebase deleteUser() only ever operates on auth.currentUser —
        // it is architecturally impossible to delete any other account.
        await deleteUser(firebaseUser);
      }

      sessionStorage.removeItem("token");
      lastEmittedUidRef.current = null;
      setLocalUser(null);
      onAuthChange?.(null);
      closeDeleteModal();
    } catch (err) {
      setDeleteError(parseError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const pageBg = isDark
    ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
    : "bg-gradient-to-b from-slate-50 via-white to-slate-100";
  const cardBg = isDark
    ? "bg-slate-900/70 backdrop-blur-xl border border-white/10 text-white"
    : "bg-white/90 backdrop-blur-xl border border-slate-200 text-slate-900";
  const subText = isDark ? "text-slate-400" : "text-slate-500";
  const inputClass = `w-full pl-11 pr-3 py-3 rounded-xl outline-none transition-all border text-[15px] ${
    isDark
      ? "bg-slate-800/70 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800"
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white"
  }`;
  const sectionBorder = isDark ? "border-white/10" : "border-slate-200";

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${pageBg}`}>
        <Suspense fallback={<div className="w-32 h-32" />}>
          <div className="w-40 h-40">
            <Lottie animationData={busAnimation} loop autoplay />
          </div>
        </Suspense>
        <p className={`mt-4 text-sm font-medium ${subText}`}>Loading your profile…</p>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${pageBg} px-5 py-8 flex flex-col items-center`}>
      <div className="w-full max-w-md">

        {/* Hero / brand strip — only when logged out */}
        {!user && (
          <div className="flex flex-col items-center mb-6">
            <Suspense fallback={<div className="w-28 h-28" />}>
              <div className="w-32 h-32 -mb-2">
                <Lottie animationData={busAnimation} loop autoplay />
              </div>
            </Suspense>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {isSignUp ? t.createAccount : t.signIn}
            </h1>
            <p className={`text-sm mt-1 ${subText}`}>Navita · Smart Bus Tracking</p>
          </div>
        )}

        {/* Offline banner */}
        {!navigator.onLine && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
            <WifiOff size={16} />
            You are offline. Please check your connection.
          </div>
        )}

        {/* Main card */}
        <div className={`rounded-2xl shadow-xl ${cardBg} overflow-hidden`}>
          {user ? (
            // ── Logged-in profile view ──────────────────────────────────
            <div>
              {/* Profile header */}
              <div
                className={`relative px-6 pt-8 pb-6 ${
                  isDark
                    ? "bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent"
                    : "bg-gradient-to-br from-blue-50 via-indigo-50 to-transparent"
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl" />
                    <img
                      src={avatar}
                      alt="avatar"
                      className="relative w-20 h-20 rounded-full ring-4 ring-white/20 shadow-lg bg-white"
                    />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold">{t.welcome || "Welcome"}</h2>
                  <p className={`text-sm mt-0.5 break-all ${subText}`}>
                    {user.email || user.displayName || ""}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck size={12} />
                    {role}
                  </span>
                </div>
              </div>

              {/* Settings list */}
              <div className={`px-5 py-5 space-y-3 border-t ${sectionBorder}`}>

                {/* Language */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${sectionBorder} ${isDark ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Globe size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Language</p>
                    <p className={`text-xs ${subText}`}>Choose your preferred language</p>
                  </div>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => onLanguageChange(e.target.value)}
                    className={`text-sm font-medium rounded-lg px-2 py-1.5 outline-none border ${
                      isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी</option>
                  </select>
                </div>

                {/* Theme */}
                <button
                  onClick={() => onThemeChange(isDark ? "light" : "dark")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition ${sectionBorder} ${
                    isDark ? "bg-slate-800/50 hover:bg-slate-800" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{isDark ? "Light Theme" : "Dark Theme"}</p>
                    <p className={`text-xs ${subText}`}>Switch appearance</p>
                  </div>
                  <ChevronRight size={16} className={subText} />
                </button>

                {/* Contact support */}
                <button
                  onClick={openSupportMail}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition ${sectionBorder} ${
                    isDark ? "bg-slate-800/50 hover:bg-slate-800" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <MessageSquare size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Contact Support</p>
                    <p className={`text-xs ${subText}`}>Reach us at makerstudiovu@gmail.com</p>
                  </div>
                  <ChevronRight size={16} className={subText} />
                </button>

                {/* Sign out */}
                <button
                  onClick={() => setConfirmLogout(true)}
                  className="w-full mt-2 bg-red-600 hover:bg-red-700 active:scale-[0.99] transition text-white py-3 rounded-xl flex items-center justify-center gap-2 font-medium shadow-sm"
                >
                  <LogOut size={16} />
                  {t.signOut || "Sign Out"}
                </button>

                {/* Delete account — subtle danger link, separated visually */}
                <div className={`pt-2 border-t ${sectionBorder}`}>
                  <button
                    onClick={openDeleteModal}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition text-red-500 dark:text-red-400 border border-red-500/20 hover:bg-red-500/10 active:scale-[0.99]"
                  >
                    <Trash2 size={15} />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // ── Auth (sign in / sign up) view ───────────────────────────
            <div className="px-6 py-6">
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {/* Email */}
                <div className="relative">
                  <Mail size={18} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${subText}`} />
                  <input
                    type="email"
                    placeholder="Email address"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={authLoading}
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock size={18} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${subText}`} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className={`${inputClass} pr-11`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    disabled={authLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText} hover:text-blue-500 transition`}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm"
                    >
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {blockedUntil && Date.now() < blockedUntil && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 px-1">
                    Account temporarily locked. Please wait before retrying.
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <LogIn size={16} />
                  {authLoading ? "Please wait..." : isSignUp ? t.signUp : t.signIn}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                <span className={`text-xs uppercase tracking-wider ${subText}`}>or</span>
                <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={authLoading}
                className={`w-full py-3 rounded-xl font-medium border flex items-center justify-center gap-3 transition disabled:opacity-60 ${
                  isDark
                    ? "bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-white"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5c-7.4 0-13.7 4.1-17.7 10.2z" />
                  <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-5c-1.9 1.3-4.3 2-6.9 2-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.9 39.3 16.3 43.5 24 43.5z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6 5C40.6 35.4 43.5 30 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
                </svg>
                {authLoading ? "Please wait..." : "Continue with Google"}
              </button>

              {/* Toggle sign-in / sign-up */}
              <p className={`mt-5 text-center text-sm ${subText}`}>
                {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                  className="ml-2 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  {isSignUp ? t.signIn : t.signUp}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 mt-6">
          <p className={`text-center text-xs ${subText}`}>
            © {new Date().getFullYear()} Navita · Smart Bus Tracking
          </p>
          <p className={`text-center text-xs flex items-center gap-1 ${subText}`}>
            Made with{" "}
            <Heart size={11} className="text-red-500 fill-red-500 inline-block" aria-label="love" />{" "}
            by <span className="font-semibold ml-0.5">Maker Studios, Udaipur</span>
          </p>
        </div>
      </div>

      {/* ── Logout confirm modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${cardBg}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center text-red-500">
                  <LogOut size={18} />
                </div>
                <h3 className="text-lg font-semibold">Confirm Logout</h3>
              </div>
              <p className={`text-sm ${subText} mb-5`}>
                Are you sure you want to sign out of your account?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className={`flex-1 px-4 py-2.5 border rounded-xl text-sm font-medium transition ${sectionBorder} ${
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition shadow-md"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete account modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-5"
            onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${cardBg}`}
            >
              {/* Modal header */}
              <div className="bg-red-600/10 border-b border-red-500/20 px-6 py-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Delete Account</h3>
                  <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-0.5">
                    This action is permanent and irreversible
                  </p>
                </div>
              </div>

              <div className="px-6 py-5">

                {/* Step 1 — Warning */}
                {deleteStep === 1 && (
                  <motion.div
                    key="del-step-1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <ul className={`text-sm ${subText} space-y-2 mb-5`}>
                      {[
                        "Your account and all associated data will be permanently deleted.",
                        "You will be immediately signed out and cannot recover your account.",
                        "This cannot be undone — even by contacting support.",
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-3">
                      <button
                        onClick={closeDeleteModal}
                        className={`flex-1 px-4 py-2.5 border rounded-xl text-sm font-medium transition ${sectionBorder} ${
                          isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteProceed}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition shadow-md"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2 — Email confirmation */}
                {deleteStep === 2 && (
                  <motion.div
                    key="del-step-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <p className={`text-sm ${subText} mb-1`}>
                      To confirm, type the email address linked to this account:
                    </p>
                    <p className={`text-xs font-semibold mb-4 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      {user?.email ||
                        (!Capacitor.isNativePlatform() ? auth.currentUser?.email : null) ||
                        "your account email"}
                    </p>

                    <form onSubmit={handleDeleteConfirm} className="space-y-3">
                      <div className="relative">
                        <Mail
                          size={16}
                          className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${subText}`}
                        />
                        <input
                          type="email"
                          placeholder="Enter your account email"
                          value={deleteEmail}
                          onChange={(e) => setDeleteEmail(e.target.value)}
                          autoComplete="email"
                          disabled={deleteLoading}
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl outline-none transition-all border text-[14px] ${
                            isDark
                              ? "bg-slate-800/70 border-slate-700 text-white placeholder-slate-500 focus:border-red-500"
                              : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-red-500"
                          }`}
                        />
                      </div>

                      {/* Delete error */}
                      <AnimatePresence>
                        {deleteError && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs"
                          >
                            <AlertCircle size={13} className="mt-0.5 shrink-0" />
                            <span>{deleteError}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => { setDeleteStep(1); setDeleteError(""); setDeleteEmail(""); }}
                          disabled={deleteLoading}
                          className={`flex-1 px-4 py-2.5 border rounded-xl text-sm font-medium transition ${sectionBorder} ${
                            isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                          } disabled:opacity-50`}
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={deleteLoading || !deleteEmail.trim()}
                          className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition shadow-md"
                        >
                          {deleteLoading ? "Deleting…" : "Delete Forever"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}