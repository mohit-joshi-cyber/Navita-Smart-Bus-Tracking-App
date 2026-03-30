// src/App.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { translations } from "./translations";
import Profile from "./profile";
import ProtectedWrapper from "./ProtectedWrapper";
import { auth } from "./firebase";
import {
  GoogleMap,
  MarkerF,
  CircleF,
  InfoWindowF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Home, Map, User, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SplashScreen from "./SplashScreen";
import Features from "./Features";
import Routes from "./Routes";
import { getPushModule } from "./pushHelper";
import { Capacitor } from "@capacitor/core";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ WS DATA VALIDATION — prevents coordinate injection / crash / XSS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_STRING_LEN = 100;

function sanitizeString(val, fallback = "") {
  if (typeof val !== "string") return fallback;
  return val.slice(0, MAX_STRING_LEN);
}

function validateBusPayload(d) {
  if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return false;
  if (d.latitude < -90 || d.latitude > 90) return false;
  if (d.longitude < -180 || d.longitude > 180) return false;
  return true;
}

function normalizeBus(busId, d) {
  return {
    id: String(busId).slice(0, 50),
    lat: d.latitude,
    lng: d.longitude,
    timestamp: d.timestamp ?? null,
    online: true,
    name: sanitizeString(d.name ?? busId),
    route: sanitizeString(d.route ?? ""),
    driver: d.driver ?? null,
    stops: Array.isArray(d.stops) ? d.stops : [],
    avgSpeedKmph: typeof d.avgSpeedKmph === "number" ? d.avgSpeedKmph : 20,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps styles
// Keep only a few useful place pins, hide noisy categories, and use a proper
// dark palette so it looks like a real Google dark map.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 24.5854, lng: 73.7125 };

const lightMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#f6f8fc" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6472" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6f8fc" }] },

  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#c7d2e2" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#d7deea" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#c4d2e5" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#d0d8e5" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#e3e8f0" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe8ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6f8cab" }] },

  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f6f8fc" }] },

  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },

  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.school", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.medical", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.place_of_worship", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.sports_complex", elementType: "all", stylers: [{ visibility: "on" }] },
];

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },

  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#223047" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b2638" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a3a52" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#1f2a3d" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#182334" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#08111f" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b6b8f" }] },

  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0b1220" }] },

  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },

  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.school", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.medical", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.place_of_worship", elementType: "all", stylers: [{ visibility: "on" }] },
  { featureType: "poi.sports_complex", elementType: "all", stylers: [{ visibility: "on" }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// GoogleMapSection — replaces Leaflet map
// ─────────────────────────────────────────────────────────────────────────────
function GoogleMapSection({ theme, busList, selectedBus, setSelectedBus, busesData, isLoaded }) {
  const mapRef = useRef(null);
  const [activeBusId, setActiveBusId] = useState(null);

  useEffect(() => {
    if (selectedBus?.id) {
      setActiveBusId(selectedBus.id);
    }
  }, [selectedBus]);

  useEffect(() => {
    if (!selectedBus?.id) return;
    const bus = busesData[selectedBus.id];
    if (!bus || !mapRef.current) return;

    mapRef.current.panTo({ lat: bus.lat, lng: bus.lng });
    mapRef.current.setZoom(17);
  }, [selectedBus, busesData]);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const options = useMemo(
    () => ({
      disableDefaultUI: false,
      clickableIcons: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      rotateControl: false,
      scaleControl: false,
      zoomControl: true,
      gestureHandling: "greedy",
      mapTypeId: "roadmap",
      styles: theme === "dark" ? darkMapStyles : lightMapStyles,
      backgroundColor: theme === "dark" ? "#0b1220" : "#f6f8fc",
    }),
    [theme]
  );

  if (!isLoaded) {
    return (
      <div
        className="absolute inset-0"
        style={{ backgroundColor: theme === "dark" ? "#0b1220" : "#f6f8fc" }}
      />
    );
  }

  const activeBus = activeBusId ? busesData[activeBusId] : null;

  return (
    <GoogleMap
      mapContainerStyle={{
  width: "100%",
  height: "100%",
  backgroundColor: theme === "dark" ? "#0b1220" : "#ffffff",
}}
      center={DEFAULT_CENTER}
      zoom={13}
      options={options}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {busList.map((bus) => (
        <MarkerF
          key={bus.id}
          position={{ lat: bus.lat, lng: bus.lng }}
          title={bus.name || bus.id}
          onClick={() => {
            setSelectedBus(bus);
            setActiveBusId(bus.id);
          }}
        />
      ))}

      {selectedBus && busesData[selectedBus.id] && (
        <>
          <CircleF
            center={{
              lat: busesData[selectedBus.id].lat,
              lng: busesData[selectedBus.id].lng,
            }}
            radius={22}
            options={{
              strokeColor: theme === "dark" ? "#60a5fa" : "#2563eb",
              fillColor: theme === "dark" ? "#60a5fa" : "#2563eb",
              fillOpacity: 0.2,
              strokeWeight: 2,
            }}
          />
          {activeBus && (
            <InfoWindowF
              position={{ lat: activeBus.lat, lng: activeBus.lng }}
              onCloseClick={() => setActiveBusId(null)}
            >
              <div style={{ minWidth: 160 }}>
                <strong>{activeBus.name || activeBus.id}</strong>
                {activeBus.route ? (
                  <>
                    <br />
                    {activeBus.route}
                  </>
                ) : null}
                <br />
                <span style={{ fontSize: 11, color: "#888" }}>
                  {activeBus.timestamp
                    ? `Last seen: ${new Date(activeBus.timestamp).toLocaleTimeString()}`
                    : "Live"}
                </span>
              </div>
            </InfoWindowF>
          )}
        </>
      )}
    </GoogleMap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// animateMarker — smooth interpolation between GPS positions
// ─────────────────────────────────────────────────────────────────────────────
function animateMarker(start, end, duration, setPosition, animationRef) {
  if (animationRef.current) cancelAnimationFrame(animationRef.current);
  const startTime = performance.now();

  function animate(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const lat = start[0] + (end[0] - start[0]) * progress;
    const lng = start[1] + (end[1] - start[1]) * progress;
    setPosition([lat, lng]);
    if (progress < 1) animationRef.current = requestAnimationFrame(animate);
  }

  animationRef.current = requestAnimationFrame(animate);
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedBus, setSelectedBus] = useState(null);
  const [appState, setAppState] = useState("loading");
  // appState: "loading" | "onboarding" | "app"

  const { isLoaded: isGoogleMapsLoaded } = useJsApiLoader({
    id: "navita-google-maps",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  // ── Capacitor back button ─────────────────────────────────────────────────
  useEffect(() => {
    const initCapacitor = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const { App: CapApp } = await import("@capacitor/app");
        CapApp.addListener("backButton", ({ canGoBack }) => {
          if (!canGoBack) CapApp.exitApp();
        });
      } catch (err) {
        console.error("[Capacitor]", err);
      }
    };
    initCapacitor();
  }, []);

  // ── Language ──────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState(() => localStorage.getItem("appLanguage") || "en");
  useEffect(() => {
    localStorage.setItem("appLanguage", language);
  }, [language]);
  const t = translations[language];

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    if (localStorage.getItem("theme")) return localStorage.getItem("theme");
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    theme === "dark" ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const ui = useMemo(() => {
  const dark = theme === "dark";
  return {
    pageBg: dark ? "#0b1220" : "#ffffff",
    text: dark ? "#e6eef8" : "#0f172a",
    muted: dark ? "#94a3b8" : "#475569",
    border: dark ? "#1f2937" : "#e5e7eb",
    surface: dark ? "#111827" : "#ffffff",
    navBg: dark ? "#0b1220" : "#ffffff",
    navActive: dark ? "#60a5fa" : "#2563eb",
    navInactive: dark ? "#94a3b8" : "#475569",
  };
}, [theme]);




useEffect(() => {
  const root = document.documentElement;
  root.style.setProperty("--app-bg", ui.pageBg);
  root.style.setProperty("--app-text", ui.text);
  root.style.setProperty("--app-muted", ui.muted);
  root.style.setProperty("--app-border", ui.border);
  root.style.setProperty("--app-surface", ui.surface);
  root.style.setProperty("--app-nav", ui.navBg);
  root.style.setProperty("--app-nav-active", ui.navActive);
  root.style.setProperty("--app-nav-inactive", ui.navInactive);
}, [ui]);

  // ── Auth / onboarding flow ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setAppState("onboarding");
        return;
      }
      try {
        await user.getIdToken();
        const onboardingDone = localStorage.getItem("onboardingDone");
        setAppState(onboardingDone ? "app" : "onboarding");
      } catch (err) {
        console.error("[Auth]", err);
        setAppState("onboarding");
      }
    });
    return () => unsub();
  }, []);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // ─────────────────────────────────────────────────────────────────────────
  // Bus state
  // ─────────────────────────────────────────────────────────────────────────
  const [busesData, setBusesData] = useState({});
  const busesRef = useRef({});
  const animationRefs = useRef({});
  const lastUpdateRef = useRef(0); // throttle guard

  useEffect(() => {
    busesRef.current = busesData;
  }, [busesData]);

  const busList = useMemo(() => Object.values(busesData), [busesData]);

  // ─────────────────────────────────────────────────────────────────────────
  // WebSocket
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let ws;
    let reconnectTimer;
    let isDestroyed = false;
    let retryCount = 0;
    let lastTokenTime = 0;

    const connectWebSocket = async (token) => {
      if (isDestroyed) return;

      if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();

      ws = new WebSocket("wss://api.navitaserver.dpdns.org");

      ws.onopen = () => {
        console.log("[WS] connected — authenticating");
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (event) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 100) return;
        lastUpdateRef.current = now;

        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.warn("[WS] malformed JSON:", e);
          return;
        }

        if (data.type === "init" && data.data && typeof data.data === "object") {
          const newData = {};
          Object.keys(data.data).forEach((busId) => {
            const d = data.data[busId];
            if (!validateBusPayload(d)) {
              console.warn("[WS] invalid init payload for", busId);
              return;
            }
            newData[busId] = normalizeBus(busId, d);
          });
          setBusesData(newData);
          return;
        }

        if (data.busId) {
          const busId = String(data.busId).slice(0, 50);

          if (!validateBusPayload(data)) {
            console.warn("[WS] invalid live payload for", busId);
            return;
          }

          const newLoc = [data.latitude, data.longitude];
          const currentBus = busesRef.current[busId];

          if (!currentBus) {
            setBusesData((prev) => ({
              ...prev,
              [busId]: normalizeBus(busId, data),
            }));
            return;
          }

          if (!animationRefs.current[busId]) {
            animationRefs.current[busId] = { current: null };
          }

          animateMarker(
            [currentBus.lat, currentBus.lng],
            newLoc,
            800,
            (pos) => {
              setBusesData((prev) => ({
                ...prev,
                [busId]: {
                  ...prev[busId],
                  lat: pos[0],
                  lng: pos[1],
                  timestamp: data.timestamp ?? prev[busId]?.timestamp,
                  online: true,
                },
              }));
            },
            animationRefs.current[busId]
          );
        }

        if (data.type === "offline" && data.busId) {
          const busId = String(data.busId).slice(0, 50);
          setBusesData((prev) => {
            if (!prev[busId]) return prev;
            return { ...prev, [busId]: { ...prev[busId], online: false } };
          });

          if (animationRefs.current[busId]) {
            if (animationRefs.current[busId].current) {
              cancelAnimationFrame(animationRefs.current[busId].current);
            }
            delete animationRefs.current[busId];
          }
        }
      };

      ws.onerror = (e) => console.warn("[WS] error", e);

      ws.onclose = () => {
        if (isDestroyed) return;

        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        retryCount++;

        console.log(`[WS] closed — retry #${retryCount} in ${delay}ms`);

        reconnectTimer = setTimeout(async () => {
          try {
            const user = auth.currentUser;
            if (!user) return;

            const freshToken = await user.getIdToken();
            connectWebSocket(freshToken);

            retryCount = 0;
          } catch (err) {
            if (err?.code === "auth/quota-exceeded") {
              console.error("[WS] 🚫 Firebase quota exceeded — reconnect stopped");
              return;
            }
            console.warn("[WS] reconnect error:", err);
          }
        }, delay);
      };
    };

    const unsub = auth.onIdTokenChanged(async (user) => {
      if (!user) return;

      const now = Date.now();
      if (now - lastTokenTime < 60_000) return;
      lastTokenTime = now;

      const token = await user.getIdToken();
      connectWebSocket(token);
    });

    return () => {
      isDestroyed = true;
      unsub();
      clearTimeout(reconnectTimer);
      if (ws) ws.close();

      Object.values(animationRefs.current).forEach((ref) => {
        if (ref?.current) cancelAnimationFrame(ref.current);
      });
      animationRefs.current = {};
    };
  }, []);

  // ── Push notifications ────────────────────────────────────────────────────
  useEffect(() => {
    const initPush = async () => {
      try {
        const PushNotifications = await getPushModule();
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive === "granted") {
          await PushNotifications.register();
        }
      } catch (err) {
        console.error("[Push]", err);
      }
    };
    initPush();
  }, []);

  // ── Debounced + memoized search filter ───────────────────────────────────
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return busList.filter(
      (bus) =>
        (bus.id ?? "").toLowerCase().includes(q) ||
        (bus.name ?? "").toLowerCase().includes(q) ||
        (bus.route ?? "").toLowerCase().includes(q)
    );
  }, [debouncedQuery, busList]);

  // ─────────────────────────────────────────────────────────────────────────
  // appState gate
  // ─────────────────────────────────────────────────────────────────────────
  if (appState === "loading") return <SplashScreen />;

  if (appState === "onboarding") {
    return (
      <Features
        language={language}
        setLanguage={setLanguage}
        onFinish={() => {
          localStorage.setItem("onboardingDone", "true");
          setAppState("app");
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — appState === "app"
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ProtectedWrapper>
      <div
        className="relative w-full h-screen overflow-hidden transition-colors duration-300 pt-safe pb-safe"
        style={{
  backgroundColor: "var(--app-bg)",
  color: "var(--app-text)",
}}
      >
        {/* ── Theme toggle ── */}
        <div className="absolute top-3 right-3 z-[2000]">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="px-3 py-1 rounded-lg text-sm"
style={{
  backgroundColor: "var(--app-surface)",
  color: "var(--app-text)",
  border: `1px solid var(--app-border)`,
}}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {/* ── Search bar (Home tab only) ── */}
        {activeTab === "Home" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-lg z-[1000]">
            <div
  className="flex items-center rounded-xl shadow-md px-3 py-2"
  style={{
    backgroundColor: "var(--app-surface)",
    border: `1px solid var(--app-border)`,
  }}
>
              <Search
  className="h-5 w-5 mr-2"
  style={{ color: "var(--app-muted)" }}
/>
              <input
                className="flex-1 outline-none bg-transparent"
style={{ color: "var(--app-text)" }}
                type="text"
                placeholder={t.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.length > 0 && (
                <button
                  onClick={() => setQuery("")}
                  className="ml-1 text-xl leading-none"
                  style={{ color: "var(--app-muted)" }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Dropdown results */}
            <AnimatePresence>
              {filtered.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 rounded-lg shadow-xl overflow-hidden"
                  style={{
  backgroundColor: "var(--app-surface)",
  border: `1px solid var(--app-border)`,
}}
                >
                  {filtered.map((bus) => (
                    <li
                      key={bus.id}
                      className={`px-4 py-3 cursor-pointer flex items-center justify-between ${
                        theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100"
                      }`}
                      onClick={() => {
                        setQuery("");
                        setSelectedBus(bus);
                        setActiveTab("Home");
                      }}
                    >
                      <div>
                        <p className="font-semibold text-sm" style={{ color: ui.text }}>
                          {bus.name !== bus.id && bus.name ? bus.name : bus.id}
                        </p>
                        {bus.route ? (
                          <p className="text-xs" style={{ color: ui.muted }}>
                            {bus.route}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: bus.online ? "#22c55e" : "#ef4444" }}
                      />
                    </li>
                  ))}
                </motion.ul>
              )}

              {debouncedQuery.trim().length > 0 && filtered.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 rounded-lg px-4 py-3 text-sm"
                  style={{
  backgroundColor: "var(--app-surface)",
  color: "var(--app-muted)",
  border: `1px solid var(--app-border)`,
}}
                >
                  No buses found for "{debouncedQuery}"
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Pages ── */}
        <AnimatePresence mode="wait">
          {activeTab === "Home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <GoogleMapSection
                theme={theme}
                busList={busList}
                selectedBus={selectedBus}
                setSelectedBus={setSelectedBus}
                busesData={busesData}
                isLoaded={isGoogleMapsLoaded}
              />
            </motion.div>
          )}

          {activeTab === "Routes" && <RoutesSmokeTest theme={theme} />}

          {activeTab === "Profile" && (
            <motion.div
              key="profile"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Profile
                selectedLanguage={language}
                onLanguageChange={(lang) => setLanguage(lang)}
                onLoginSuccess={() => {
                  localStorage.setItem("onboardingDone", "true");
                  setAppState("app");
                }}
                theme={theme}
                onThemeChange={setTheme}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom Nav ── */}
        <div
          className="fixed bottom-0 left-0 w-full flex justify-around py-3 md:py-4 z-[1000] shadow-lg"
          style={{
  backgroundColor: "var(--app-nav)",
  borderTop: `1px solid var(--app-border)`,
}}
        >
          {[
            { name: "Home", icon: Home, label: t.home },
            { name: "Routes", icon: Map, label: t.routes },
            { name: "Profile", icon: User, label: t.profile },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <motion.button
                key={item.name}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab(item.name)}
                className="flex flex-col items-center text-sm"
                style={{ color: isActive ? "var(--app-nav-active)" : "var(--app-nav-inactive)" }}
              >
                <Icon className="h-6 w-6 mb-1" />
                <span style={{ fontWeight: isActive ? 700 : 500 }}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </ProtectedWrapper>
  );
}



