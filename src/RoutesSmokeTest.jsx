// src/RoutesSmokeTest.jsx
import Routes from "./Routes";

const mockRoutesDb = {
  "BUS-4": {
    routeId: "BUS-4",
    name: "Bus 4 City Loop",
    schedule: ["07:15", "08:15", "09:15"],
    stops: [
      { id: "surajpole", name: "Surajpole", lat: 24.5771, lng: 73.6852, radiusM: 40 },
      { id: "delhigate", name: "Delhigate", lat: 24.5829, lng: 73.6918, radiusM: 40 },
      { id: "udiapole", name: "Udiapole", lat: 24.5859, lng: 73.7025, radiusM: 40 },
    ],
  },
  "BUS-8": {
    routeId: "BUS-8",
    name: "Bus 8 Morning Loop",
    schedule: ["06:45", "07:45", "08:45"],
    stops: [
      { id: "alpha", name: "Alpha", lat: 24.5901, lng: 73.7001, radiusM: 40 },
      { id: "beta", name: "Beta", lat: 24.5931, lng: 73.7062, radiusM: 40 },
      { id: "gamma", name: "Gamma", lat: 24.5964, lng: 73.7110, radiusM: 40 },
    ],
  },
  "BUS-11": {
    routeId: "BUS-11",
    name: "Bus 11 School Loop",
    schedule: ["12:00", "13:00", "14:00"],
    stops: [
      { id: "one", name: "One", lat: 24.5701, lng: 73.6801, radiusM: 40 },
      { id: "two", name: "Two", lat: 24.5730, lng: 73.6844, radiusM: 40 },
      { id: "three", name: "Three", lat: 24.5760, lng: 73.6892, radiusM: 40 },
    ],
  },
};

const mockBuses = [
  {
    id: "BUS-4",
    name: "Bus 4",
    route: "Surajpole Loop",
    online: true,
    avgSpeedKmph: 24,
    uiState: {
      status: "EN_ROUTE",
      message: "Between Surajpole → Delhigate",
      currentStop: mockRoutesDb["BUS-4"].stops[0],
      nextStop: mockRoutesDb["BUS-4"].stops[1],
      segment: { fromStopId: "surajpole", toStopId: "delhigate", segmentIndex: 0 },
      progressM: 310,
      progressPct: 18,
      distanceToNextStopM: 640,
      dwellMs: 0,
      updatedAt: Date.now(),
    },
  },
  {
    id: "BUS-8",
    name: "Bus 8",
    route: "Morning Loop",
    online: true,
    avgSpeedKmph: 18,
    uiState: {
      status: "APPROACHING_STOP",
      message: "Approaching Beta",
      currentStop: mockRoutesDb["BUS-8"].stops[0],
      nextStop: mockRoutesDb["BUS-8"].stops[1],
      segment: { fromStopId: "alpha", toStopId: "beta", segmentIndex: 0 },
      progressM: 580,
      progressPct: 41,
      distanceToNextStopM: 92,
      dwellMs: 0,
      updatedAt: Date.now(),
    },
  },
  {
    id: "BUS-11",
    name: "Bus 11",
    route: "School Loop",
    online: false,
    avgSpeedKmph: 20,
    uiState: {
      status: "OFF_ROUTE",
      message: "Bus is off route",
      currentStop: null,
      nextStop: null,
      segment: null,
      progressM: null,
      progressPct: null,
      distanceToNextStopM: null,
      dwellMs: 0,
      updatedAt: Date.now(),
    },
  },
];

export default function RoutesSmokeTest({ theme = "dark" }) {
  return <Routes buses={mockBuses} theme={theme} routesDb={mockRoutesDb} />;
}