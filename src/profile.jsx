// src/profile.jsx

import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Capacitor } from "@capacitor/core"
import { FirebaseAuthentication } from "@capacitor-firebase/authentication"

import {
  LogIn,
  LogOut,
  Facebook,
  Sun,
  Moon,
  Eye,
  EyeOff,
  WifiOff
} from "lucide-react"

import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential
} from "firebase/auth"

import { auth } from "./firebase"
import { translations } from "./translations"

// ✅ Lazy load Lottie for performance
const Lottie = lazy(() => import("lottie-react"))
import busAnimation from "./assets/bus.json"

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Industrial error mapping — no raw Firebase messages exposed to users
// ─────────────────────────────────────────────────────────────────────────────
const parseError = (err) => {
  const code = err.code || ""
  if (code.includes("auth/invalid-email"))          return "Invalid email address."
  if (code.includes("auth/user-not-found"))          return "No account found with this email."
  if (code.includes("auth/wrong-password"))          return "Incorrect password. Please try again."
  if (code.includes("auth/email-already-in-use"))    return "This email is already registered."
  if (code.includes("auth/weak-password"))           return "Password must be at least 8 characters."
  if (code.includes("auth/too-many-requests"))       return "Too many attempts. Please try again later."
  if (code.includes("auth/network-request-failed"))  return "Network error. Check your connection."
  if (code.includes("auth/popup-closed-by-user"))    return "Login cancelled."
  return "Something went wrong. Please try again."
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Strict input validation (sign-up requires strong password)
// ─────────────────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateInputs = (email, password, isSignUp) => {
  if (!emailRegex.test(email)) return "Invalid email format."
  if (isSignUp) {
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return "Password must be 8+ chars with uppercase, lowercase, and a number."
    }
  } else {
    if (password.length < 6) return "Password must be at least 6 characters."
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Retry strategy — for login and token refresh
// ─────────────────────────────────────────────────────────────────────────────
const retry = async (fn, retries = 2) => {
  try {
    return await fn()
  } catch (e) {
    if (retries <= 0) throw e
    await new Promise((r) => setTimeout(r, 1000))
    return retry(fn, retries - 1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Profile({
  selectedLanguage,
  onLanguageChange,
  onLoginSuccess,
  theme,
  onThemeChange
}) {
  const t = translations[selectedLanguage] || translations.en

  const [user, setUser]                     = useState(null)
  const [isSignUp, setIsSignUp]             = useState(false)
  const [email, setEmail]                   = useState("")
  const [password, setPassword]             = useState("")
  const [error, setError]                   = useState("")
  const [confirmLogout, setConfirmLogout]   = useState(false)
  const [loading, setLoading]               = useState(true)
  const [authLoading, setAuthLoading]       = useState(false)
  const [showPassword, setShowPassword]     = useState(false)
  const [role, setRole]                     = useState("user")

  // ✅ Client-side rate limiting
  const [attempts, setAttempts]         = useState(0)
  const [blockedUntil, setBlockedUntil] = useState(null)

  // ✅ Rapid-click debounce guard (ref avoids stale closures)
  const lastClickRef = useRef(0)

  const isDark = theme === "dark"

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Inactivity logout — 15 min
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let timeout
    const resetTimer = () => {
      clearTimeout(timeout)
      timeout = setTimeout(async () => {
        if (auth.currentUser) {
          try { await signOut(auth) } catch (_) {}
        }
      }, 15 * 60 * 1000)
    }
    window.addEventListener("mousemove", resetTimer)
    window.addEventListener("keydown", resetTimer)
    window.addEventListener("touchstart", resetTimer)
    resetTimer()
    return () => {
      clearTimeout(timeout)
      window.removeEventListener("mousemove", resetTimer)
      window.removeEventListener("keydown", resetTimer)
      window.removeEventListener("touchstart", resetTimer)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Handle OAuth redirect result on app load (replaces popup on web)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
          // auth state observer will fire — no extra handling needed
        }
      } catch (err) {
        setError(parseError(err))
      }
    }
    handleRedirect()
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Token refresh lifecycle — stores fresh token in sessionStorage
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken(true)
        sessionStorage.setItem("token", token)

        // 🔐 Sync fresh token to backend
        // await fetch("/api/auth/sync", {
        //   method: "POST",
        //   headers: { Authorization: `Bearer ${token}` }
        // })

        console.log("[Auth] Token refreshed")
      }
    })
    return () => unsub()
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Clean, predictable auth state observer
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        // Fetch role from backend later: GET /me → setRole(data.role)
        onLoginSuccess?.()
      }
    })
    return () => unsub()
  }, [onLoginSuccess])

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Memoized avatar
  // ─────────────────────────────────────────────────────────────────────────
  const avatar = useMemo(() => {
    if (!user?.email) return null
    return `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`
  }, [user])

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Shared pre-auth guard — runs before every auth call
  // ─────────────────────────────────────────────────────────────────────────
  const preAuthCheck = () => {
    // Rapid-click debounce
    if (Date.now() - lastClickRef.current < 1000) return false
    lastClickRef.current = Date.now()

    // Network check
    if (!navigator.onLine) {
      setError("No internet connection.")
      return false
    }

    // Bot / automation detection
    if (navigator.webdriver) {
      setError("Automated access is not allowed.")
      return false
    }

    // Rate limiting
    if (blockedUntil && Date.now() < blockedUntil) {
      const secs = Math.ceil((blockedUntil - Date.now()) / 1000)
      setError(`Too many attempts. Try again in ${secs}s.`)
      return false
    }

    return true
  }

  const recordAttempt = () => {
    const next = attempts + 1
    setAttempts(next)
    if (next > 5) {
      setBlockedUntil(Date.now() + 30000) // 30 second block
      setError("Too many failed attempts. Please wait 30 seconds.")
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Email / password auth with validation + randomized delay
  // ─────────────────────────────────────────────────────────────────────────
  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setError("")

    if (!preAuthCheck()) return

    const validationError = validateInputs(email, password, isSignUp)
    if (validationError) return setError(validationError)

    setAuthLoading(true)
    try {
      // ✅ Randomized delay — breaks timing-based brute force automation
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700))

      await retry(() =>
        isSignUp
          ? createUserWithEmailAndPassword(auth, email, password)
          : signInWithEmailAndPassword(auth, email, password)
      )
      setEmail("")
      setPassword("")
      setAttempts(0)
    } catch (err) {
      recordAttempt()
      setError(parseError(err))
    } finally {
      setAuthLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Google — redirect on web (secure), native on Capacitor
  // ─────────────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!preAuthCheck()) return
    setAuthLoading(true)
    setError("")
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle()
        // ✅ Validate credential before use
        if (!result?.credential?.idToken) {
          throw new Error("Google login failed. Please try again.")
        }
        const credential = GoogleAuthProvider.credential(result.credential.idToken)
        await signInWithCredential(auth, credential)
      } else {
        // ✅ Redirect-based OAuth — more secure than popup
        await signInWithRedirect(auth, new GoogleAuthProvider())
        // Result is handled by getRedirectResult() useEffect on next page load
      }
    } catch (err) {
      setError(parseError(err))
      setAuthLoading(false)
    }
    // Note: don't setAuthLoading(false) after redirect — page will reload
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Facebook — redirect on web, popup on native
  // ─────────────────────────────────────────────────────────────────────────
  const handleFacebook = async () => {
    if (!preAuthCheck()) return
    setAuthLoading(true)
    setError("")
    try {
      if (Capacitor.isNativePlatform()) {
        await signInWithPopup(auth, new FacebookAuthProvider())
        setAuthLoading(false)
      } else {
        await signInWithRedirect(auth, new FacebookAuthProvider())
        // Page will reload — no need to setAuthLoading(false)
      }
    } catch (err) {
      setError(parseError(err))
      setAuthLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ Hardened logout — clears session token only (not full localStorage)
  // ─────────────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await signOut(auth)
      sessionStorage.removeItem("token")
      // Only clear app-specific keys — don't nuke unrelated storage
      localStorage.removeItem("onboardingDone")
      localStorage.removeItem("appLanguage")
      localStorage.removeItem("theme")
    } catch (err) {
      console.error("[Auth] Sign out error:", err)
    } finally {
      setConfirmLogout(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Theme styles
  // ─────────────────────────────────────────────────────────────────────────
  const pageBg      = isDark ? "bg-slate-900" : "bg-slate-100"
  const cardBg      = isDark ? "bg-slate-800 text-white" : "bg-white"
  const borderColor = isDark ? "border-slate-600" : "border-slate-200"
  const inputClass  = `p-3 border rounded-lg w-full outline-none transition ${
    isDark
      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
      : "bg-white border-slate-200 text-slate-800"
  }`

  // ─────────────────────────────────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`w-full min-h-screen flex items-center justify-center ${pageBg}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full max-w-md rounded-2xl shadow-xl p-6 ${cardBg}`}
        >
          <div className="flex flex-col items-center gap-5 animate-pulse">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    // ✅ Safe-area padding for Android notch
    <div className={`w-full min-h-screen flex items-center justify-center p-4 pt-safe pb-safe ${pageBg}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md rounded-2xl shadow-xl overflow-hidden ${cardBg}`}
      >
        {/* Animated Bus (Login screen only) */}
        {!user && (
          <div className="w-full h-44 bg-blue-50 flex items-center justify-center">
            <Suspense fallback={<div className="w-full h-40 bg-blue-50" />}>
              <Lottie animationData={busAnimation} loop={true} className="h-40" />
            </Suspense>
          </div>
        )}

        <div className="p-6 flex flex-col gap-5">

          {!user && (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {isSignUp ? t.createAccount : t.signIn}
              </h1>
              <p className="text-sm text-slate-500 mt-1">Navita Smart Bus Tracking</p>
            </div>
          )}

          {/* ✅ Offline banner */}
          {!navigator.onLine && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <WifiOff size={16} />
              You are offline. Please check your connection.
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── LOGGED IN VIEW ── */}
            {user ? (
              <motion.div
                key="logged"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={avatar}
                    alt="avatar"
                    className={`w-20 h-20 rounded-full border-2 ${borderColor}`}
                  />
                  <h2 className="font-semibold text-lg">{t.welcome || "Welcome"}</h2>
                  <p className={isDark ? "text-slate-300 text-sm" : "text-slate-500 text-sm"}>
                    {user.email}
                  </p>
                  {/* Role badge — populate from /me backend endpoint */}
                  <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">
                    {role}
                  </span>
                </div>

                {/* Language selector */}
                <select
                  className={`p-3 border rounded-lg ${borderColor} ${isDark ? "bg-slate-700 text-white" : ""}`}
                  value={selectedLanguage}
                  onChange={(e) => onLanguageChange(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="gu">ગુજરાતી</option>
                  <option value="mr">मराठी</option>
                  <option value="pa">ਪੰਜਾਬੀ</option>
                  <option value="raj">राजस्थानी</option>
                  <option value="ur">اُردُو</option>
                </select>

                {/* Theme switch */}
                <button
                  onClick={() => onThemeChange(isDark ? "light" : "dark")}
                  className={`border py-3 rounded-lg flex items-center justify-center gap-2 transition ${borderColor} ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                  }`}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  {isDark ? "Light Theme" : "Dark Theme"}
                </button>

                {/* Logout */}
                <button
                  onClick={() => setConfirmLogout(true)}
                  className="bg-red-600 hover:bg-red-700 transition text-white py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  {t.signOut || "Sign Out"}
                </button>
              </motion.div>

            ) : (

              /* ── LOGIN / SIGN UP FORM ── */
              <motion.div
                key="auth"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-4"
              >
                <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">

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

                  {/* ✅ Password field with visibility toggle */}
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={isSignUp ? "Password (8+ chars, A-Z, a-z, 0-9)" : "Password"}
                      className={`${inputClass} pr-10`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      disabled={authLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Error display */}
                  {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  )}

                  {/* ✅ Rate-limit notice */}
                  {blockedUntil && Date.now() < blockedUntil && (
                    <p className="text-amber-500 text-xs text-center">
                      Account temporarily locked. Please wait before retrying.
                    </p>
                  )}

                  {/* ✅ Disabled during auth to prevent double-submit */}
                  <button
                    type="submit"
                    disabled={authLoading || (blockedUntil && Date.now() < blockedUntil)}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition text-white py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <LogIn size={18} />
                    {authLoading ? "Please wait..." : (isSignUp ? t.signUp : t.signIn)}
                  </button>
                </form>

                {/* ✅ Google — redirect on web, native on Android */}
                <button
                  onClick={handleGoogle}
                  disabled={authLoading}
                  className={`border py-3 rounded-lg flex items-center justify-center gap-3 transition disabled:opacity-60 disabled:cursor-not-allowed ${borderColor} ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-gray-50"
                  }`}
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                    className="w-5 h-5"
                    alt="Google"
                  />
                  {authLoading ? "Please wait..." : "Continue with Google"}
                </button>

                {/* Facebook */}
                <button
                  onClick={handleFacebook}
                  disabled={authLoading}
                  className="bg-[#1877F2] hover:bg-[#1565d8] disabled:opacity-60 disabled:cursor-not-allowed transition text-white py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <Facebook size={18} />
                  {authLoading ? "Please wait..." : "Continue with Facebook"}
                </button>

                <p className="text-center text-sm text-slate-500">
                  {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
                  <button
                    onClick={() => { setIsSignUp(!isSignUp); setError("") }}
                    className="ml-2 text-blue-600 font-semibold hover:underline"
                  >
                    {isSignUp ? t.signIn : t.signUp}
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`rounded-xl p-6 w-80 text-center shadow-xl ${
                isDark ? "bg-slate-800 text-white" : "bg-white"
              }`}
            >
              <h2 className="text-lg font-semibold mb-2">Confirm Logout</h2>
              <p className={`text-sm mb-5 ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                Are you sure you want to sign out?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className={`px-4 py-2 border rounded-lg transition ${borderColor} ${
                    isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 transition text-white rounded-lg"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

