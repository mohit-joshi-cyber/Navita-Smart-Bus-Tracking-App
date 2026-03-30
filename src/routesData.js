export const ROUTES_DB = {
  "BUS-4": {
    routeId: "BUS-4",
    name: "Bus 4 City Loop",
    polylinePoints: [
      { lat: 24.5771, lng: 73.6852 }, // Surajpole
      { lat: 24.5798, lng: 73.6881 },
      { lat: 24.5829, lng: 73.6918 }, // Delhigate
      { lat: 24.5845, lng: 73.6970 },
      { lat: 24.5859, lng: 73.7025 }, // Udiapole
      { lat: 24.5820, lng: 73.6972 },
      { lat: 24.5771, lng: 73.6852 }, // back to Surajpole
    ],
    stops: [
      { id: "surajpole", name: "Surajpole", lat: 24.5771, lng: 73.6852, radiusM: 40 },
      { id: "delhigate", name: "Delhigate", lat: 24.5829, lng: 73.6918, radiusM: 40 },
      { id: "udiapole", name: "Udiapole", lat: 24.5859, lng: 73.7025, radiusM: 40 },
    ],
  },
};