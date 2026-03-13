
// src/Routes.jsx
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Map as MapIcon, Phone, Star } from "lucide-react";
import { auth } from "./firebase";
import axios from "axios"; // Import axios for potential future use

// Add console logging for Android debugging
console.log("Routes component loaded - Axios available:", typeof axios !== 'undefined');

/**
 * Helper: Haversine distance (km) between two [lat, lng] points
 */
function haversineKm([lat1, lon1], [lat2, lon2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Routes component
 */
export default function Routes({
  buses = [],
  theme = "light",
  t = { routes: "Routes", online: "Online", offline: "Offline", driver: "Driver" },
  bus1Online = false,
  bus1Location = null,
  busPositions = {},
}) {
  // Log bus status changes for debugging
  useEffect(() => {
    console.log(`Bus 1 status changed to: ${bus1Online ? 'ONLINE' : 'OFFLINE'}`);
    console.log(`Bus 1 location: ${bus1Location ? bus1Location.join(', ') : 'Unknown'}`);
  }, [bus1Online, bus1Location]);

  // Favorites: persisted per-user
  const uid = auth?.currentUser?.uid || "guest";
  const favKey = `navita_favorites_${uid}`;

  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem(favKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Notifications
  const isWebNotificationSupported = typeof Notification !== "undefined";
  const [notifPermission, setNotifPermission] = useState(
    isWebNotificationSupported ? Notification.permission : "unsupported"
  );

  const [toast, setToast] = useState(null);

  const notifCooldownMins = 30;
  const notifiedRef = useRef({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("navita_notified_ts") || "{}";
      notifiedRef.current = JSON.parse(raw);
    } catch {
      notifiedRef.current = {};
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(favKey, JSON.stringify(favorites));
    } catch (e) {
      console.warn("Failed to persist favorites", e);
    }
  }, [favorites, favKey]);

  // Ask for permission
  useEffect(() => {
    if (!isWebNotificationSupported) {
      setNotifPermission("unsupported");
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setNotifPermission(perm);
        if (perm === "denied") {
          setToast("Notifications are blocked. Enable them in browser settings.");
          setTimeout(() => setToast(null), 6000);
        }
      });
    } else {
      setNotifPermission(Notification.permission);
    }
  }, [isWebNotificationSupported]);

  const toggleFavorite = (busId) => {
    setFavorites((prev) =>
      prev.includes(busId) ? prev.filter((id) => id !== busId) : [...prev, busId]
    );
  };

  const getBusPosition = (bus) => {
    if (bus.id === 1 && Array.isArray(bus1Location) && bus1Location.length === 2) {
      return bus1Location;
    }
    if (busPositions && busPositions[bus.id]) return busPositions[bus.id];
    if (typeof bus.latitude === "number" && typeof bus.longitude === "number") {
      return [bus.latitude, bus.longitude];
    }
    return null;
  };

  function findNextStop(bus, busPos) {
    if (bus.nextStop && bus.nextStop.name && typeof bus.nextStop.lat === "number") {
      return { name: bus.nextStop.name, coords: [bus.nextStop.lat, bus.nextStop.lng] };
    }
    if (bus.nextStopName && typeof bus.nextStopLat === "number") {
      return { name: bus.nextStopName, coords: [bus.nextStopLat, bus.nextStopLng] };
    }
    if (Array.isArray(bus.stops) && bus.stops.length > 0 && busPos) {
      let nearest = null;
      let nearestD = Infinity;
      for (const s of bus.stops) {
        if (typeof s.lat === "number" && typeof s.lng === "number") {
          const d = haversineKm(busPos, [s.lat, s.lng]);
          if (d < nearestD) {
            nearestD = d;
            nearest = s;
          }
        }
      }
      if (nearest) return { name: nearest.name || "Stop", coords: [nearest.lat, nearest.lng] };
    }
    return null;
  }

  function computeEtaMinutes(bus, busPos, stopCoords) {
    if (!busPos || !stopCoords) return null;
    const distanceKm = haversineKm(busPos, stopCoords);
    const avgSpeed = bus.avgSpeedKmph || 20;
    if (avgSpeed <= 0) return null;
    const mins = (distanceKm / avgSpeed) * 60;
    if (mins < 1) return "<1";
    return Math.round(mins);
  }

  function sendEtaNotification(bus, etaMin) {
    const title = "Navita — Bus arriving";
    const body = `Your bus ${bus.name} is arriving in ${etaMin} min.`;
    const tag = `navita_bus_${bus.id}`;

    const key = `${uid}_${bus.id}`;
    notifiedRef.current[key] = Date.now();
    try {
      localStorage.setItem("navita_notified_ts", JSON.stringify(notifiedRef.current));
    } catch {}

    if (isWebNotificationSupported && notifPermission === "granted") {
      try {
        new Notification(title, { body, tag, renotify: true });
      } catch {
        setToast(body);
        setTimeout(() => setToast(null), 5000);
      }
    } else {
      setToast(body);
      setTimeout(() => setToast(null), 5000);
    }
  }

  // Periodically check ETAs
  useEffect(() => {
    if (!buses || buses.length === 0) return;
    const checkAll = () => {
      buses.forEach((bus) => {
        const pos = getBusPosition(bus);
        const next = findNextStop(bus, pos);
        if (!pos || !next) return;
        const eta = computeEtaMinutes(bus, pos, next.coords);
        if (typeof eta === "number" && eta <= 5) {
          const key = `${uid}_${bus.id}`;
          const lastTs = notifiedRef.current[key] || 0;
          const minsSince = (Date.now() - lastTs) / (1000 * 60);
          if (minsSince >= notifCooldownMins) {
            sendEtaNotification(bus, eta);
          }
        }
      });
    };
    checkAll();
    const interval = setInterval(checkAll, 15000);
    return () => clearInterval(interval);
  }, [buses, bus1Location, busPositions, notifPermission]);

  const cardBg = theme === "dark" ? "#0b1220" : "#f3f4f6";
  const border = theme === "dark" ? "#1f2937" : "#e5e7eb";

  return (
    <motion.div
      key="routes"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      className="absolute inset-0 flex flex-col h-full"
      style={{
        background: theme === "dark"
          ? "linear-gradient(180deg,#0f172a 0%, #111827 100%)"
          : "linear-gradient(180deg,#ffffff 0%, #f8fafc 100%)",
      }}
    >
      <div
        className="p-6 shrink-0 z-10"
        style={{
          backgroundColor: theme === "dark" ? "#0b1220" : "#ffffff",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <h2 className={`text-2xl font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-800"}`}>
          {t.routes}
        </h2>
        <p className="text-xs text-gray-400 mt-1">Notifications: {notifPermission}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {buses.map((bus) => {
            const pos = getBusPosition(bus);
            const next = findNextStop(bus, pos);
            const eta = next ? computeEtaMinutes(bus, pos, next.coords) : null;
            const isFav = favorites.includes(bus.id);

            return (
              <motion.div
                key={bus.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden"
                style={{ backgroundColor: cardBg, border: `1px solid ${border}` }}
              >
                <div className="p-5 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-gray-100" : "text-gray-800"}`}>
                      {bus.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <motion.span
                        key={bus.id === 1 && bus1Online ? "online" : "offline"}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="text-xs font-semibold px-3 py-1 rounded-full"
                        style={{
                          backgroundColor:
                            bus.id === 1 && bus1Online
                              ? theme === "dark" ? "#0b3b13" : "#dcfce7"
                              : theme === "dark" ? "#3b1010" : "#fee2e2",
                          color:
                            bus.id === 1 && bus1Online
                              ? theme === "dark" ? "#9ae6b4" : "#166534"
                              : theme === "dark" ? "#fca5a5" : "#7f1d1d",
                        }}
                      >
                        {bus.id === 1 && bus1Online ? t.online : t.offline}
                      </motion.span>
                      <button onClick={() => toggleFavorite(bus.id)} className="p-1">
                        <Star
                          className={`h-5 w-5 ${
                            isFav ? "text-yellow-400 fill-yellow-400" : theme === "dark" ? "text-gray-400" : "text-gray-500"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <p className={`text-sm flex items-center ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                    <MapIcon className={`h-4 w-4 mr-2 ${theme === "dark" ? "text-blue-300" : "text-blue-500"}`} />
                    {bus.route}
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>
                        Next Stop: <strong>{next?.name || "—"}</strong>
                      </p>
                      <p className={`text-sm ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                        ETA: {eta === null ? "—" : `${eta} min`}
                      </p>
                    </div>
                    {bus.driver && (
                      <div
                        className="rounded-xl p-3"
                        style={{
                          backgroundColor: theme === "dark" ? "#0f172a" : "#e6eef8",
                          border: `1px solid ${theme === "dark" ? "#1f2937" : "#d1d5db"}`,
                        }}
                      >
                        <p className={`text-sm font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-800"}`}>
                          {t.driver}: {bus.driver.name}
                        </p>
                        <p className={`flex items-center text-sm mt-1 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                          <Phone className={`h-4 w-4 mr-1 ${theme === "dark" ? "text-gray-300" : "text-gray-400"}`} />
                          {bus.driver.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-[2000]" style={{ background: "#111827", color: "#fff" }}>
          {toast}
        </div>
      )}
    </motion.div>
  );
}