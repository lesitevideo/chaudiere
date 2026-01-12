/*********
  ESP32 + BME280 -> HTTP JSON API with routes
  Routes:
    GET  /         -> same as /data
    GET  /data     -> sensor data + stale detection
    GET  /health   -> running + timestamp
    POST /api/led/heating   JSON: {"state":"on"} or {"state":"off"}
    GET  /api/led/status    -> {"heating":true/false}

  Notes:
  - BME280 read is done in a background task every READING_INTERVAL seconds.
  - timestamp is Unix epoch (UTC) via NTP.
*********/

#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_Sensor.h>
#include <time.h>
#include <math.h>

#define BME_ADDR 0x76
#define SEALEVELPRESSURE_HPA (1013.25)

// WiFi
const char* ssid     = "Freebox-36E407";
const char* password = "ds3knqrfzvq2rfwnq7n529";
const char* hostname = "thermostat-salon";
// Server
WiFiServer server(80);
const long CLIENT_TIMEOUT_MS = 2000;

// App config (like your Python)
static const int READING_INTERVAL = 60;      // seconds
static const int LED_PIN = 17;              // choose a safe GPIO for your ESP32 board

// Sensor
Adafruit_BME280 bme;

// Shared state
struct SensorData {
  float temperature; // C
  float humidity;    // %
  float pressure;    // hPa
  time_t timestamp;  // epoch
  char status[12];   // "starting" / "ok" / "error" / "stale"
};

static SensorData sensorData = { NAN, NAN, NAN, 0, "starting" };

static bool heatingLed = false;

// Locks (ESP32 / FreeRTOS)
portMUX_TYPE dataMux = portMUX_INITIALIZER_UNLOCKED;
portMUX_TYPE ledMux  = portMUX_INITIALIZER_UNLOCKED;

// ---------- Time ----------
static bool syncTimeNTP(uint32_t maxWaitMs = 15000) {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  uint32_t start = millis();
  time_t now = time(nullptr);
  while (now < 100000 && (millis() - start) < maxWaitMs) {
    delay(250);
    now = time(nullptr);
  }
  return (now >= 100000);
}

// ---------- Helpers: HTTP ----------
static void httpSend(WiFiClient& client, int code, const char* contentType, const String& body) {
  const char* msg = "OK";
  if (code == 200) msg = "OK";
  else if (code == 400) msg = "Bad Request";
  else if (code == 404) msg = "Not Found";
  else if (code == 405) msg = "Method Not Allowed";
  else if (code == 500) msg = "Internal Server Error";

  client.printf("HTTP/1.1 %d %s\r\n", code, msg);
  client.printf("Content-Type: %s; charset=utf-8\r\n", contentType);
  client.println("Connection: close");
  client.printf("Content-Length: %u\r\n", (unsigned)body.length());
  client.println();
  client.print(body);
}

static String jsonNullsError() {
  return String("{\"humidity\":null,\"status\":\"error\",\"temperature\":null,\"pressure\":null,\"timestamp\":null}");
}

static String jsonSensorData() {
  SensorData copy;
  portENTER_CRITICAL(&dataMux);
  copy = sensorData;
  portEXIT_CRITICAL(&dataMux);

  // if timestamp exists, check stale
  time_t now = time(nullptr);
  bool hasTime = (now >= 100000);
  if (copy.timestamp > 0 && hasTime) {
    int age = (int)(now - copy.timestamp);
    if (age > (READING_INTERVAL * 3)) {
      // don't overwrite shared status, just report stale in output like python did
      strncpy(copy.status, "stale", sizeof(copy.status) - 1);
      copy.status[sizeof(copy.status) - 1] = 0;
    }
  }

  // Build JSON (nulls if missing)
  if (copy.timestamp == 0 || isnan(copy.temperature) || isnan(copy.humidity) || isnan(copy.pressure)) {
    // keep status from copy if you want, but you asked for this exact style on error earlier
    // Here we keep "status" meaningful:
    String s = "{";
    s += "\"temperature\":null,";
    s += "\"humidity\":null,";
    s += "\"pressure\":null,";
    s += "\"timestamp\":null,";
    s += "\"status\":\"";
    s += String(copy.status);
    s += "\"}";
    return s;
  }

  String s = "{";
  s += "\"temperature\":" + String(copy.temperature, 2) + ",";
  s += "\"humidity\":"    + String(copy.humidity, 2) + ",";
  s += "\"pressure\":"    + String(copy.pressure, 2) + ",";
  s += "\"timestamp\":"   + String((long)copy.timestamp) + ",";
  s += "\"status\":\""    + String(copy.status) + "\"";
  s += "}";
  return s;
}

static String jsonHealth() {
  time_t now = time(nullptr);
  if (now < 100000) {
    return String("{\"status\":\"running\",\"timestamp\":null}");
  }
  return String("{\"status\":\"running\",\"timestamp\":") + String((long)now) + "}";
}

static String jsonLedStatus() {
  bool isOn;
  portENTER_CRITICAL(&ledMux);
  isOn = heatingLed;
  portEXIT_CRITICAL(&ledMux);

  return String("{\"heating\":") + (isOn ? "true" : "false") + "}";
}

// Very small JSON body parser for {"state":"on"} / {"state":"off"}
static bool parseLedStateFromBody(const String& body, bool& outOn) {
  // Accept "on"/"off" with or without quotes spacing, very forgiving
  String b = body;
  b.toLowerCase();

  int i = b.indexOf("state");
  if (i < 0) return false;

  // Look for "on" or "off"
  if (b.indexOf("on", i) >= 0) { outOn = true;  return true; }
  if (b.indexOf("off", i) >= 0) { outOn = false; return true; }

  return false;
}

static void setHeatingLed(bool on) {
  portENTER_CRITICAL(&ledMux);
  heatingLed = on;
  portEXIT_CRITICAL(&ledMux);

  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

// ---------- Sensor task ----------
void sensorTask(void* pv) {
  (void)pv;

  for (;;) {
    float t = bme.readTemperature();
    float h = bme.readHumidity();
    float p = bme.readPressure() / 100.0F;
    time_t now = time(nullptr);

    bool ok = !isnan(t) && !isnan(h) && !isnan(p) && (now >= 100000);

    portENTER_CRITICAL(&dataMux);
    if (ok) {
      sensorData.temperature = t;
      sensorData.humidity = h;
      sensorData.pressure = p;
      sensorData.timestamp = now;
      strncpy(sensorData.status, "ok", sizeof(sensorData.status) - 1);
      sensorData.status[sizeof(sensorData.status) - 1] = 0;
    } else {
      // keep last good values if you prefer; here we mark error but keep fields as-is
      strncpy(sensorData.status, "error", sizeof(sensorData.status) - 1);
      sensorData.status[sizeof(sensorData.status) - 1] = 0;

      // if no valid time, we also clear timestamp to match your error schema
      if (now < 100000) sensorData.timestamp = 0;
    }
    portEXIT_CRITICAL(&dataMux);

    // Optional debug
    if (ok) {
      Serial.printf("BME280: %.2f°C, %.2f%%, %.2f hPa\n", t, h, p);
    } else {
      Serial.println("BME280: read error or time not synced");
    }

    vTaskDelay(pdMS_TO_TICKS(READING_INTERVAL * 1000));
  }
}

// ---------- HTTP request handling ----------
static bool readRequestLine(WiFiClient& client, String& method, String& path) {
  String line = client.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return false;

  int sp1 = line.indexOf(' ');
  if (sp1 < 0) return false;
  int sp2 = line.indexOf(' ', sp1 + 1);
  if (sp2 < 0) return false;

  method = line.substring(0, sp1);
  path = line.substring(sp1 + 1, sp2);

  // strip querystring
  int q = path.indexOf('?');
  if (q >= 0) path = path.substring(0, q);

  method.toUpperCase();
  return true;
}

static void handleClient(WiFiClient& client) {
  unsigned long start = millis();

  String method, path;
  if (!readRequestLine(client, method, path)) {
    httpSend(client, 400, "application/json", "{\"error\":\"bad request\"}");
    return;
  }

  int contentLength = 0;

  // Read headers
  while (client.connected() && (millis() - start) < CLIENT_TIMEOUT_MS) {
    String h = client.readStringUntil('\n');
    if (!client.connected()) break;
    h.trim();
    if (h.length() == 0) break; // end headers

    String hl = h;
    hl.toLowerCase();
    if (hl.startsWith("content-length:")) {
      String v = h.substring(strlen("Content-Length:"));
      v.trim();
      contentLength = v.toInt();
    }
  }

  String body = "";
  if (method == "POST" && contentLength > 0) {
    // Read body exactly contentLength bytes (best effort within timeout)
    unsigned long bstart = millis();
    while ((int)body.length() < contentLength && (millis() - bstart) < CLIENT_TIMEOUT_MS) {
      if (client.available()) {
        body += (char)client.read();
      } else {
        delay(1);
      }
    }
  }

  // Routing
  if (method == "GET" && (path == "/" || path == "/data")) {
    httpSend(client, 200, "application/json", jsonSensorData());
    return;
  }

  if (method == "GET" && path == "/health") {
    httpSend(client, 200, "application/json", jsonHealth());
    return;
  }

  if (method == "GET" && path == "/api/led/status") {
    httpSend(client, 200, "application/json", jsonLedStatus());
    return;
  }

  if (path == "/api/led/heating") {
    if (method != "POST") {
      httpSend(client, 405, "application/json", "{\"error\":\"method not allowed\"}");
      return;
    }

    bool on = false;
    if (!parseLedStateFromBody(body, on)) {
      httpSend(client, 400, "application/json", "{\"error\":\"Parametre \\\"state\\\" manquant (on/off)\"}");
      return;
    }

    setHeatingLed(on);
    String resp = String("{\"success\":true,\"state\":\"") + (on ? "on" : "off") + "\"}";
    httpSend(client, 200, "application/json", resp);
    return;
  }

  httpSend(client, 404, "application/json", "{\"error\":\"not found\"}");
}

// ---------- Setup / Loop ----------
void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  if (!bme.begin(BME_ADDR)) { // try 0x77 if needed
    Serial.println("Could not find a valid BME280 sensor, check wiring!");
    while (1) delay(10);
  }

  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostname);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  bool timeOk = syncTimeNTP();
  Serial.println(timeOk ? "NTP time synced." : "NTP sync failed (timestamp will be null until it works).");

  server.begin();

  // Start sensor background task
  xTaskCreatePinnedToCore(
    sensorTask,
    "sensorTask",
    4096,
    nullptr,
    1,
    nullptr,
    1
  );
}

void loop() {
  // basic WiFi resilience
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(200);
    return;
  }

  WiFiClient client = server.available();
  if (!client) return;

  Serial.println("New Client.");
  handleClient(client);
  client.stop();
  Serial.println("Client disconnected.\n");
}
