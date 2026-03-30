// src/Routes.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Map as MapIcon, Phone, Star, Route as RouteIcon, Clock } from "lucide-react";
import { auth } from "./firebase";
import { ROUTES_DB as DEFAULT_ROUTES_DB } from "./routesData";

// =========================
// Distance helpers
// =========================
function haversineKm([lat1, lon1], [lat2, lon2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function formatMinutesFromMeters(distanceM, speedKmph = 20) {
  if (!isFiniteNumber(distanceM) || distanceM < 0) return null;
  const safeSpeed = Math.max(1, speedKmph || 20);
  return Math.max(1, Math.round((distanceM / 1000 / safeSpeed) * 60));
}

function formatDistance(distanceM) {
  if (!isFiniteNumber(distanceM)) return "—";
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

function getNearestStopIndex(pos, stops) {
  let minDist = Infinity;
  let index = -1;

  stops.forEach((stop, i) => {
    const d = haversineKm(pos, [stop.lat, stop.lng]);
    if (d < minDist) {
      minDist = d;
      index = i;
    }
  });

  return { index, distanceKm: minDist };
}

function deriveFallbackState(bus, pos, route) {
  if (!route?.stops?.length || !pos) {
    return {
      status: "NO_DATA",
      message: "No route data",
      currentStop: null,
      nextStop: null,
      distanceToNextStopM: null,
      etaMin: null,
      source: "fallback",
    };
  }

  const { index, distanceKm } = getNearestStopIndex(pos, route.stops);
  const nearest = route.stops[index];
  const nextIndex = (index + 1) % route.stops.length;
  const next = route.stops[nextIndex];
  const distanceM = distanceKm * 1000;
  const atStop = distanceM <= (nearest.radiusM ?? 40);

  return {
    status: atStop ? "AT_STOP" : "EN_ROUTE",
    message: atStop ? `At ${nearest.name}` : `Between ${nearest.name} → ${next.name}`,
    currentStop: nearest,
    nextStop: atStop ? nearest : next,
    distanceToNextStopM: atStop ? 0 : Math.round(distanceM),
    etaMin: atStop ? 0 : formatMinutesFromMeters(distanceM, bus.avgSpeedKmph || 20),
    source: "fallback",
  };
}

function getLiveState(bus, route, pos) {
  const live = bus?.uiState || bus?.routeState || null;
  if (live) {
    return {
      status: live.status || bus.status || "IDLE",
      message: live.message || "",
      currentStop: live.currentStop || null,
      nextStop: live.nextStop || null,
      segment: live.segment || null,
      progressPct: isFiniteNumber(live.progressPct) ? live.progressPct : null,
      progressM: isFiniteNumber(live.progressM) ? live.progressM : null,
      distanceToNextStopM: isFiniteNumber(live.distanceToNextStopM) ? live.distanceToNextStopM : null,
      dwellMs: isFiniteNumber(live.dwellMs) ? live.dwellMs : null,
      etaMin: isFiniteNumber(live.distanceToNextStopM)
        ? formatMinutesFromMeters(live.distanceToNextStopM, bus.avgSpeedKmph || 20)
        : null,
      source: "engine",
    };
  }

  return deriveFallbackState(bus, pos, route);
}

function getStatusPalette(status, isDark) {
  const s = String(status || "").toUpperCase();

  if (s === "AT_STOP") {
    return {
      badge: isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700",
      chip: "bg-yellow-500",
      panel: isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-200",
    };
  }

  if (s === "APPROACHING_STOP") {
    return {
      badge: isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700",
      chip: "bg-amber-500",
      panel: isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200",
    };
  }

  if (s === "DEPARTING") {
    return {
      badge: isDark ? "bg-cyan-500/20 text-cyan-300" : "bg-cyan-100 text-cyan-700",
      chip: "bg-cyan-500",
      panel: isDark ? "bg-cyan-500/10 border-cyan-500/20" : "bg-cyan-50 border-cyan-200",
    };
  }

  if (s === "OFF_ROUTE") {
    return {
      badge: isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-700",
      chip: "bg-red-500",
      panel: isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200",
    };
  }

  if (s === "IDLE" || s === "NO_DATA") {
    return {
      badge: isDark ? "bg-slate-500/20 text-slate-300" : "bg-slate-100 text-slate-700",
      chip: "bg-slate-500",
      panel: isDark ? "bg-slate-500/10 border-slate-500/20" : "bg-slate-50 border-slate-200",
    };
  }

  return {
    badge: isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700",
    chip: "bg-blue-500",
    panel: isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200",
  };
}

export default function Routes({
  buses = [],
  theme = "dark",
  t = {},
  routesDb = DEFAULT_ROUTES_DB,
}) {
  const [mode, setMode] = useState("live");
  const [toast, setToast] = useState(null);

  const isDark = theme === "dark";

  const uid = auth?.currentUser?.uid || "guest";
  const favKey = `navita_fav_${uid}`;

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(favKey)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(favKey, JSON.stringify(favorites));
  }, [favorites, favKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      setToast(prev.includes(id) ? "Removed from favorites" : "Saved to favorites");
      return next;
    });
  };

  const getBusPosition = (bus) => {
    if (isFiniteNumber(bus?.lat) && isFiniteNumber(bus?.lng)) return [bus.lat, bus.lng];
    return null;
  };

  const busCards = useMemo(() => buses || [], [buses]);

  return (
    <div
      className={`absolute inset-0 flex flex-col ${
        isDark ? "bg-gradient-to-b from-[#0f172a] to-[#020617]" : "bg-gray-50"
      }`}
    >
      <div className="px-5 pt-6 pb-4">
        <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
          {t.routes || "Routes"}
        </h1>

        <div className="mt-4 flex bg-opacity-20 backdrop-blur-md rounded-xl p-1 w-fit border border-white/10">
          {["live", "daily"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
                mode === m
                  ? "bg-blue-500 text-white shadow"
                  : isDark
                    ? "text-gray-400"
                    : "text-gray-600"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-20 grid gap-4">
        {busCards.map((bus) => {
          const route = routesDb?.[bus.id] || null;
          const pos = getBusPosition(bus);
          const liveState = getLiveState(bus, route, pos);
          const isFav = favorites.includes(bus.id);
          const statusPalette = getStatusPalette(liveState.status, isDark);
          const routeName = route?.name || bus.name || bus.id;
          const routeLabel = route?.routeId || bus.id;

          return (
            <motion.div
              key={bus.id}
              whileHover={{ scale: 1.015 }}
              className={`rounded-2xl p-4 border backdrop-blur-xl ${
                isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <h3 className={`font-semibold text-lg truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                    {routeName}
                  </h3>
                  <p className={`text-xs truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {routeLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      bus.online ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {bus.online ? "LIVE" : "OFFLINE"}
                  </span>

                  <Star
                    onClick={() => toggleFavorite(bus.id)}
                    className={`w-5 h-5 cursor-pointer ${
                      isFav ? "text-yellow-400 fill-yellow-400" : "text-gray-400"
                    }`}
                  />
                </div>
              </div>

              {mode === "live" ? (
                <div className="mt-4">
                  {bus.online ? (
                    <div className="mt-3 space-y-3">
                      <div className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between border ${statusPalette.panel}`}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${statusPalette.chip}`} />
                          <span>{String(liveState.status || "EN_ROUTE")}</span>
                        </span>
                        <span className="font-semibold text-right max-w-[62%] truncate">
                          {liveState.message || "Live route update"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Current Stop</span>
                          <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                            {liveState.currentStop?.name || "—"}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Next Stop</span>
                          <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                            {liveState.nextStop?.name || "—"}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Distance</span>
                          <span className={`font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}>
                            {formatDistance(liveState.distanceToNextStopM)}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">ETA</span>
                          <span className={`font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}>
                            {isFiniteNumber(liveState.etaMin) ? `${liveState.etaMin} min` : "—"}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-gray-400">Progress</span>
                          <span className={`font-semibold ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                            {isFiniteNumber(liveState.progressPct) ? `${liveState.progressPct}%` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="h-2 rounded-full overflow-hidden bg-white/10">
                        <div
                          className={`h-full ${statusPalette.chip}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, liveState.progressPct ?? 0))}%`,
                          }}
                        />
                      </div>

                      {isFiniteNumber(liveState.dwellMs) && liveState.dwellMs > 0 && (
                        <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          Dwell: {Math.round(liveState.dwellMs / 1000)}s
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-400 text-sm mt-2">Bus not running</div>
                  )}
                </div>
              ) : (
                <div className="mt-4 text-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <RouteIcon size={14} className={isDark ? "text-blue-300" : "text-blue-600"} />
                    <p className={isDark ? "text-gray-300" : "text-gray-600"}>Stops</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {route?.stops?.map((s, i) => (
                      <span
                        key={`${s.id || i}-${i}`}
                        className={`text-xs px-2 py-1 rounded ${
                          isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>

                  <p className={`mt-4 mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>Schedule</p>
                  <div className="flex gap-2 flex-wrap">
                    {route?.schedule?.length ? (
                      route.schedule.map((time, i) => (
                        <span
                          key={`${time}-${i}`}
                          className={`text-xs px-2 py-1 rounded ${
                            isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {time}
                        </span>
                      ))
                    ) : (
                      <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                        No schedule data
                      </span>
                    )}
                  </div>

                  <div className={`mt-4 rounded-xl p-3 border ${statusPalette.panel}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} />
                      <span className="text-xs uppercase tracking-wide">Current live engine state</span>
                    </div>
                    <div className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      {liveState.status}
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {liveState.message || "No live state"}
                    </div>
                  </div>
                </div>
              )}

              {route?.driver && (
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <div>
                    <p className="text-xs text-gray-400">Driver</p>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      {route.driver.name}
                    </p>
                  </div>

                  <a
                    href={`tel:${route.driver.phone}`}
                    className="flex items-center gap-1 text-sm text-blue-400"
                  >
                    <Phone size={14} />
                    Call
                  </a>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}