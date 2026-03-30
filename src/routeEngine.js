const BUS_STATES = Object.freeze({
  IDLE: "IDLE",
  EN_ROUTE: "EN_ROUTE",
  APPROACHING_STOP: "APPROACHING_STOP",
  AT_STOP: "AT_STOP",
  DEPARTING: "DEPARTING",
  OFF_ROUTE: "OFF_ROUTE",
});

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function validateGPS(newPoint, lastPoint) {
  if (!newPoint || typeof newPoint.lat !== "number" || typeof newPoint.lng !== "number") {
    return null;
  }

  if (Number.isFinite(newPoint.accuracyM) && newPoint.accuracyM > 60) {
    return null;
  }

  if (lastPoint && Number.isFinite(lastPoint.timestamp) && Number.isFinite(newPoint.timestamp)) {
    const dt = (newPoint.timestamp - lastPoint.timestamp) / 1000;
    if (dt <= 0) return null;

    const dist = haversine(lastPoint, newPoint);
    const speedMps = dist / dt;
    if (speedMps > 60) return null;
  }

  return {
    lat: newPoint.lat,
    lng: newPoint.lng,
    accuracyM: Number.isFinite(newPoint.accuracyM) ? newPoint.accuracyM : null,
    speedMps: Number.isFinite(newPoint.speedMps) ? newPoint.speedMps : null,
    headingDeg: Number.isFinite(newPoint.headingDeg) ? newPoint.headingDeg : null,
    timestamp: Number.isFinite(newPoint.timestamp) ? newPoint.timestamp : Date.now(),
  };
}

function buildRouteMeta(polylinePoints) {
  const cumDist = [0];

  for (let i = 1; i < polylinePoints.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversine(polylinePoints[i - 1], polylinePoints[i]);
  }

  return {
    points: polylinePoints,
    cumDist,
    totalDistM: cumDist[cumDist.length - 1],
  };
}

function projectPointToSegment(point, A, B) {
  const ax = A.lng, ay = A.lat;
  const bx = B.lng, by = B.lat;
  const px = point.lng, py = point.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const ab2 = abx * abx + aby * aby;
  const t = ab2 === 0 ? 0 : clamp((apx * abx + apy * aby) / ab2, 0, 1);

  const q = {
    lat: ay + t * aby,
    lng: ax + t * abx,
  };

  const distanceM = haversine(point, q);
  return { t, q, distanceM };
}

function projectToRoute(point, routeMeta) {
  let best = null;

  for (let i = 0; i < routeMeta.points.length - 1; i++) {
    const A = routeMeta.points[i];
    const B = routeMeta.points[i + 1];
    const segLen = haversine(A, B);
    const proj = projectPointToSegment(point, A, B);

    if (!best || proj.distanceM < best.distanceM) {
      best = {
        segmentIndex: i,
        t: proj.t,
        projectedPoint: proj.q,
        distanceM: proj.distanceM,
        progressM: routeMeta.cumDist[i] + proj.t * segLen,
      };
    }
  }

  return best;
}

function stopIndexOf(route, stopId) {
  return route.stops.findIndex((s) => s.id === stopId);
}

function nextIndex(i, len) {
  return (i + 1) % len;
}

function stopByIndex(route, idx) {
  const len = route.stops.length;
  return route.stops[((idx % len) + len) % len];
}

function computeStopsProgress(route) {
  const meta = buildRouteMeta(route.polylinePoints);

  return route.stops.map((stop) => {
    let bestProgress = 0;
    let bestDist = Infinity;

    for (let i = 0; i < meta.points.length - 1; i++) {
      const A = meta.points[i];
      const B = meta.points[i + 1];
      const segLen = haversine(A, B);
      const proj = projectPointToSegment(stop, A, B);

      if (proj.distanceM < bestDist) {
        bestDist = proj.distanceM;
        bestProgress = meta.cumDist[i] + proj.t * segLen;
      }
    }

    return { stopId: stop.id, progressM: bestProgress };
  });
}

function determineSegmentFromProgress(progressM, stopsProgress, stops) {
  for (let i = 0; i < stopsProgress.length; i++) {
    const curr = stopsProgress[i];
    const next = stopsProgress[(i + 1) % stopsProgress.length];

    const currS = curr.progressM;
    const nextS = next.progressM;

    if (nextS > currS) {
      if (progressM >= currS && progressM < nextS) {
        return {
          fromStop: stops.find((s) => s.id === curr.stopId),
          toStop: stops.find((s) => s.id === next.stopId),
          segmentIndex: i,
        };
      }
    } else {
      if (progressM >= currS || progressM < nextS) {
        return {
          fromStop: stops.find((s) => s.id === curr.stopId),
          toStop: stops.find((s) => s.id === next.stopId),
          segmentIndex: i,
        };
      }
    }
  }

  return null;
}

function confirmStopArrival(state, point, stop, now = Date.now()) {
  const distM = haversine(point, stop);
  const speedMps = Number.isFinite(point.speedMps) ? point.speedMps : state.lastSpeedMps ?? null;
  const speedOk = speedMps != null ? speedMps <= 2.0 : false;
  const insideGeofence = distM <= (stop.radiusM ?? 40);

  if (insideGeofence && speedOk) {
    if (!state.dwellStartTs) state.dwellStartTs = now;
    const dwellMs = now - state.dwellStartTs;

    if (dwellMs >= 10000) {
      return { arrived: true, approachingStop: false, dwellMs, distM };
    }

    return { arrived: false, approachingStop: true, dwellMs, distM };
  }

  state.dwellStartTs = null;
  return { arrived: false, approachingStop: false, dwellMs: 0, distM };
}

function updateRouteState(bus, ctx, route) {
  const { latest, projection, segment, stopCheck, now = Date.now() } = ctx;

  const prevStatus = bus.status || BUS_STATES.IDLE;
  const currStop = segment.fromStop;
  const nextStop = segment.toStop;

  const progressDelta = Number.isFinite(bus.lastProgressM)
    ? projection.progressM - bus.lastProgressM
    : 0;

  const onRoute = projection.distanceM <= 100;

  let status = prevStatus;

  if (prevStatus === BUS_STATES.IDLE) {
    if (onRoute) status = BUS_STATES.EN_ROUTE;
  } else if (prevStatus === BUS_STATES.OFF_ROUTE) {
    if (onRoute && projection.distanceM <= 60) status = BUS_STATES.EN_ROUTE;
  } else if (prevStatus === BUS_STATES.EN_ROUTE) {
    if (!onRoute) {
      status = BUS_STATES.OFF_ROUTE;
    } else if (stopCheck.distM <= 100) {
      status = BUS_STATES.APPROACHING_STOP;
    }
  } else if (prevStatus === BUS_STATES.APPROACHING_STOP) {
    if (!onRoute) {
      status = BUS_STATES.OFF_ROUTE;
    } else if (stopCheck.arrived) {
      status = BUS_STATES.AT_STOP;
    } else if (stopCheck.distM > 120 && progressDelta < -5) {
      status = BUS_STATES.EN_ROUTE;
    }
  } else if (prevStatus === BUS_STATES.AT_STOP) {
    if (!onRoute) {
      status = BUS_STATES.OFF_ROUTE;
    } else if (Number.isFinite(latest.speedMps) && latest.speedMps > 3 && progressDelta > 1) {
      status = BUS_STATES.DEPARTING;
    }
  } else if (prevStatus === BUS_STATES.DEPARTING) {
    if (!onRoute) {
      status = BUS_STATES.OFF_ROUTE;
    } else if (progressDelta > 20) {
      status = BUS_STATES.EN_ROUTE;
    }
  }
  

  const nextState = {
    ...bus,
    status,
    lastProgressM: projection.progressM,
    lastProjection: projection,
    lastSpeedMps: latest.speedMps ?? bus.lastSpeedMps ?? null,
  };

  if (status === BUS_STATES.AT_STOP) {
    const reachedIdx = stopIndexOf(route, nextStop.id);
    nextState.currentStopIndex = reachedIdx;
    nextState.nextStopIndex = nextIndex(reachedIdx, route.stops.length);
    nextState.currentStopId = nextStop.id;
    nextState.dwellStartTs = bus.dwellStartTs ?? now;
  }

  // Keep the active stop pair synced with the current segment
if (status !== BUS_STATES.AT_STOP) {
  const currIdx = stopIndexOf(route, currStop.id);
  if (currIdx >= 0) {
    nextState.currentStopIndex = currIdx;
    nextState.nextStopIndex = nextIndex(currIdx, route.stops.length);
    nextState.currentStopId = currStop.id;
  }
}
  return nextState;
}

async function snapBreadcrumbsToRoads(points) {
  return points; // mock for Step 1 + Step 2
}

async function processBusLocation(state, rawGpsPoint, route) {
  const nextState = {
    ...state,
    buffer: Array.isArray(state.buffer) ? [...state.buffer] : [],
  };

  const clean = validateGPS(rawGpsPoint, nextState.lastPoint);
  if (!clean) {
    return { state: nextState, uiUpdated: false, reason: "invalid_gps" };
  }

  nextState.buffer.push(clean);
  if (nextState.buffer.length > 5) nextState.buffer.shift();

  const snappedBreadcrumbs = await snapBreadcrumbsToRoads(nextState.buffer);
  const latest = snappedBreadcrumbs[snappedBreadcrumbs.length - 1];

  const routeMeta = buildRouteMeta(route.polylinePoints);
  const routeStopsProgress = route.stopsProgress || computeStopsProgress(route);

  const projection = projectToRoute(latest, routeMeta);
  if (!projection) {
    return { state: nextState, uiUpdated: false, reason: "projection_failed" };
  }

  if (projection.distanceM > 100) {
    nextState.status = BUS_STATES.OFF_ROUTE;
    nextState.lastPoint = latest;
    nextState.lastProgressM = projection.progressM;

    nextState.uiState = {
      routeId: route.routeId,
      busId: nextState.busId,
      status: BUS_STATES.OFF_ROUTE,
      message: "Bus is off route",
      currentStop: null,
      nextStop: null,
      segment: null,
      progressM: projection.progressM,
      progressPct: Math.round((projection.progressM / routeMeta.totalDistM) * 100),
      distanceToNextStopM: Math.round(projection.distanceM),
      dwellMs: 0,
      updatedAt: Date.now(),
    };

    return { state: nextState, uiUpdated: true, reason: "off_route" };
  }

  const segment = determineSegmentFromProgress(
    projection.progressM,
    routeStopsProgress,
    route.stops
  );

  if (!segment) {
    return { state: nextState, uiUpdated: false, reason: "segment_not_found" };
  }

  const stopCheck = confirmStopArrival(nextState, latest, segment.toStop);

  const updatedBus = updateRouteState(
    nextState,
    {
      latest,
      projection,
      segment,
      stopCheck,
      now: Date.now(),
    },
    route
  );

  const currentStop =
    Number.isInteger(updatedBus.currentStopIndex)
      ? stopByIndex(route, updatedBus.currentStopIndex)
      : segment.fromStop;

  const nextStop =
    Number.isInteger(updatedBus.nextStopIndex)
      ? stopByIndex(route, updatedBus.nextStopIndex)
      : segment.toStop;

  updatedBus.lastPoint = latest;
  updatedBus.lastProgressM = projection.progressM;

  updatedBus.uiState = {
    routeId: route.routeId,
    busId: updatedBus.busId,
    status: updatedBus.status,
    message:
      updatedBus.status === BUS_STATES.AT_STOP
        ? `Reached ${nextStop.name}`
        : updatedBus.status === BUS_STATES.APPROACHING_STOP
          ? `Approaching ${nextStop.name}`
          : updatedBus.status === BUS_STATES.DEPARTING
            ? `Departed ${currentStop.name}`
            : updatedBus.status === BUS_STATES.OFF_ROUTE
              ? "Bus is off route"
              : `Between ${currentStop.name} → ${nextStop.name}`,
    currentStop,
    nextStop,
    segment: {
      fromStopId: segment.fromStop.id,
      toStopId: segment.toStop.id,
      segmentIndex: segment.segmentIndex,
    },
    progressM: projection.progressM,
    progressPct: Math.round((projection.progressM / routeMeta.totalDistM) * 100),
    distanceToNextStopM: Math.round(stopCheck.distM),
    dwellMs: Math.round(stopCheck.dwellMs),
    updatedAt: Date.now(),
  };

  return {
    state: updatedBus,
    uiUpdated: true,
    reason: stopCheck.arrived ? "arrived_at_stop" : "route_progress_updated",
  };
}

export {
  BUS_STATES,
  processBusLocation,
  validateGPS,
  buildRouteMeta,
  projectToRoute,
  determineSegmentFromProgress,
  confirmStopArrival,
  computeStopsProgress,
};