/*
 * Revoice - Eye-Controlled System for Locked-In Syndrome (LIS) Patients
 * Firmware: EOG + EEG Dual-Channel Detection for NPG Lite (ESP32-C6 / ESP32-C3)
 * 
 * Channels:
 *   - CH0 (A0): Horizontal Eye Saccades (Left vs Right)
 *   - CH1 (A1): Vertical Eye Movements & Blinks
 * 
 * Interaction Model:
 *   - LOOK LEFT: Saccade Left (emits 'L' / "LEFT")
 *   - LOOK RIGHT: Saccade Right (emits 'R' / "RIGHT")
 *   - DOUBLE BLINK: Section switch (emits 'D' / "DOUBLE_BLINK")
 *   - TRIPLE BLINK: Enter / Select (emits 'T' / "TRIPLE_BLINK")
 *   - SINGLE BLINK: Ignored (prevent unintentional triggers)
 * 
 * Communication:
 *   - Bluetooth Low Energy (BLE) Notify characteristic
 *   - USB Serial at 115200 baud
 * 
 * (c) 2026 Revoice Project / Upside Down Labs BioAmp NPG Lite
 */

#include <Arduino.h>
#include <math.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Adafruit_NeoPixel.h>

// ==========================================
// PIN DEFINITIONS & HARDWARE CONFIG
// ==========================================
#define HORIZONTAL_PIN    A0    // CH0: Horizontal EOG
#define VERTICAL_PIN      A1    // CH1: Vertical EOG / Blink
#define BATTERY_PIN       A6    // Battery monitor

#if defined(CONFIG_IDF_TARGET_ESP32C6)
  #define PIXEL_PIN       15
  #define PIXEL_COUNT     6
  #define LED_PIN         7
#elif defined(CONFIG_IDF_TARGET_ESP32C3)
  #define PIXEL_PIN       3
  #define PIXEL_COUNT     4
  #define LED_PIN         6
#else
  #define PIXEL_PIN       15
  #define PIXEL_COUNT     6
  #define LED_PIN         LED_BUILTIN
#endif

#define SAMPLE_RATE       500     // 500 Hz (2000 us per loop)
#define BAUD_RATE         115200

// BLE UUIDs
#define SERVICE_UUID      "6910123a-eb0d-4c35-9a60-bebe1dcb549d"
#define CHAR_UUID         "5f4f1107-7fc1-43b2-a540-0aa1a9f1ce78"
#define DEVICE_NAME       "NPG_EYE_CONTROL"

// ==========================================
// THRESHOLDS & TIMING (CALIBRATED)
// ==========================================
float HORIZONTAL_THRESHOLD = 80.0;
float BLINK_THRESHOLD      = 100.0;

const unsigned long EYE_DEBOUNCE_MS     = 450;  // Debounce between Left/Right movements
const unsigned long BLINK_DEBOUNCE_MS   = 220;  // Debounce between individual blinks
const unsigned long DOUBLE_BLINK_MS     = 750;  // Max duration between 1st & 2nd blink
const unsigned long TRIPLE_BLINK_MS     = 650;  // Max duration between 2nd & 3rd blink

// ==========================================
// STATE VARIABLES
// ==========================================
float horizontalBaseline = 0;
float verticalBaseline   = 0;
float horizontalFiltered = 0;
float verticalFiltered   = 0;

unsigned long lastEyeMovement = 0;
unsigned long lastBlinkTime   = 0;
unsigned long firstBlinkTime  = 0;
unsigned long secondBlinkTime = 0;
int blinkCount                = 0;  // 0, 1, or 2

bool bleClientConnected = false;
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
Adafruit_NeoPixel pixels(PIXEL_COUNT, PIXEL_PIN, NEO_GRB + NEO_KHZ800);

// Low-pass exponential smoothing filter
inline float lowPass(float input, float previous, float alpha) {
  return previous + alpha * (input - previous);
}

// ==========================================
// BLE CALLBACKS
// ==========================================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    bleClientConnected = true;
    Serial.println(">> BLE Client connected!");
    pixels.setPixelColor(0, pixels.Color(0, 30, 0)); // Green
    pixels.show();
  }
  void onDisconnect(BLEServer* pServer) override {
    bleClientConnected = false;
    Serial.println(">> BLE Client disconnected! Restarting advertising...");
    pixels.setPixelColor(0, pixels.Color(30, 0, 0)); // Red
    pixels.show();
    pServer->getAdvertising()->start();
  }
};

// ==========================================
// EVENT DISPATCHER
// ==========================================
void sendEyeEvent(const char* eventName, char code) {
  // 1. Output to Serial (Compatible with Web Serial)
  Serial.print("EVENT:");
  Serial.print(eventName);
  Serial.print(",");
  Serial.println(code);

  // 2. Notify BLE Client
  if (bleClientConnected && pCharacteristic) {
    uint8_t payload[2] = { (uint8_t)code, 0 };
    pCharacteristic->setValue(payload, 1);
    pCharacteristic->notify();
  }

  // 3. Visual NeoPixel Feedback
  if (code == 'L') {
    pixels.setPixelColor(1, pixels.Color(0, 40, 40));   // Cyan (Left)
  } else if (code == 'R') {
    pixels.setPixelColor(2, pixels.Color(40, 0, 40));   // Magenta (Right)
  } else if (code == 'D') {
    pixels.setPixelColor(3, pixels.Color(40, 40, 0));   // Yellow (Double Blink)
  } else if (code == 'T') {
    pixels.setPixelColor(4, pixels.Color(0, 60, 0));    // Bright Green (Triple Blink)
  }
  pixels.show();

  delay(20);
  pixels.clear();
  if (bleClientConnected) {
    pixels.setPixelColor(0, pixels.Color(0, 15, 0));
  }
  pixels.show();
}

// ==========================================
// CALIBRATION
// ==========================================
void calibrateBaselines() {
  Serial.println("=== Calibrating Eye Baselines (Keep Relaxed 2s) ===");
  pixels.setPixelColor(0, pixels.Color(30, 30, 0));
  pixels.show();

  long hSum = 0;
  long vSum = 0;
  const int CAL_SAMPLES = 1000;

  for (int i = 0; i < CAL_SAMPLES; i++) {
    hSum += analogRead(HORIZONTAL_PIN);
    vSum += analogRead(VERTICAL_PIN);
    delay(2);
  }

  horizontalBaseline = hSum / (float)CAL_SAMPLES;
  verticalBaseline   = vSum / (float)CAL_SAMPLES;

  Serial.print("Baseline H: "); Serial.println(horizontalBaseline);
  Serial.print("Baseline V: "); Serial.println(verticalBaseline);
  Serial.println("=== Calibration Complete! Ready for Eyes ===");

  pixels.clear();
  pixels.show();
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(BAUD_RATE);
  delay(200);

  pinMode(HORIZONTAL_PIN, INPUT);
  pinMode(VERTICAL_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  pixels.begin();
  pixels.clear();
  pixels.show();

  // Baseline calibration
  calibrateBaselines();

  // BLE Setup
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising* pAdvertising = pServer->getAdvertising();
  pAdvertising->start();
  Serial.println(">> BLE Advertising started as: " DEVICE_NAME);
}

// ==========================================
// MAIN LOOP (500 Hz Execution)
// ==========================================
void loop() {
  static unsigned long lastSample = 0;
  if (micros() - lastSample < 2000) return; // 500 Hz
  lastSample = micros();

  // Read analog voltages
  int rawH = analogRead(HORIZONTAL_PIN);
  int rawV = analogRead(VERTICAL_PIN);

  // Baseline subtraction & low-pass filtering
  float h = rawH - horizontalBaseline;
  float v = rawV - verticalBaseline;

  horizontalFiltered = lowPass(h, horizontalFiltered, 0.12);
  verticalFiltered   = lowPass(v, verticalFiltered, 0.12);

  unsigned long nowMs = millis();

  // ----------------------------------------------------
  // 1. HORIZONTAL EYE MOVEMENT DETECTION (Left / Right)
  // ----------------------------------------------------
  if ((nowMs - lastEyeMovement) > EYE_DEBOUNCE_MS) {
    if (horizontalFiltered > HORIZONTAL_THRESHOLD) {
      sendEyeEvent("LEFT", 'L');
      lastEyeMovement = nowMs;
    } else if (horizontalFiltered < -HORIZONTAL_THRESHOLD) {
      sendEyeEvent("RIGHT", 'R');
      lastEyeMovement = nowMs;
    }
  }

  // ----------------------------------------------------
  // 2. BLINK DETECTION (Double & Triple; Single Filtered)
  // ----------------------------------------------------
  bool blinkDetected = (fabs(verticalFiltered) > BLINK_THRESHOLD) && 
                       ((nowMs - lastBlinkTime) >= BLINK_DEBOUNCE_MS);

  if (blinkDetected) {
    lastBlinkTime = nowMs;

    if (blinkCount == 0) {
      // First blink observed
      firstBlinkTime = nowMs;
      blinkCount = 1;
    } else if (blinkCount == 1 && (nowMs - firstBlinkTime) <= DOUBLE_BLINK_MS) {
      // Second blink observed within double-blink window
      secondBlinkTime = nowMs;
      blinkCount = 2;
    } else if (blinkCount == 2 && (nowMs - secondBlinkTime) <= TRIPLE_BLINK_MS) {
      // Third blink observed within triple-blink window -> TRIPLE BLINK!
      sendEyeEvent("TRIPLE_BLINK", 'T');
      blinkCount = 0; // Reset state
    } else {
      // Extra or delayed blink -> restart sequence
      firstBlinkTime = nowMs;
      blinkCount = 1;
    }
  }

  // Check if double-blink window timed out without a 3rd blink -> Valid DOUBLE BLINK!
  if (blinkCount == 2 && (nowMs - secondBlinkTime) > TRIPLE_BLINK_MS) {
    sendEyeEvent("DOUBLE_BLINK", 'D');
    blinkCount = 0;
  }

  // Single blink timeout -> SILENTLY DISCARD (Prevent accidental triggers)
  if (blinkCount == 1 && (nowMs - firstBlinkTime) > DOUBLE_BLINK_MS) {
    // Involuntary single blink ignored
    blinkCount = 0;
  }

  // ----------------------------------------------------
  // 3. PERIODIC TELEMETRY DEBUG STREAM (Every 100ms)
  // ----------------------------------------------------
  static unsigned long lastTelemetry = 0;
  if (nowMs - lastTelemetry >= 100) {
    lastTelemetry = nowMs;
    // Format: RAW:H,V (can be parsed by browser telemetry graphs)
    Serial.print("RAW:");
    Serial.print((int)horizontalFiltered);
    Serial.print(",");
    Serial.println((int)verticalFiltered);
  }
}
