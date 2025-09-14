const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());

// Raw sensor history
let sensorData = [];
// Latest enriched pole states
let poles = [];
// Commands for IoT devices
let commands = {}; // { poleId: { relay: "ON"/"OFF" } }

/**
 * ✅ IoT device sends sensor data here
 */
app.post("/api/sensors", async (req, res) => {
  const { id, lat, lng, voltage, current, vibration } = req.body;

  if (
    id === undefined ||
    lat === undefined ||
    lng === undefined ||
    voltage === undefined ||
    current === undefined ||
    vibration === undefined
  ) {
    return res.status(400).json({ message: "Invalid data format" });
  }

  // Store raw reading
  const reading = {
    id,
    voltage,
    current,
    vibration,
    timestamp: new Date(),
  };
  sensorData.push(reading);

  // Call AI/ML service
  let faultProbability = 0;
  let weather_risk = "normal";
  let theft_risk = "low";
  let faultDetected = false;

  try {
    const response = await fetch("http://localhost:5001/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, lat, lng, voltage, current, vibration }),
    });

    if (response.ok) {
      const aiData = await response.json();
      faultProbability = aiData.faultProbability ?? 0;
      weather_risk = aiData.weather_risk ?? "normal";
      theft_risk = aiData.theft_risk ?? "low";
      faultDetected = faultProbability > 0.8; // 🔴 fault if above 80%
    }
  } catch (err) {
    console.warn("⚠️ AI/ML Service not responding, using defaults");
  }

  // If fault detected → set relay OFF command
  if (faultDetected) {
    commands[id] = { relay: "OFF" };
    console.log(`🚨 Fault detected at Pole ${id}, relay OFF command issued`);
  } else {
    commands[id] = { relay: "ON" }; // normal state
  }

  // Update pole state
  const poleData = {
    id,
    lat,
    lng,
    voltage,
    current,
    vibration,
    faultProbability,
    weather_risk,
    theft_risk,
    relay: commands[id].relay,
    timestamp: new Date(),
  };

  const index = poles.findIndex((p) => p.id === id);
  if (index !== -1) {
    poles[index] = poleData;
  } else {
    poles.push(poleData);
  }

  console.log("📡 New Sensor Data:", reading);
  console.log("⚡ Updated Pole State:", poleData);

  res.status(200).json({ message: "Data processed", sensor: reading, pole: poleData });
});

// ✅ IoT polls this to check relay command
app.get("/api/commands/:id", (req, res) => {
  const id = req.params.id;
  const command = commands[id] || { relay: "ON" };
  res.json(command);
});

// ✅ Get all raw sensor data
app.get("/api/sensors", (req, res) => {
  res.json(sensorData);
});

// ✅ Get latest pole states
app.get("/api/poles", (req, res) => {
  res.json(poles);
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Power Line Monitor backend server is running...");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
