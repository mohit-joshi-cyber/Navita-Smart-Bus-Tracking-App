import { ROUTES_DB } from "./routesData.js";
import { processBusLocation } from "./routeEngine.js";

const route = ROUTES_DB["BUS-4"];

let busState = {
  busId: "BUS-4",
  buffer: [],
  lastPoint: null,
  lastSpeedMps: null,
  dwellStartTs: null,
  status: "IDLE",
  uiState: null,
};

async function handleGps(point) {
  const result = await processBusLocation(busState, point, route);
  busState = result.state;

  console.log("reason:", result.reason);
  console.log("status:", busState.status);
  console.log("uiState:", busState.uiState);
  console.log("----");
}

async function run() {
  const now = Date.now();

  const samples = [
  { lat: 24.5771, lng: 73.6852, speedMps: 0.5, accuracyM: 10, timestamp: now + 1000 },
  { lat: 24.5775, lng: 73.6857, speedMps: 6, accuracyM: 10, timestamp: now + 4000 },
  { lat: 24.5780, lng: 73.6864, speedMps: 7, accuracyM: 10, timestamp: now + 7000 },
  { lat: 24.5790, lng: 73.6878, speedMps: 8, accuracyM: 10, timestamp: now + 10000 },
  { lat: 24.5805, lng: 73.6897, speedMps: 8, accuracyM: 10, timestamp: now + 13000 },
  { lat: 24.5824, lng: 73.6914, speedMps: 2, accuracyM: 10, timestamp: now + 17000 },
  { lat: 24.5829, lng: 73.6918, speedMps: 0.5, accuracyM: 10, timestamp: now + 30000 },
  { lat: 24.5829, lng: 73.6918, speedMps: 0.3, accuracyM: 10, timestamp: now + 42000 },
];

  for (const p of samples) {
    await handleGps(p);
  }
}

run().catch(console.error);