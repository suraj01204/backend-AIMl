import serial
import requests
import time

# Change to your COM port
arduino = serial.Serial('COM6', 9600)  

backend_url = "http://localhost:4000"
pole_id = 1   # Unique pole/device ID
lat, lng = 10.85, 76.27  # Fixed GPS coordinates for this pole

while True:
    if arduino.in_waiting > 0:
        line = arduino.readline().decode('utf-8').strip()
        print("Raw Data:", line)

        try:
            parts = line.split(",")
            voltage = float(parts[0].split(":")[1].replace("V",""))
            current = float(parts[1].split(":")[1].replace("A",""))
            vibration = int(parts[2].split(":")[1])

            payload = {
                "id": pole_id,
                "lat": lat,
                "lng": lng,
                "voltage": voltage,
                "current": current,
                "vibration": vibration
            }

            # ✅ Send data to backend
            response = requests.post(f"{backend_url}/api/sensors", json=payload)
            print("Sent to Backend:", response.status_code, payload)

            # ✅ Get relay command from backend
            cmd = requests.get(f"{backend_url}/api/commands/{pole_id}").json()
            relay_state = cmd.get("relay", "ON")
            print("Relay Command:", relay_state)

            # ✅ Send command to Arduino
            if relay_state == "OFF":
                arduino.write(b'RELAY_OFF\n')
            else:
                arduino.write(b'RELAY_ON\n')

        except Exception as e:
            print("Parsing Error:", e)

    time.sleep(1)
