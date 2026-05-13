// src/Routes.jsx

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Star,
  Route as RouteIcon,
  Clock,
  ChevronDown,
  MapPin,
  ArrowRight,
  Bus,
  Calendar,
  Navigation,
  Gauge,
  Timer,
  CheckCircle2,
  Trash2,
} from "lucide-react";
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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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
    if (d < minDist) { minDist = d; index = i; }
  });
  return { index, distanceKm: minDist };
}

// =========================
// Translation Helpers
// =========================

/**
 * Translate a stop's display name.
 * Looks up stop.id in the translation map first, falls back to stop.name.
 */
function tStop(stop, t) {
  if (!stop) return "...";
  return t[stop.id] || stop.name || stop.id || "...";
}

/**
 * Translate a route's display name.
 * Looks up routeKey (e.g. "R-1") in the translation map first.
 */
function tRoute(routeKey, route, t) {
  return (
    t[routeKey] ||
    t[route?.routeId] ||
    route?.name ||
    route?.routeId ||
    routeKey
  );
}

function getStatusText(status, t) {
  const statusMap = {
    AT_STOP: t.statusAtStop || "At Stop",
    APPROACHING_STOP: t.statusApproaching || "Approaching",
    DEPARTING: t.statusDeparting || "Just Departed",
    EN_ROUTE: t.statusEnRoute || "On the way",
    MOVING: t.statusEnRoute || "On the way",
    OFF_ROUTE: t.statusOffRoute || "Off Route",
    IDLE: t.statusIdle || "Not Started",
    NO_DATA: t.statusNoData || "No Data",
  };
  return statusMap[String(status || "").toUpperCase()] || String(status || "");
}

function getLocalizedMessage(status, currStop, nextStop, t) {
  const stopA = tStop(currStop, t);
  const stopB = tStop(nextStop, t);

  if (!status || status === "IDLE") return t.statusIdle || "Not Started";
  if (status === "NO_DATA") return t.statusNoData || "No Data";

  switch (status) {
    case "AT_STOP":
      return t.msgAt
        ? t.msgAt.replace("{stop}", stopB)
        : `At ${stopB}`;

    case "APPROACHING_STOP":
      return t.msgApproaching
        ? t.msgApproaching.replace("{stop}", stopB)
        : `Arriving at ${stopB}`;

    case "DEPARTING":
      return t.msgDeparted
        ? t.msgDeparted.replace("{stop}", stopA)
        : `Departed from ${stopA}`;

    case "EN_ROUTE":
    case "MOVING":
      return t.msgBetween
        ? t.msgBetween.replace("{stopA}", stopA).replace("{stopB}", stopB)
        : `${stopA} → ${stopB}`;

    case "OFF_ROUTE":
      return t.statusOffRoute || "Off Route";

    default:
      return t.statusEnRoute || "On the way";
  }
}

function deriveFallbackState(bus, pos, route, t) {
  if (!route?.stops?.length || !pos) {
    return {
      status: "NO_DATA",
      message: t.statusNoData || "No Data",
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
  const status = atStop ? "AT_STOP" : "EN_ROUTE";

  return {
    status,
    message: getLocalizedMessage(status, nearest, atStop ? nearest : next, t),
    currentStop: nearest,
    nextStop: atStop ? nearest : next,
    distanceToNextStopM: atStop ? 0 : Math.round(distanceM),
    etaMin: atStop ? 0 : formatMinutesFromMeters(distanceM, bus?.avgSpeedKmph || 20),
    source: "fallback",
  };
}

function getLiveState(bus, route, pos, t) {
  const live = bus?.uiState || bus?.routeState || null;

  if (live) {
    const status = live.status || bus.status || "IDLE";
    return {
      status,
      message: getLocalizedMessage(status, live.currentStop, live.nextStop, t),
      currentStop: live.currentStop || null,
      nextStop: live.nextStop || null,
      segment: live.segment || null,
      progressPct: isFiniteNumber(live.progressPct) ? live.progressPct : null,
      progressM: isFiniteNumber(live.progressM) ? live.progressM : null,
      distanceToNextStopM: isFiniteNumber(live.distanceToNextStopM) ? live.distanceToNextStopM : null,
      dwellMs: isFiniteNumber(live.dwellMs) ? live.dwellMs : null,
      etaMin: isFiniteNumber(live.distanceToNextStopM)
        ? formatMinutesFromMeters(live.distanceToNextStopM, bus?.avgSpeedKmph || 20)
        : null,
      source: "engine",
    };
  }

  // Also handle top-level bus status from server (no uiState wrapper)
  if (bus?.status && bus.status !== "IDLE") {
    const status = bus.status;
    const currStop = bus.currentStopId
      ? route?.stops?.find((s) => s.id === bus.currentStopId) || null
      : null;
    const nextStop =
      isFiniteNumber(bus.nextStopIndex) && route?.stops?.[bus.nextStopIndex]
        ? route.stops[bus.nextStopIndex]
        : null;

    return {
      status,
      message: getLocalizedMessage(status, currStop, nextStop, t),
      currentStop: currStop,
      nextStop: nextStop,
      distanceToNextStopM: isFiniteNumber(bus.distanceToNextStopM) ? bus.distanceToNextStopM : null,
      progressPct: isFiniteNumber(bus.progressPct) ? bus.progressPct : null,
      progressM: isFiniteNumber(bus.progressM) ? bus.progressM : null,
      dwellMs: isFiniteNumber(bus.dwellMs) ? bus.dwellMs : null,
      etaMin: isFiniteNumber(bus.distanceToNextStopM)
        ? formatMinutesFromMeters(bus.distanceToNextStopM, bus?.avgSpeedKmph || 20)
        : null,
      source: "bus",
    };
  }

  return deriveFallbackState(bus, pos, route, t);
}

function getStatusPalette(status, isDark) {
  const s = String(status || "").toUpperCase();

  if (s === "AT_STOP") return {
    badge: isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-700",
    chip: "bg-yellow-500", panel: isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-200",
    border: "border-l-yellow-500", text: isDark ? "text-yellow-300" : "text-yellow-700",
  };

  if (s === "APPROACHING_STOP") return {
    badge: isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700",
    chip: "bg-amber-500", panel: isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200",
    border: "border-l-amber-500", text: isDark ? "text-amber-300" : "text-amber-700",
  };

  if (s === "DEPARTING") return {
    badge: isDark ? "bg-cyan-500/20 text-cyan-300" : "bg-cyan-100 text-cyan-700",
    chip: "bg-cyan-500", panel: isDark ? "bg-cyan-500/10 border-cyan-500/20" : "bg-cyan-50 border-cyan-200",
    border: "border-l-cyan-500", text: isDark ? "text-cyan-300" : "text-cyan-700",
  };

  if (s === "OFF_ROUTE") return {
    badge: isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-700",
    chip: "bg-red-500", panel: isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200",
    border: "border-l-red-500", text: isDark ? "text-red-300" : "text-red-700",
  };

  if (s === "IDLE" || s === "NO_DATA") return {
    badge: isDark ? "bg-slate-500/20 text-slate-300" : "bg-slate-100 text-slate-700",
    chip: "bg-slate-500", panel: isDark ? "bg-slate-500/10 border-slate-500/20" : "bg-slate-50 border-slate-200",
    border: "border-l-slate-500", text: isDark ? "text-slate-300" : "text-slate-700",
  };

  // EN_ROUTE / MOVING default → blue
  return {
    badge: isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700",
    chip: "bg-blue-500", panel: isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200",
    border: "border-l-blue-500", text: isDark ? "text-blue-300" : "text-blue-700",
  };
}

function findLiveBusForRoute(buses, routeKey, route) {
  return (
    buses.find(
      (bus) =>
        String(bus?.id ?? "") === String(routeKey ?? "") ||
        String(bus?.id ?? "") === String(route?.routeId ?? "") ||
        String(bus?.routeId ?? "") === String(routeKey ?? "") ||
        String(bus?.routeId ?? "") === String(route?.routeId ?? "")
    ) || null
  );
}

function getRouteSchedule(route) {
  if (Array.isArray(route?.schedule)) return route.schedule;
  if (Array.isArray(route?.dailySchedule)) return route.dailySchedule;
  return [];
}

function parseFromTo(name) {
  if (typeof name !== "string") return { from: name || "—", to: "" };
  const idx = name.toLowerCase().indexOf(" to ");
  if (idx === -1) {
    // also try Hindi connector "से" → "से ... डिपो" style
    const hiIdx = name.indexOf(" से ");
    if (hiIdx !== -1) {
      return { from: name.slice(0, hiIdx).trim(), to: name.slice(hiIdx + 4).trim() };
    }
    return { from: name, to: "" };
  }
  return { from: name.slice(0, idx).trim(), to: name.slice(idx + 4).trim() };
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

function isTimePast(time) {
  if (typeof time !== "string" || !/^\d{1,2}:\d{2}$/.test(time)) return false;
  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
}

function findNextUpcomingIndex(schedule) {
  if (!Array.isArray(schedule)) return -1;
  return schedule.findIndex((t) => !isTimePast(t));
}

// =========================
// Main Component
// =========================
export default function Routes({
  buses = [],
  theme = "dark",
  t = {},
  routesDb = DEFAULT_ROUTES_DB,
}) {
  const [mode, setMode] = useState("daily");
  const [toast, setToast] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);

  const isDark = theme === "dark";

  const uid = auth?.currentUser?.uid || "guest";
  const favKey = `navita_fav_${uid}`;

  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(favKey)) || []; }
    catch { return []; }
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
      const isFaved = prev.includes(id);
      const next = isFaved ? prev.filter((i) => i !== id) : [...prev, id];
      setToast(
        isFaved
          ? t.removedFromFavorites || "Removed from favorites"
          : t.savedToFavorites || "Saved to favorites"
      );
      return next;
    });
  };

  const getBusPosition = (bus) => {
    if (isFiniteNumber(bus?.lat) && isFiniteNumber(bus?.lng)) return [bus.lat, bus.lng];
    return null;
  };

  const routeEntries = useMemo(() => Object.entries(routesDb || {}), [routesDb]);
  const busCards = useMemo(() => buses || [], [buses]);
  const liveCount = useMemo(() => busCards.filter((b) => b?.online).length, [busCards]);

  // Translated UI strings with fallbacks
  const ui = {
    routesTitle: t.routes || "Bus Routes",
    routesSubtitle: t.routesSubtitle || "Tap a route to see stops, timings & live status",
    busesLive: liveCount === 1
      ? `1 ${t.busLive || "bus live"}`
      : `${liveCount} ${t.busesLive || "buses live"}`,
    dailySchedule: t.dailySchedule || "Daily Schedule",
    liveTracking: t.liveTracking || "Live Tracking",
    stops: t.stops || "stops",
    tripsPerDay: t.tripsPerDay || "trips/day",
    currentStop: t.currentStop || "Current Stop",
    nextStop: t.nextStop || "Next Stop",
    distance: t.distance || "Distance",
    eta: t.eta || "ETA",
    journeyProgress: t.journeyProgress || "Journey progress",
    stoppedFor: t.stoppedFor || "Stopped for:",
    routeStops: t.routeStops || "Route Stops",
    busResting: t.busResting || "Bus is resting right now",
    checkDepartures: t.checkDepartures || "Check today's departure times below",
    routeMapLabel: t.routeMapLabel || "Route Map",
    todayDepartures: t.todayDepartures || "Today's Departures",
    noStopData: t.noStopData || "No stop data",
    noSchedule: t.noSchedule || "No schedule times set yet.",
    call: t.call || "Call",
    busIsHere: t.busIsHere || "Bus is here",
    origin: t.origin || "Origin",
    destination: t.destination || "Destination",
    next: t.next || "NEXT",
    driverLabel: t.driver || "Driver",
    online: t.online || "Live",
    offline: t.offline || "Offline",
  };

  return (
    <div
      className={`absolute inset-0 flex flex-col ${
        isDark
          ? "bg-gradient-to-b from-[#0f172a] to-[#020617]"
          : "bg-gradient-to-b from-slate-50 to-white"
      }`}
    >
      {/* ===== Header ===== */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {ui.routesTitle}
            </h1>
            <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {ui.routesSubtitle}
            </p>
          </div>

          {/* Live count badge */}
          <div
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border ${
              liveCount > 0
                ? isDark
                  ? "bg-green-500/10 border-green-500/30 text-green-300"
                  : "bg-green-50 border-green-200 text-green-700"
                : isDark
                  ? "bg-slate-500/10 border-slate-500/30 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-500"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {liveCount > 0 && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  liveCount > 0 ? "bg-green-500" : "bg-slate-400"
                }`}
              />
            </span>
            {ui.busesLive}
          </div>
        </div>

        {/* Segmented pill switch */}
        <div
          className={`mt-4 inline-flex p-1 rounded-xl border ${
            isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          {[
            { key: "daily", label: ui.dailySchedule, icon: Calendar },
            { key: "live", label: ui.liveTracking, icon: Navigation },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                mode === key
                  ? "bg-blue-600 text-white shadow-md"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Route list ===== */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-3">
        {routeEntries.map(([routeKey, route]) => {
          const liveBus = findLiveBusForRoute(busCards, routeKey, route);
          const pos = getBusPosition(liveBus);
          const liveState = getLiveState(liveBus, route, pos, t);
          const isFav = favorites.includes(routeKey) || favorites.includes(route?.routeId);
          const statusPalette = getStatusPalette(liveState.status, isDark);

          // Use translated route name
          const routeName = tRoute(routeKey, route, t);
          const { from, to } = parseFromTo(routeName);

          const stops = Array.isArray(route?.stops) ? route.stops : [];
          const schedule = getRouteSchedule(route);
          const busRunning = Boolean(liveBus?.online);
          const isOpen = expandedRoute === routeKey;
          const nextUpcomingIdx = findNextUpcomingIndex(schedule);
          const currentStopId = liveState?.currentStop?.id;

          return (
            <motion.div
              key={routeKey}
              layout
              className={`rounded-2xl border overflow-hidden transition-shadow ${
                isDark
                  ? "bg-white/5 border-white/10 hover:border-white/20"
                  : "bg-white border-slate-200 shadow-sm hover:shadow-md"
              }`}
            >
              {/* ===== Card Header ===== */}
              <button
                onClick={() => setExpandedRoute(isOpen ? null : routeKey)}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                {/* Bus number badge */}
                <div
                  className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl font-bold ${
                    isDark
                      ? "bg-gradient-to-br from-blue-500/30 to-blue-700/30 text-blue-200 border border-blue-400/30"
                      : "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                  }`}
                >
                  <Bus size={16} className="opacity-80" />
                  <span className="text-[10px] mt-0.5 tracking-wide">{routeKey}</span>
                </div>

                {/* From → To */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-base truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                      {from}
                    </span>
                    <ArrowRight size={16} className={`shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                    <span className={`font-semibold text-base truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                      {to || "—"}
                    </span>
                  </div>

                  <div className={`mt-1 text-xs flex items-center gap-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {stops.length} {ui.stops}
                    </span>
                    <span className="opacity-50">·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {schedule.length} {ui.tripsPerDay}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${
                        busRunning
                          ? "bg-green-500/15 text-green-500 border border-green-500/30"
                          : "bg-slate-500/15 text-slate-500 border border-slate-500/30"
                      }`}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        {busRunning && (
                          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                            busRunning ? "bg-green-500" : "bg-slate-500"
                          }`}
                        />
                      </span>
                      {busRunning ? ui.online.toUpperCase() : ui.offline.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Star + Chevron */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <Star
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(routeKey); }}
                    className={`w-5 h-5 cursor-pointer transition-transform hover:scale-110 ${
                      isFav ? "text-yellow-400 fill-yellow-400" : isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  />
                  <ChevronDown
                    size={20}
                    className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  />
                </div>
              </button>

              {/* ===== Expanded body ===== */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className={`px-4 pb-4 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>

                      {/* ====== LIVE MODE ====== */}
                      {mode === "live" ? (
                        <div className="pt-4 space-y-4">
                          {busRunning ? (
                            <>
                              {/* Status banner */}
                              <div className={`rounded-xl border-l-4 ${statusPalette.border} ${statusPalette.panel} border p-3`}>
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${statusPalette.chip} animate-pulse`} />
                                  <span className={`text-xs font-bold tracking-wide ${statusPalette.text}`}>
                                    {getStatusText(liveState.status, t)}
                                  </span>
                                </div>
                                <p className={`mt-1 text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {liveState.message}
                                </p>
                              </div>

                              {/* Stats grid */}
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  {
                                    icon: MapPin,
                                    label: ui.currentStop,
                                    // Translate stop name in stats grid too
                                    value: tStop(liveState.currentStop, t) !== "..." ? tStop(liveState.currentStop, t) : "—",
                                    accent: "text-blue-500",
                                  },
                                  {
                                    icon: ArrowRight,
                                    label: ui.nextStop,
                                    value: tStop(liveState.nextStop, t) !== "..." ? tStop(liveState.nextStop, t) : "—",
                                    accent: "text-indigo-500",
                                  },
                                  {
                                    icon: Gauge,
                                    label: ui.distance,
                                    value: formatDistance(liveState.distanceToNextStopM),
                                    accent: "text-green-500",
                                  },
                                  {
                                    icon: Timer,
                                    label: ui.eta,
                                    value: isFiniteNumber(liveState.etaMin) ? `${liveState.etaMin} min` : "—",
                                    accent: "text-orange-500",
                                  },
                                ].map(({ icon: Icon, label, value, accent }) => (
                                  <div
                                    key={label}
                                    className={`rounded-xl p-3 border ${
                                      isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                                    }`}
                                  >
                                    <div className={`flex items-center gap-1.5 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                      <Icon size={12} className={accent} />
                                      {label}
                                    </div>
                                    <div className={`mt-1 text-sm font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                                      {value}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Journey progress bar */}
                              {isFiniteNumber(liveState.progressPct) && (
                                <div>
                                  <div className="flex justify-between text-xs mb-1.5">
                                    <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                                      {ui.journeyProgress}
                                    </span>
                                    <span className={`font-semibold ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                                      {liveState.progressPct}%
                                    </span>
                                  </div>
                                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.max(0, Math.min(100, liveState.progressPct ?? 0))}%` }}
                                      transition={{ duration: 0.6 }}
                                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Dwell time */}
                              {isFiniteNumber(liveState.dwellMs) && liveState.dwellMs > 0 && (
                                <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                  {ui.stoppedFor} {Math.round(liveState.dwellMs / 1000)}s
                                </div>
                              )}
                            </>
                          ) : (
                            /* Bus offline / resting */
                            <div
                              className={`rounded-xl border p-5 text-center ${
                                isDark ? "bg-slate-500/5 border-slate-500/20" : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="mx-auto w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center mb-2">
                                <Bus size={22} className="text-slate-400" />
                              </div>
                              <h4 className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                                {ui.busResting}
                              </h4>
                              <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {ui.checkDepartures}
                              </p>

                              {schedule.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                                  {schedule.slice(0, 8).map((time, i) => (
                                    <span
                                      key={`${routeKey}-next-${i}-${time}`}
                                      className={`text-xs px-2 py-1 rounded-md font-mono ${
                                        isDark
                                          ? "bg-white/5 text-slate-300 border border-white/10"
                                          : "bg-white text-slate-700 border border-slate-200"
                                      }`}
                                    >
                                      {time}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Stops timeline — live mode highlights current stop */}
                          {stops.length > 0 && (
                            <div className="pt-2">
                              <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                <RouteIcon size={12} />
                                {ui.routeStops}
                              </div>
                              <StopsTimeline
                                stops={stops}
                                isDark={isDark}
                                currentStopId={busRunning ? currentStopId : null}
                                statusChip={statusPalette.chip}
                                t={t}
                                ui={ui}
                              />
                            </div>
                          )}
                        </div>

                      ) : (
                        /* ====== DAILY MODE ====== */
                        <div className="pt-4 space-y-5">
                          {/* Stops timeline */}
                          <div>
                            <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              <RouteIcon size={12} />
                              {ui.routeMapLabel} ({stops.length} {ui.stops})
                            </div>
                            {stops.length ? (
                              <StopsTimeline
                                stops={stops}
                                isDark={isDark}
                                t={t}
                                ui={ui}
                              />
                            ) : (
                              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                {ui.noStopData}
                              </p>
                            )}
                          </div>

                          {/* Schedule */}
                          <div>
                            <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              <Clock size={12} />
                              {ui.todayDepartures}
                            </div>
                            {schedule.length ? (
                              <div className="flex gap-1.5 flex-wrap">
                                {schedule.map((time, i) => {
                                  const past = isTimePast(time);
                                  const isNext = i === nextUpcomingIdx;
                                  return (
                                    <div key={`${time}-${i}`} className="relative">
                                      <span
                                        className={`inline-block text-xs px-2.5 py-1 rounded-md font-mono font-semibold border transition-all hover:-translate-y-0.5 ${
                                          isNext
                                            ? isDark
                                              ? "bg-blue-500/20 text-blue-200 border-blue-400/40 shadow-md shadow-blue-500/20"
                                              : "bg-blue-600 text-white border-blue-600 shadow-md"
                                            : past
                                              ? isDark
                                                ? "bg-white/5 text-slate-500 border-white/5 line-through"
                                                : "bg-slate-50 text-slate-400 border-slate-100 line-through"
                                              : isDark
                                                ? "bg-white/5 text-slate-200 border-white/10"
                                                : "bg-white text-slate-700 border-slate-200"
                                        }`}
                                      >
                                        {time}
                                      </span>
                                      {isNext && (
                                        <span className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-bold">
                                          {ui.next}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                                {ui.noSchedule}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Driver section */}
                      {route?.driver && (
                        <div
                          className={`mt-4 flex items-center justify-between p-3 rounded-xl ${
                            isDark ? "bg-white/5 border border-white/10" : "bg-slate-50 border border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                isDark
                                  ? "bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-blue-200"
                                  : "bg-gradient-to-br from-blue-500 to-purple-500 text-white"
                              }`}
                            >
                              {getInitials(route.driver.name)}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {ui.driverLabel}
                              </p>
                              <p className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                                {route.driver.name}
                              </p>
                            </div>
                          </div>

                          <a
                            href={`tel:${route.driver.phone}`}
                            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-green-500 text-white shadow-sm hover:bg-green-600 transition-colors"
                          >
                            <Phone size={13} />
                            {ui.call}
                          </a>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ===== Toast ===== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-white/10 z-50"
          >
            {toast.includes(t.removedFromFavorites?.slice(0, 5) || "Remov") ? (
              <Trash2 size={14} className="text-red-400" />
            ) : (
              <CheckCircle2 size={14} className="text-green-400" />
            )}
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =========================
// Stops Timeline
// Now receives t + ui for full translation of stop names and labels
// =========================
function StopsTimeline({
  stops,
  isDark,
  currentStopId = null,
  statusChip = "bg-blue-500",
  t = {},
  ui = {},
}) {
  return (
    <ol className="relative">
      {stops.map((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const isCurrent = Boolean(currentStopId && stop.id === currentStopId);

        const dotColor = isCurrent
          ? statusChip
          : isFirst
            ? "bg-green-500"
            : isLast
              ? "bg-blue-500"
              : isDark
                ? "bg-slate-600"
                : "bg-slate-300";

        const dotSize = isFirst || isLast || isCurrent ? "w-3.5 h-3.5" : "w-2.5 h-2.5";

        // Use translated stop name
        const stopLabel = tStop(stop, t);

        return (
          <li key={`${stop.id || i}-${i}`} className="flex gap-3 pb-2.5 last:pb-0 relative">
            {/* Connector line */}
            <div className="relative flex flex-col items-center shrink-0" style={{ width: 14 }}>
              <div className={`relative flex items-center justify-center ${dotSize}`}>
                {isCurrent && (
                  <span className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-60 animate-ping`} />
                )}
                <span
                  className={`relative inline-flex rounded-full ${dotSize} ${dotColor} ${
                    isFirst || isLast
                      ? `ring-2 ring-offset-2 ${isDark ? "ring-offset-[#0f172a]" : "ring-offset-white"}`
                      : ""
                  } ${isFirst ? "ring-green-500/40" : isLast ? "ring-blue-500/40" : ""}`}
                />
              </div>
              {!isLast && (
                <div className={`flex-1 w-0.5 mt-0.5 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              )}
            </div>

            {/* Label */}
            <div className="flex-1 -mt-0.5 pb-1">
              <div
                className={`text-sm leading-tight ${
                  isCurrent
                    ? `font-bold ${isDark ? "text-white" : "text-slate-900"}`
                    : isFirst || isLast
                      ? `font-semibold ${isDark ? "text-white" : "text-slate-900"}`
                      : isDark
                        ? "text-slate-300"
                        : "text-slate-700"
                }`}
              >
                {stopLabel}
              </div>
              {(isFirst || isLast || isCurrent) && (
                <span
                  className={`inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isCurrent
                      ? isDark ? "text-yellow-300" : "text-yellow-700"
                      : isFirst
                        ? "text-green-500"
                        : "text-blue-500"
                  }`}
                >
                  {isCurrent
                    ? (ui.busIsHere || "Bus is here")
                    : isFirst
                      ? (ui.origin || "Origin")
                      : (ui.destination || "Destination")}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}