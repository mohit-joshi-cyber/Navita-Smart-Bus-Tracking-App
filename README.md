
---

# Navita: Industrial-Grade IoT Bus Tracking System

**Developer:** Maker Studioz

**Status:** Functional Prototype / Moving to Production

Navita is a high-precision tracking ecosystem designed to solve the critical "Information Gap" in public transit. This project represents a complete vertical integration: from custom-coded ESP32 hardware to a secure Node.js backend and a cross-platform mobile application.

---

## ## Deep-Dive: The Research Phase

Before a single line of code was written, we conducted extensive ethnographic research at high-traffic bus terminals.

* **The "Wait Cycle" Data:** Our data showed that 70% of commuters experienced "Anxiety Peaks" due to the uncertainty of bus arrivals.
* **The 2-Hour Threshold:** In our study area, missing a bus didn't just mean being late; it meant a mandatory 60–120 minute wait for the next vehicle, as there was no centralized way to know if the next bus was around the corner or hadn't even started its route.
* **Conclusion:** The problem wasn't a lack of buses; it was a lack of **visible data**.

---

## ## Detailed Technical Architecture

### ### 1. Hardware Engineering (The Tracker)

The "Brain" of the bus is a custom-configured **ESP32** microcontroller.

* **GPS Acquisition:** Utilizes high-gain GPS modules. We experimented with **quarter-wave wire antennas** to ensure signal stability inside the metal chassis of a bus.
* **Power Management:** Configured to handle voltage fluctuations common in automotive power sockets.
* **The Audio Stack:** Integrated **MAX9814** microphone modules and **PAM8403** amplifiers with 8ohm speakers, intended for future automated in-bus stop announcements.

### ### 2. The Network Stack & Protocol Evolution

This was the most challenging part of the project. We didn't just build a system; we broke several others along the way.

* **The HTTP Failure:** Our first iteration used standard REST APIs. The overhead of the HTTP header made real-time updates bulky. By the time the server processed the "POST" request, the bus had moved 20-30 meters, creating a "jumpy" icon on the map.
* **The MQTT Transition:** We shifted to **MQTT (Message Queuing Telemetry Transport)**. This allowed us to send tiny, binary-friendly packets of data.
* **The Cloudflare/Raw Protocol Conflict:** We discovered that standard edge-protection services like Cloudflare often drop "Raw MQTT" traffic on standard ports. We had to architect a custom bypass/tunneling solution to ensure the ESP32 could talk directly to our Node.js broker without being flagged as malicious traffic.

### ### 3. Software & Cloud Logic

* **Backend:** A **Node.js** server acting as the primary orchestrator.
* **Database:** **Firebase Realtime Database** was chosen over Firestore for its superior low-latency performance for frequent coordinate updates.
* **Security Architecture:** To protect our **Google Maps API** and server resources:
* All requests are bounded by **SHA-1 certificate fingerprinting**.
* API keys are restricted to the **com.navita.app** package name to prevent unauthorized usage or billing spikes.


* **The Route Algorithm:** We moved away from simple "Coordinate-A to Coordinate-B" logic. The new algorithm uses **Map Matching** to snap the bus icon to the nearest known road path, preventing the "Bus flying over buildings" visual bug that plagued early versions.

---

## ## Development "Disaster" Log

We believe in documenting failures to prevent them in the future:

1. **Android Manifest Crisis:** The early version was a Web App. When wrapped in **Capacitor**, it failed to access background GPS permissions, meaning the tracking stopped when the user locked their phone. We had to rewrite the Android Manifest and Capacitor bridge from scratch.
2. **Latency Lag:** Using HTTPS caused a **1km latency**. In a moving vehicle, 1km is the difference between a user catching the bus or watching it drive away. MQTT reduced this to sub-50ms.
3. **The Stop-Detection Disaster:** Our first logic for "Is the bus at the stop?" relied on a single coordinate point. If the GPS drifted by 5 meters, the app didn't think the bus was there. We implemented **Geofencing circles** with a 20-meter radius to solve this.

---

## ## File Structure

```text
/navita-root
  ├── /hardware           # ESP32 C++ Code & MQTT Client
  ├── /server             # Node.js, MQTT Broker, & Firebase Admin
  ├── /app                # Capacitor/React Source Code
  │   ├── /android        # Android Studio Project Files
  │   └── /assets         # Custom R-1 Map Icons & Graphics
  └── /docs               # Smart Bus Tracking Presentation

```

---

## ## Deployment Instructions

1. **Hardware:** Flash the ESP32 using the `.ino` file in the `/hardware` folder. Ensure your SSID and MQTT credentials are correct.
2. **Environment:** Set your `GOOGLE_MAPS_API_KEY` in the Android `local.properties` and the React `.env`.
3. **Run:**
* `npm run server` to start the tracking orchestrator.
* `npx cap run android` to deploy the user-facing app.



---

## ## Future Roadmap

* **Predictive AI:** Implementing travel-time estimation based on historical data.
* **Multi-Vehicle Support:** Handling 100+ concurrent MQTT streams on a single Node.js instance.
* **Public API:** Allowing third-party developers to build "Arrival Time" widgets for local businesses.

---

