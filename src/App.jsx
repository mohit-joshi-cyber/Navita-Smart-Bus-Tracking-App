// src/App.jsx
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { translations } from "./translations";
import Profile from "./profile";
import Terms from "./Terms"; 
import { auth } from "./firebase";
import { onIdTokenChanged } from "firebase/auth";
import { GoogleMap } from "@capacitor/google-maps";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  Home,
  Map as MapIcon,
  User,
  Search,
  X,
  WifiOff,
  Navigation2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SplashScreen from "./SplashScreen";

import Routes from "./Routes";

const ICONS = {
  // We use the 'public' prefix for Native, and standard path for Web
  DEFAULT: Capacitor.isNativePlatform() ? "public/assets/default_bus.png" : "/assets/default_bus.png",
  OFFLINE: Capacitor.isNativePlatform() ? "public/assets/offline_bus.png" : "/assets/offline_bus.png",
  R1:      Capacitor.isNativePlatform() ? "public/assets/r1.png" : "/assets/r1.png",
  R2:      Capacitor.isNativePlatform() ? "public/markers/bus_r2.png" : "/markers/bus_r2.png"

};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_BASE_URL =
  import.meta.env.VITE_SERVER_BASE_URL || "https://api.navitaserver.dpdns.org";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "wss://api.navitaserver.dpdns.org";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const MAX_STRING_LEN = 100;

function sanitizeString(val, fallback = "") {
  if (typeof val !== "string") return fallback;
  return val.slice(0, MAX_STRING_LEN);
}

function validateBusPayload(d) {
  if (!d || typeof d.latitude !== "number" || typeof d.longitude !== "number") {
    return false;
  }
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
    online: d.online ?? true,
    name: sanitizeString(d.name ?? busId),
    route: sanitizeString(d.route ?? ""),
    driver: d.driver ?? null,
    stops: Array.isArray(d.stops) ? d.stops : [],
    avgSpeedKmph: typeof d.avgSpeedKmph === "number" ? d.avgSpeedKmph : 20,
    status: d.status ?? d.uiState?.status ?? "IDLE",
    uiState: d.uiState ?? null,
    currentStopId: d.currentStopId ?? null,
    currentStopIndex: Number.isInteger(d.currentStopIndex)
      ? d.currentStopIndex
      : null,
    nextStopIndex: Number.isInteger(d.nextStopIndex) ? d.nextStopIndex : null,
    progressM: typeof d.progressM === "number" ? d.progressM : null,
    progressPct: typeof d.progressPct === "number" ? d.progressPct : null,
    distanceToNextStopM:
      typeof d.distanceToNextStopM === "number" ? d.distanceToNextStopM : null,
    dwellMs: typeof d.dwellMs === "number" ? d.dwellMs : null,
  };
}

function getBusStatusLabel(bus) {
  if (!bus) return "";
  if (!bus.online) return "Offline";
  if (bus.route && bus.route.trim()) return bus.route.trim();
  return "Live";
}

function getGoogleMapsApiKey() {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_ANDROID_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bus Icon Helper
// ─────────────────────────────────────────────────────────────────────────────

function getBusIcon(bus) {
  const isNative = Capacitor.isNativePlatform();
  const prefix = isNative ? "public/assets/" : "assets/";

  // 1. Handle Offline status
  if (!bus.online) return ICONS.OFFLINE;

  // 2. Handle Specific Route Icons
  if (bus.id === "R-1") {
    return ICONS.R1;
  }

  if (bus.id === "R-2") {
    return ICONS.R2;
  }

  // 3. Fallback to default
  return ICONS.DEFAULT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Map constants
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 24.5854, lng: 73.7125 };

const lightMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#f0f4fb" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5568" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f0f4fb" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#c7d2e2" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#f8fafc" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bfdbfe" }] },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f0f4fb" }],
  },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
];

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0d1b2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ba3c0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1b2e" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1a2e45" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#152032" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#1e3352" }],
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#122030" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#071525" }] },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#0d1b2e" }],
  },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Native Google Maps view
// ─────────────────────────────────────────────────────────────────────────────
const NativeGoogleMapSection = memo(function NativeGoogleMapSection({
  theme,
  busList,
  selectedBus,
  setSelectedBus,
  busesData,
  isVisible,
  wsConnected,
  wsAuthenticated,
}) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerIdsRef = useRef(new globalThis.Map());
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const mapStyles = useMemo(
    () => (theme === "dark" ? darkMapStyles : lightMapStyles),
    [theme]
  );
  const selectedBusLive = selectedBus?.id ? busesData[selectedBus.id] : null;

  useEffect(() => {
    let cancelled = false;

    const createMap = async () => {
      try {
        if (!mapElementRef.current) return;

        const apiKey = getGoogleMapsApiKey();
        if (!apiKey) {
          setMapError("Missing Google Maps API key");
          return;
        }

        setMapError("");
        setMapReady(false);

        const map = await GoogleMap.create({
          id: "navita-native-map",
          element: mapElementRef.current,
          apiKey,
          config: {
            center: DEFAULT_CENTER,
            zoom: 13,
            styles: mapStyles,
            androidLiteMode: false,
          },
        });

        if (cancelled) {
          await map.destroy();
          return;
        }

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error("[NativeMap] create failed", err);
        setMapError("Google Maps failed to load");
      }
    };

    createMap();

    return () => {
      cancelled = true;
      setMapReady(false);
      markerIdsRef.current = new globalThis.Map();
      const map = mapInstanceRef.current;
      mapInstanceRef.current = null;
      if (map) {
        map.destroy().catch((err) => console.warn("[NativeMap] destroy failed", err));
      }
    };
  }, [mapStyles]);

  useEffect(() => {
    if (!isVisible) return;
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const timer = setTimeout(() => {
      map.setCamera({ coordinate: DEFAULT_CENTER, zoom: 13, animate: false }).catch(() => {});
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, mapReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const oldIds = [...markerIdsRef.current.values()];
        if (oldIds.length > 0) {
          await map.removeMarkers(oldIds).catch(() => {});
        }
        markerIdsRef.current = new globalThis.Map();

        const markers = busList.map((bus) => {
          const iconPath = getBusIcon(bus);

          return {
            coordinate: { 
              lat: bus.lat, 
              lng: bus.lng 
            },
            title: bus.name || bus.id,
            snippet: `${getBusStatusLabel(bus)}${
              bus.timestamp ? ` • ${new Date(bus.timestamp).toLocaleTimeString()}` : ""
            }`,
            opacity: bus.online ? 1 : 0.6,
            isFlat: false,
            
            iconUrl: iconPath,
            
            iconSize: {
              width: 75,
              height: 75,
            },
            
            iconAnchor: {
              x: 25, 
              y: 25  
            },
          };
        });

        if (markers.length > 0) {
          const ids = await map.addMarkers(markers);
          if (!cancelled) {
            markerIdsRef.current = new globalThis.Map(
              busList.map((bus, idx) => [bus.id, ids[idx]])
            );
          }
        }

        if (selectedBus?.id && busesData[selectedBus.id]) {
          const live = busesData[selectedBus.id];
          await map.setCamera({
            coordinate: { lat: live.lat, lng: live.lng },
            zoom: 17,
            animate: true,
          });
        }
      } catch (err) {
        console.error("[NativeMap] sync failed", err);
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, [busList, busesData, mapReady, selectedBus]);

  const focusSelectedBus = useCallback(() => {
    if (!selectedBus?.id) return;
    const live = busesData[selectedBus.id];
    if (!live) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    map
      .setCamera({ coordinate: { lat: live.lat, lng: live.lng }, zoom: 17, animate: true })
      .catch(() => {});
  }, [busesData, selectedBus]);

  useEffect(() => {
    focusSelectedBus();
  }, [focusSelectedBus]);

  return (
    <div className="absolute inset-0" style={{ backgroundColor: "transparent" }}>
      <capacitor-google-map
        ref={mapElementRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
        }}
      />

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] w-[90%] max-w-lg pointer-events-none">
        {mapError ? (
          <div
            className="rounded-2xl px-4 py-3 shadow-xl pointer-events-auto flex items-center gap-2 text-sm"
            style={{
              backgroundColor: "var(--app-surface)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.3)",
              backdropFilter: "blur(12px)",
            }}
          >
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            {mapError}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="rounded-2xl px-4 py-2.5 shadow-xl pointer-events-auto text-xs flex items-center gap-2 w-fit mx-auto"
              style={{
                backgroundColor: "var(--app-surface)",
                color: "var(--app-muted)",
                border: "1px solid var(--app-border)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
              />
              Google Maps
            </div>

            <div
              className="rounded-2xl px-4 py-2.5 shadow-xl pointer-events-auto text-xs flex items-center gap-2 w-fit mx-auto"
              style={{
                backgroundColor: "var(--app-surface)",
                color: "var(--app-muted)",
                border: "1px solid var(--app-border)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    wsConnected && wsAuthenticated ? "#22c55e" : "#f59e0b",
                  boxShadow:
                    wsConnected && wsAuthenticated
                      ? "0 0 6px #22c55e"
                      : "0 0 6px #f59e0b",
                }}
              />
              {wsConnected && wsAuthenticated ? "Live data connected" : "Connecting live data..."}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedBusLive && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="absolute left-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] -translate-x-1/2 z-[1100] w-[92%] max-w-lg pointer-events-none"
          >
            <div
              className="rounded-3xl shadow-2xl pointer-events-auto overflow-hidden"
              style={{
                backgroundColor: "var(--app-surface)",
                border: "1px solid var(--app-border)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div
                className="h-1 w-full"
                style={{
                  background: selectedBusLive.online
                    ? "linear-gradient(90deg, #22c55e, #3b82f6)"
                    : "linear-gradient(90deg, #64748b, #94a3b8)",
                }}
              />

              <div className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: selectedBusLive.online
                        ? "linear-gradient(135deg, #22c55e22, #3b82f622)"
                        : "rgba(100,116,139,0.12)",
                      border: "1px solid var(--app-border)",
                    }}
                  >
                    <Navigation2
                      className="h-5 w-5"
                      style={{
                        color: selectedBusLive.online ? "#22c55e" : "var(--app-muted)",
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div
                      className="font-semibold text-sm truncate"
                      style={{ color: "var(--app-text)" }}
                    >
                      {selectedBusLive.name || selectedBusLive.id}
                    </div>
                    {selectedBusLive.route ? (
                      <div
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {selectedBusLive.route}
                      </div>
                    ) : null}
                    <div className="text-xs mt-1.5 flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: selectedBusLive.online ? "#22c55e" : "#ef4444",
                          boxShadow: selectedBusLive.online ? "0 0 5px #22c55e" : "none",
                        }}
                      />
                      <span style={{ color: "var(--app-muted)" }}>
                        {selectedBusLive.timestamp
                          ? `Updated ${new Date(selectedBusLive.timestamp).toLocaleTimeString()}`
                          : selectedBusLive.online
                            ? "Live"
                            : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="rounded-xl p-2 flex-shrink-0 transition-opacity hover:opacity-70"
                  style={{ border: "1px solid var(--app-border)", color: "var(--app-muted)" }}
                  onClick={() => setSelectedBus(null)}
                  aria-label="Close selected bus"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ControlledMapSection
// ─────────────────────────────────────────────────────────────────────────────
const ControlledMapSection = memo(function ControlledMapSection({
  theme,
  busList,
  selectedBus,
  setSelectedBus,
  busesData,
  currentUser,
  authReady,
  wsConnected,
  wsAuthenticated,
  isVisible,
}) {
  const InfoCard = ({ title, subtitle }) => (
    <div className="absolute inset-0 flex items-center justify-center px-6 text-center pointer-events-none">
      <div
        className="max-w-md rounded-3xl p-6 shadow-xl pointer-events-auto"
        style={{
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
          border: "1px solid var(--app-border)",
        }}
      >
        <div className="text-base font-semibold">{title}</div>
        <div className="text-sm mt-2" style={{ color: "var(--app-muted)" }}>
          {subtitle}
        </div>
      </div>
    </div>
  );

  if (!authReady) {
    return <InfoCard title="Checking login…" subtitle="Waiting for authentication state." />;
  }

  if (!currentUser) {
    return (
      <InfoCard
        title="Login required"
        subtitle="GPS data and map access are available only after authentication."
      />
    );
  }

  return (
    <NativeGoogleMapSection
      theme={theme}
      busList={busList}
      selectedBus={selectedBus}
      setSelectedBus={setSelectedBus}
      busesData={busesData}
      isVisible={isVisible}
      wsConnected={wsConnected}
      wsAuthenticated={wsAuthenticated}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Policy Saving helper
// ─────────────────────────────────────────────────────────────────────────────
const saveConsentToFirebase = async (user) => {
  if (!user) return;
  try {
    const { getFirestore, doc, setDoc } = await import("firebase/firestore");
    const db = getFirestore(user.auth.app);
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      policyAccepted: true,
      policyAcceptedAt: new Date().toISOString()
    }, { merge: true });
    console.log("[AUTH] Consent flag successfully stored in Firebase.");
  } catch (err) {
    console.warn("[AUTH] Failed to save consent to Firebase:", err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedBus, setSelectedBus] = useState(null);
  const [splashFinished, setSplashFinished] = useState(false);
  
  // Track one-time Acceptance
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(
    () => localStorage.getItem("termsAccepted") === "true"
  );

  const [appState, setAppState] = useState(
    hasAcceptedTerms ? "app" : "terms"
  );
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!auth.currentUser);
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsAuthenticated, setWsAuthenticated] = useState(false);

  const [serverAppInit, setServerAppInit] = useState(null);
  const [busesData, setBusesData] = useState({});

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectRetryRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const activeUidRef = useRef(null);
  const connectingRef = useRef(false);
  const manualCloseRef = useRef(false);

  const isNative = Capacitor.isNativePlatform();
  const NAV_HEIGHT = 84;

  const busList = useMemo(() => Object.values(busesData), [busesData]);

  // Handle Terms Acceptance
  const handleAcceptTerms = () => {
    console.log("[TERMS] Accepted terms via button click");
    localStorage.setItem("termsAccepted", "true");
    setHasAcceptedTerms(true);
    setAppState("app");
    if (currentUser) {
      saveConsentToFirebase(currentUser);
    }
  };

  // Handle Terms Rejection
  const handleRejectTerms = () => {
    if (isNative) {
      CapacitorApp.exitApp();
    } else {
      alert("You must accept the Terms and Conditions to use this application.");
      window.location.href = "about:blank"; // Fallback to clear page on web
    }
  };

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const cleanupWebSocket = useCallback(() => {
    clearReconnectTimer();
    manualCloseRef.current = true;
    connectingRef.current = false;

    const ws = wsRef.current;
    wsRef.current = null;

    try {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    } catch {
      // ignore
    }

    setWsConnected(false);
    setWsAuthenticated(false);
  }, [clearReconnectTimer]);

  const resolveSocketToken = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.getIdToken();
        return result?.token || null;
      }

      const user = auth.currentUser;
      if (!user || typeof user.getIdToken !== "function") return null;
      
      return await user.getIdToken();
    } catch (err) {
      console.warn("[AUTH] token resolve failed", err);
      return null;
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (connectingRef.current) return;
    
    const currentWs = wsRef.current;
    if (
      currentWs &&
      (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    connectingRef.current = true;
    manualCloseRef.current = false;

    const token = await resolveSocketToken();
    if (!token) {
      console.warn("[WS] no token available");
      setWsConnected(false);
      setWsAuthenticated(false);
      connectingRef.current = false;
      return;
    }

    const WebSocketClass = window.WebSocket;
    if (!WebSocketClass) {
      console.warn("[WS] WebSocket not available in this environment");
      connectingRef.current = false;
      return;
    }

    const ws = new WebSocketClass(SOCKET_URL);
    wsRef.current = ws;
    setWsConnected(false);
    setWsAuthenticated(false);

    ws.onopen = () => {
      console.log("[WS] connected — authenticating");
      setWsConnected(true);
      connectingRef.current = false;

      try {
        ws.send(JSON.stringify({ type: "auth", token }));
      } catch (err) {
        console.warn("[WS] failed to send auth", err);
      }
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;

      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      if (data.type === "server_hello") return;

      if (data.type === "auth_ok") {
        console.log("[WS] auth_ok");
        setWsAuthenticated(true);
        if (data.appInit) setServerAppInit(data.appInit);
        try { ws.send(JSON.stringify({ type: "get_init" })); } catch {}
        return;
      }

      if (data.type === "app_init") {
        setServerAppInit(data.state || null);
        return;
      }

      if (data.type === "auth_fail" || data.type === "auth_required") {
        setWsAuthenticated(false);
        return;
      }

      if (data.type === "init" && data.data && typeof data.data === "object") {
        const newData = {};
        Object.keys(data.data).forEach((busId) => {
          const d = data.data[busId];
          if (!validateBusPayload(d)) return;
          newData[busId] = normalizeBus(busId, d);
        });
        setBusesData(newData);
        return;
      }

      if (data.type === "offline" && data.busId) {
        const busId = String(data.busId).slice(0, 50);
        setBusesData((prev) => {
          if (!prev[busId]) return prev;
          return { ...prev, [busId]: { ...prev[busId], online: false } };
        });
        return;
      }

      if (data.busId) {
        const busId = String(data.busId).slice(0, 50);
        if (!validateBusPayload(data)) return;

        const now = Date.now();
        if (now - lastUpdateRef.current < 100) return;
        lastUpdateRef.current = now;

        setBusesData((prev) => {
          const normalized = normalizeBus(busId, data);
          const existing = prev[busId];
          return {
            ...prev,
            [busId]: existing ? { ...existing, ...normalized } : normalized,
          };
        });
      }
    };

    ws.onerror = (e) => console.warn("[WS] error", e);

    ws.onclose = () => {
      setWsConnected(false);
      setWsAuthenticated(false);
      connectingRef.current = false;
      wsRef.current = null;

      if (manualCloseRef.current || !activeUidRef.current) return;

      const delay = Math.min(1000 * 2 ** reconnectRetryRef.current, 30000);
      reconnectRetryRef.current += 1;

      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket().catch((err) => console.warn("[WS] reconnect error:", err));
      }, delay);
    };
  }, [clearReconnectTimer, resolveSocketToken]); 

  // Capacitor back button
  useEffect(() => {
    if (!isNative) return;

    let listener;
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (!canGoBack) {
        CapacitorApp.exitApp();
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove?.();
    };
  }, [isNative]);

  // Make native background transparent so the map can show through
  useEffect(() => {
    if (!isNative) return;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");

    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevRootBg = root?.style.backgroundColor || "";

    html.style.backgroundColor = "transparent";
    body.style.backgroundColor = "transparent";
    if (root) root.style.backgroundColor = "transparent";

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      if (root) root.style.backgroundColor = prevRootBg;
    };
  }, [isNative]);

  // Language
  const [language, setLanguage] = useState(
    () => localStorage.getItem("appLanguage") || "en"
  );
  useEffect(() => {
    localStorage.setItem("appLanguage", language);
  }, [language]);
  const t = translations[language];

  // Theme
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

  // Auth / onboarding flow for Web
  useEffect(() => {
    if (isNative) {
      setAuthReady(true);
      return;
    }

    const unsub = onIdTokenChanged(auth, async (user) => {
      setAuthReady(true);
      setCurrentUser(user || null);
      setIsLoggedIn(!!user);

      if (!user) {
        activeUidRef.current = null;
        cleanupWebSocket();
        setServerAppInit(null);
        setBusesData({});
        setSelectedBus(null);
        return;
      }
      
      // Save consent to Firebase if accepted
      if (hasAcceptedTerms) {
        saveConsentToFirebase(user);
      }

      if (hasAcceptedTerms) setAppState("app");

      if (activeUidRef.current === user.uid) return;

      activeUidRef.current = user.uid;
      reconnectRetryRef.current = 0;
      console.log("[AUTH] web token ready, connecting websocket");
      connectWebSocket();
    });

    return () => {
      unsub();
      cleanupWebSocket();
    };
  }, [cleanupWebSocket, connectWebSocket, isNative, hasAcceptedTerms]);

  // Auth flow for Native (Profile.jsx handles token internally)
  useEffect(() => {
    if (!isNative) return;
    setIsLoggedIn(!!currentUser);

    if (!currentUser) {
      activeUidRef.current = null;
      cleanupWebSocket();
      setServerAppInit(null);
      setBusesData({});
      setSelectedBus(null);
      return;
    }

    // Save consent to Firebase if accepted
    if (hasAcceptedTerms) {
      saveConsentToFirebase(currentUser);
    }

    if (hasAcceptedTerms) setAppState("app");

    const uid = currentUser?.uid || null;
    if (uid && activeUidRef.current === uid) return;

    activeUidRef.current = uid;
    reconnectRetryRef.current = 0;
    connectWebSocket();
  }, [cleanupWebSocket, connectWebSocket, currentUser, isNative, hasAcceptedTerms]);

  // Keep tab sane when auth changes
  useEffect(() => {
    if (!isLoggedIn) {
      setActiveTab("Profile");
    }
  }, [isLoggedIn]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

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

  if (!splashFinished) {
    return (
      <SplashScreen
        onFinish={() => {
          setSplashFinished(true);
        }}
      />
    );
  }

  // --- NEW TERMS ENFORCEMENT ---
  if (appState === "terms") {
    // If the app freezes here immediately after the splash completion, 
    // it means there is an error inside your Terms.jsx file.
    return <Terms onAccept={handleAcceptTerms} onReject={handleRejectTerms} onBack={handleAcceptTerms} />;
  }

  // The ProtectedWrapper is purposefully removed from wrapping the overall UI
  // because the `Profile` tab must be accessible when logged out.
  return (
    <div
      className="relative w-full h-dvh overflow-hidden transition-colors duration-300 pt-safe"
      style={{
        backgroundColor:
          isNative && activeTab === "Home" ? "transparent" : "var(--app-bg)",
        color: "var(--app-text)",
      }}
    >
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

      {activeTab === "Home" && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-lg z-[1000]">
          <div
            className="flex items-center rounded-2xl shadow-lg px-3 py-2.5"
            style={{
              backgroundColor: "var(--app-surface)",
              border: `1px solid var(--app-border)`,
              backdropFilter: "blur(16px)",
            }}
          >
            <Search
              className="h-5 w-5 mr-2 flex-shrink-0"
              style={{ color: "var(--app-muted)" }}
            />
            <input
              className="flex-1 outline-none bg-transparent text-sm"
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

          <AnimatePresence>
            {filtered.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-2 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  backgroundColor: "var(--app-surface)",
                  border: `1px solid var(--app-border)`,
                  backdropFilter: "blur(16px)",
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
                className="mt-2 rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "var(--app-surface)",
                  color: "var(--app-muted)",
                  border: `1px solid var(--app-border)`,
                  backdropFilter: "blur(16px)",
                }}
              >
                No buses found for &ldquo;{debouncedQuery}&rdquo;
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{
          display: activeTab === "Home" ? "block" : "none",
          backgroundColor: "transparent",
          paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
        }}
      >
        <ControlledMapSection
          theme={theme}
          busList={busList}
          selectedBus={selectedBus}
          setSelectedBus={setSelectedBus}
          busesData={busesData}
          currentUser={currentUser}
          authReady={authReady}
          wsConnected={wsConnected}
          wsAuthenticated={wsAuthenticated}
          isVisible={activeTab === "Home"}
        />
      </div>

      <div
        className="absolute inset-0 overflow-y-auto"
        style={{
          display: activeTab === "Routes" ? "block" : "none",
          paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
        }}
      >
        <Routes buses={busList} theme={theme} t={t} />
      </div>

      <div
        className="absolute inset-0 overflow-y-auto flex items-start justify-center"
        style={{
          display: activeTab === "Profile" ? "flex" : "none",
          paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
        }}
      >
        <Profile
          selectedLanguage={language}
          onLanguageChange={(lang) => setLanguage(lang)}
          onLoginSuccess={() => {
            setIsLoggedIn(true);
            setAppState("app");
            setActiveTab("Home");
          }}
          onAuthChange={(user) => {
            setCurrentUser(user || null);
            setIsLoggedIn(!!user);
            if (user && hasAcceptedTerms) {
              setAppState("app");
            }
          }}
          theme={theme}
          onThemeChange={setTheme}
        />
      </div>

      <div
        className="fixed bottom-0 left-0 w-full flex justify-around py-3 md:py-4 z-[3000] shadow-lg"
        style={{
          backgroundColor: "var(--app-nav)",
          borderTop: `1px solid var(--app-border)`,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)",
          paddingTop: "12px",
        }}
      >
        {isLoggedIn && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab("Home")}
            className="flex flex-col items-center text-sm min-w-[72px]"
            style={{
              color:
                activeTab === "Home"
                  ? "var(--app-nav-active)"
                  : "var(--app-nav-inactive)",
            }}
          >
            <Home className="h-6 w-6 mb-1" />
            <span style={{ fontWeight: activeTab === "Home" ? 700 : 500 }}>
              {t.home}
            </span>
          </motion.button>
        )}

        {isLoggedIn && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveTab("Routes")}
            className="flex flex-col items-center text-sm min-w-[72px]"
            style={{
              color:
                activeTab === "Routes"
                  ? "var(--app-nav-active)"
                  : "var(--app-nav-inactive)",
            }}
          >
            <MapIcon className="h-6 w-6 mb-1" />
            <span style={{ fontWeight: activeTab === "Routes" ? 700 : 500 }}>
              {t.routes}
            </span>
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab("Profile")}
          className="flex flex-col items-center text-sm min-w-[72px]"
          style={{
            color:
              activeTab === "Profile"
                ? "var(--app-nav-active)"
                : "var(--app-nav-inactive)",
          }}
        >
          <User className="h-6 w-6 mb-1" />
          <span style={{ fontWeight: activeTab === "Profile" ? 700 : 500 }}>
            {t.profile}
          </span>
        </motion.button>
      </div>
    </div>
  );
}