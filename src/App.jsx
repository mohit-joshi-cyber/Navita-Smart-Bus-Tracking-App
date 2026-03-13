// src/App.jsx
import { useState, useEffect } from "react";
import { translations } from "./translations";
import Profile from "./profile";
import ProtectedWrapper from "./ProtectedWrapper";
import { auth } from "./firebase";
import axios from "axios"; // Replace nativeFetch with axios

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Home, Map, User, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SplashScreen from "./SplashScreen";
import Features from "./Features";
import Routes from "./Routes";
import { getPushModule } from "./pushHelper";

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Default static positions for buses (except live bus 1)
const busPositions = {
  1: [24.586, 73.696],
  2: [24.589, 73.72],
  3: [24.603, 73.71],
};

function ZoomToBus({ selectedBus, bus1Location }) {
  const map = useMap();
  useEffect(() => {
    if (selectedBus) {
      const position =
        selectedBus.id === 1 ? bus1Location : busPositions[selectedBus.id];
      map.setView(position, 17, { animate: true });
    }
  }, [selectedBus, bus1Location, map]);
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [query, setQuery] = useState("");
  const [selectedBus, setSelectedBus] = useState(null);

  // Splash + Features
  const [showSplash, setShowSplash] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [featureStep, setFeatureStep] = useState(0);

  // Language
  const [language, setLanguage] = useState(
    () => localStorage.getItem("appLanguage") || "en"
  );
  useEffect(() => {
    localStorage.setItem("appLanguage", language);
  }, [language]);
  const t = translations[language];
  const buses = t.buses;

  // Theme
  const [theme, setTheme] = useState(() => {
    if (localStorage.getItem("theme")) {
      return localStorage.getItem("theme");
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Login success
  const handleLoginSuccess = () => {
    setShowFeatures(false);
    localStorage.setItem("hasSeenFeatures", "true");
  };

  // Splash + Features lifecycle
  useEffect(() => {
    const hasSeenSplash = localStorage.getItem("hasSeenSplash");
    const hasSeenFeatures = localStorage.getItem("hasSeenFeatures");

    if (!hasSeenSplash) {
      setShowSplash(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
        localStorage.setItem("hasSeenSplash", "true");
        if (!hasSeenFeatures) setShowFeatures(true);
      }, 2500);
      return () => clearTimeout(timer);
    } else if (!hasSeenFeatures) {
      setShowFeatures(true);
    }
  }, []);

  // Firebase auth persistence
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await user.getIdToken(true);
        if (showFeatures && featureStep === 2) {
          setShowFeatures(false);
          localStorage.setItem("hasSeenFeatures", "true");
        }
      }
    });
    return () => unsub();
  }, [showFeatures, featureStep]);

  // Bus state
  const [bus1Location, setBus1Location] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lastBusLocations") || "{}");
      if (saved["BUS-4"]?.latitude && saved["BUS-4"]?.longitude) {
        return [saved["BUS-4"].latitude, saved["BUS-4"].longitude];
      }
    } catch {}
    return busPositions[1];
  });
  const [bus1Online, setBus1Online] = useState(false);
  const [bus1LastSeen, setBus1LastSeen] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lastBusLocations") || "{}");
      return saved["BUS-4"]?.timestamp || null;
    } catch {}
    return null;
  });

  // Poll GPS API with axios
  useEffect(() => {
    let isMounted = true;
    const fetchLocation = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          if (isMounted) setBus1Online(false);
          return;
        }
        const token = await user.getIdToken(false);

        // Use axios instead of nativeFetch
        const response = await axios.get("https://api.navitaserver.dpdns.org/location/BUS-4", {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });

        if (response.status >= 200 && response.status < 300) {
          const data = response.data;
          if (typeof data?.latitude === "number" && typeof data?.longitude === "number") {
            const newLoc = [data.latitude, data.longitude];
            if (isMounted) {
              setBus1Location(newLoc);
              const ts = data.timestamp || new Date().toISOString();
              setBus1LastSeen(ts);

              const store = JSON.parse(localStorage.getItem("lastBusLocations") || "{}");
              store["BUS-4"] = { latitude: data.latitude, longitude: data.longitude, timestamp: ts };
              localStorage.setItem("lastBusLocations", JSON.stringify(store));

              setBus1Online(true);
            }
            return;
          }
        }
        setBus1Online(false);
      } catch (err) {
        console.warn("GPS fetch failed:", err);
        if (isMounted) setBus1Online(false);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Init push notifications
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
          PushNotifications.addListener("registration", (token) => {
            console.log("📲 Push token:", token.value);
          });
          PushNotifications.addListener("pushNotificationReceived", (notif) => {
            console.log("📩 Push received:", notif);
            notifyUser(notif.title, notif.body);
          });
        }
      } catch (err) {
        console.error("Push init failed:", err);
      }
    };
    initPush();
  }, []);

  // Bus search
  const filtered = query
    ? buses.filter(
        (bus) =>
          bus.name.toLowerCase().includes(query.toLowerCase()) ||
          bus.route.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  // UI early returns
  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;
  if (showFeatures)
    return (
      <Features
        language={language}
        setLanguage={setLanguage}
        onFinish={() => {
          setShowFeatures(false);
          localStorage.setItem("hasSeenFeatures", "true");
        }}
      />
    );

  // Common colors
  const textPrimary = theme === "dark" ? "text-gray-100" : "text-gray-900";
  const cardBg = theme === "dark" ? "bg-gray-800" : "bg-gray-100";
  const searchBg = theme === "dark" ? "bg-gray-800" : "bg-white";

  return (
    <ProtectedWrapper>
      <div
        className={`relative w-full h-screen overflow-hidden transition-colors duration-300 ${textPrimary}`}
        style={{
          backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
          color: theme === "dark" ? "#e6eef8" : "#0f172a",
        }}
      >
        {/* Theme toggle */}
        <div className="absolute top-3 right-3 z-[2000]">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`px-3 py-1 rounded-lg text-sm ${
              theme === "dark"
                ? "bg-gray-700 text-gray-100"
                : "bg-gray-200 text-gray-900"
            }`}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {/* Search */}
        {activeTab === "Home" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-lg z-[1000]">
            <div className={`flex items-center rounded-xl shadow-md px-3 py-2 ${searchBg}`}>
              <Search className={`h-5 w-5 mr-2 ${theme === "dark" ? "text-gray-300" : "text-gray-500"}`} />
              <input
                className={`flex-1 outline-none bg-transparent ${theme === "dark" ? "text-gray-100" : "text-gray-700"}`}
                type="text"
                placeholder={t.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <AnimatePresence>
              {filtered.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mt-2 rounded-lg shadow-xl overflow-hidden ${cardBg}`}
                >
                  {filtered.map((bus) => (
                    <li
                      key={bus.id}
                      className={`px-4 py-2 cursor-pointer ${theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                      onClick={() => {
                        setQuery("");
                        setSelectedBus(bus);
                        setActiveTab("Home");
                      }}
                    >
                      <strong>{bus.name}</strong> – {bus.route}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Pages */}
        <AnimatePresence mode="wait">
          {activeTab === "Home" && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <MapContainer center={[24.5854, 73.7125]} zoom={13} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
                  url={
                    theme === "dark"
                      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  }
                />
                {buses.map((bus) => (
                  <Marker key={bus.id} position={bus.id === 1 ? bus1Location : busPositions[bus.id]}>
                    <Popup>
                      <strong>{bus.name}</strong>
                      <br />
                      {bus.route}
                    </Popup>
                  </Marker>
                ))}
                {selectedBus && (
                  <CircleMarker
                    center={selectedBus.id === 1 ? bus1Location : busPositions[selectedBus.id]}
                    radius={20}
                    pathOptions={{ color: theme === "dark" ? "#60a5fa" : "blue", fillOpacity: 0.3 }}
                  />
                )}
                <ZoomToBus selectedBus={selectedBus} bus1Location={bus1Location} />
              </MapContainer>
            </motion.div>
          )}

          {activeTab === "Routes" && <Routes buses={buses} theme={theme} t={t} bus1Online={bus1Online} />}

          {activeTab === "Profile" && (
            <motion.div key="profile" initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
              <Profile
                selectedLanguage={language}
                onLanguageChange={(lang) => setLanguage(lang)}
                onLoginSuccess={handleLoginSuccess}
                theme={theme}
                onThemeChange={setTheme}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Nav */}
        <div className="fixed bottom-0 left-0 w-full shadow-lg flex justify-around py-3 md:py-4 z-[1000]">
          {[
            { name: "Home", icon: Home, label: t.home },
            { name: "Routes", icon: Map, label: t.routes },
            { name: "Profile", icon: User, label: t.profile },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            const activeColor = theme === "dark" ? "#60a5fa" : "#2563eb";
            const inactiveColor = theme === "dark" ? "#94a3b8" : "#475569";
            return (
              <motion.button
                key={item.name}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab(item.name)}
                className="flex flex-col items-center text-sm"
                style={{ color: isActive ? activeColor : inactiveColor }}
              >
                <Icon className="h-6 w-6 mb-1" />
                <span style={{ fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </ProtectedWrapper>
  );
}