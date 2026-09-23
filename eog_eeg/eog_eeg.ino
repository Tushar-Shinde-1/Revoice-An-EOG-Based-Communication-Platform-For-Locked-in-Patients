/*
 * Revoice & M2W - Eye-Controlled System for NPG Lite (ESP32-C6 / ESP32-C3)
 * Dual-Channel EOG + Blink Detection with Web Bluetooth (BLE)
 * 
 * Hardware:
 *   - CH0 (Pin A0): Horizontal Eye Saccades (Left vs. Right)
 *   - CH1 (Pin A1): Vertical Eye Movements & Blinks
 * 
 * BLE Compatibility:
 *   - Matches BCI-Blink-BLE.ino & M2W Device Name: "ESP32C6_EEG"
 *   - Service UUID: 6910123a-eb0d-4c35-9a60-bebe1dcb549d
 *   - Char UUID:    5f4f1107-7fc1-43b2-a540-0aa1a9f1ce78
 * 
 * Gestures:
 *   - 'L' : Look Left
 *   - 'R' : Look Right
 *   - 'D' : Double Blink (Switch Section)
 *   - 'T' : Triple Blink (Select / Enter)
 */

#include <Arduino.h>
#include <math.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Adafruit_NeoPixel.h>

// ==========================================
// PIN & HARDWARE CONFIGURATION
// ==========================================
#define HORIZONTAL_PIN    A0    // CH0: Horizontal EOG
#define VERTICAL_PIN      A1    // CH1: Vertical EOG / Blinks

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

#define SAMPLE_RATE       500     // 500 Hz (2 ms per sample)
#define BAUD_RATE         115200

// BLE UUIDs (Identical to BCI-Blink-BLE.ino and M2W)
#define SERVICE_UUID      "6910123a-eb0d-4c35-9a60-bebe1dcb549d"
#define CHAR_UUID         "5f4f1107-7fc1-43b2-a540-0aa1a9f1ce78"
#define DEVICE_NAME       "ESP32C6_EEG"

// ==========================================
// THRESHOLDS & TIMINGS
// ==========================================
// !! TUNE THESE FIRST via Serial Monitor after calibration !!
// Start high (150/200) and lower gradually until gestures trigger reliably
float HORIZONTAL_THRESHOLD = 150.0;  // Raise if random LEFT/RIGHT fire. Lower if gestures not detected
float BLINK_THRESHOLD      = 180.0;  // Raise if random blinks fire. Lower if blinks not detected

const unsigned long EYE_DEBOUNCE_MS     = 700;  // Min ms between Left/Right detections (increase to reduce false triggers)
const unsigned long BLINK_DEBOUNCE_MS   = 350;  // Min ms between individual blinks
const unsigned long DOUBLE_BLINK_MS     = 800;  // Max window between 1st and 2nd blink
const unsigned long TRIPLE_BLINK_MS     = 700;  // Max window between 2nd and 3rd blink

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
int blinkCount                = 0;

bool clientConnected = false;
BLEServer* pBleServer         = nullptr;
BLECharacteristic* pBlinkChar = nullptr;
Adafruit_NeoPixel pixels(PIXEL_COUNT, PIXEL_PIN, NEO_GRB + NEO_KHZ800);

// Exponential low-pass filter
inline float lowPass(float input, float previous, float alpha) {
  return previous + alpha * (input - previous);
}

// Set all NeoPixels to a single color
void setAllPixels(uint32_t color) {
  for (int i = 0; i < PIXEL_COUNT; i++) {
    pixels.setPixelColor(i, color);
  }
  pixels.show();
}

// ==========================================
// BLE SERVER CALLBACKS
// ==========================================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    clientConnected = true;
    Serial.println(">> [BLE] Client connected successfully!");
    setAllPixels(pixels.Color(0, 30, 0)); // Green
  }
  void onDisconnect(BLEServer* pServer) override {
    clientConnected = false;
    Serial.println(">> [BLE] Client disconnected. Restarting advertising...");
    setAllPixels(pixels.Color(30, 0, 0)); // Red flash
    delay(200);
    setAllPixels(pixels.Color(0, 0, 20)); // Return to Blue advertising
    pServer->getAdvertising()->start();
  }
};

// ==========================================
// SEND GESTURE EVENT (BLE + SERIAL)
// ==========================================
void sendEyeEvent(const char* label, char code) {
  // 1. Output to Serial Monitor for debugging
  Serial.print(">> GESTURE: ");
  Serial.print(label);
  Serial.print(" ('");
  Serial.print(code);
  Serial.println("')");

  // 2. Notify BLE Client (Revoice App / M2W)
  if (clientConnected && pBlinkChar) {
    uint8_t payload = (uint8_t)code;
    pBlinkChar->setValue(&payload, 1);
    pBlinkChar->notify();
  }

  // 3. Visual NeoPixel feedback
  if (code == 'L') {
    pixels.setPixelColor(1, pixels.Color(0, 40, 40));   // Cyan (Left)
  } else if (code == 'R') {
    pixels.setPixelColor(2, pixels.Color(40, 0, 40));   // Magenta (Right)
  } else if (code == 'D') {
    pixels.setPixelColor(3, pixels.Color(40, 40, 0));   // Yellow (Double Blink)
  } else if (code == 'T') {
    setAllPixels(pixels.Color(50, 50, 50));             // White Flash (Triple Blink)
  }
  pixels.show();

  delay(35);
  // Restore connection color
  if (clientConnected) {
    setAllPixels(pixels.Color(0, 15, 0)); // Dim green
  } else {
    setAllPixels(pixels.Color(0, 0, 15)); // Dim blue
  }
}

// ==========================================
// BASELINE CALIBRATION (Keep eyes still)
// ==========================================
void calibrateBaselines() {
  Serial.println("========================================");
  Serial.println("CALIBRATING: Sit still, look straight ahead");
  Serial.println("Waiting 3 seconds before sampling...");
  Serial.println("========================================");

  setAllPixels(pixels.Color(30, 30, 0)); // Yellow during calibration

  // Give user time to settle completely before sampling
  delay(3000);

  long hSum = 0;
  long vSum = 0;
  const int SAMPLES = 1500; // More samples = more accurate baseline (3 seconds @ 500Hz)

  for (int i = 0; i < SAMPLES; i++) {
    hSum += analogRead(HORIZONTAL_PIN);
    vSum += analogRead(VERTICAL_PIN);
    delay(2);
  }

  horizontalBaseline = hSum / (float)SAMPLES;
  verticalBaseline   = vSum / (float)SAMPLES;

  Serial.println("--- CALIBRATION RESULT ---");
  Serial.print("Baseline H (CH0/A0P-A0N): "); Serial.println(horizontalBaseline);
  Serial.print("Baseline V (CH1/A1P-A1N): "); Serial.println(verticalBaseline);
  Serial.println("--- If baselines are near 0 or 4095, check electrode connections! ---");
  Serial.println("Calibration complete! Ready.");

  setAllPixels(pixels.Color(0, 0, 20)); // Blue for BLE advertising
}

// ==========================================
// ARDUINO SETUP
// ==========================================
void setup() {
  Serial.begin(BAUD_RATE);
  delay(150);

  pinMode(HORIZONTAL_PIN, INPUT);
  pinMode(VERTICAL_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  pixels.begin();
  pixels.clear();
  pixels.show();

  // Run 2-second baseline calibration
  calibrateBaselines();

  // Initialize BLE
  Serial.println("Initializing BLE as: " DEVICE_NAME);
  BLEDevice::init(DEVICE_NAME);
  pBleServer = BLEDevice::createServer();
  pBleServer->setCallbacks(new MyServerCallbacks());

  BLEService* pBlinkService = pBleServer->createService(SERVICE_UUID);

  pBlinkChar = pBlinkService->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pBlinkChar->addDescriptor(new BLE2902());

  pBlinkService->start();

  BLEAdvertising* pAdvertising = pBleServer->getAdvertising();
  pAdvertising->start();
  Serial.println(">> BLE Advertising started. Waiting for connection...");
}

// ==========================================
// ARDUINO LOOP (500 Hz Sampling)
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

  horizontalFiltered = lowPass(h, horizontalFiltered, 0.07);  // Lower alpha = smoother, less reactive to noise
  verticalFiltered   = lowPass(v, verticalFiltered, 0.07);

  unsigned long nowMs = millis();

  // ----------------------------------------------------
  // 1. HORIZONTAL EYE MOVEMENTS (Left vs. Right)
  // ----------------------------------------------------
  if ((nowMs - lastEyeMovement) > EYE_DEBOUNCE_MS) {
    if (horizontalFiltered > HORIZONTAL_THRESHOLD) {
      sendEyeEvent("LOOK_LEFT", 'L');
      lastEyeMovement = nowMs;
    } else if (horizontalFiltered < -HORIZONTAL_THRESHOLD) {
      sendEyeEvent("LOOK_RIGHT", 'R');
      lastEyeMovement = nowMs;
    }
  }

  // ----------------------------------------------------
  // 2. BLINK DETECTION (Double 'D' / Triple 'T')
  // ----------------------------------------------------
  bool blinkDetected = (fabs(verticalFiltered) > BLINK_THRESHOLD) && 
                       ((nowMs - lastBlinkTime) >= BLINK_DEBOUNCE_MS);

  if (blinkDetected) {
    lastBlinkTime = nowMs;

    if (blinkCount == 0) {
      firstBlinkTime = nowMs;
      blinkCount = 1;
    } else if (blinkCount == 1 && (nowMs - firstBlinkTime) <= DOUBLE_BLINK_MS) {
      secondBlinkTime = nowMs;
      blinkCount = 2;
    } else if (blinkCount == 2 && (nowMs - secondBlinkTime) <= TRIPLE_BLINK_MS) {
      // Third blink detected in window -> TRIPLE BLINK!
      sendEyeEvent("TRIPLE_BLINK", 'T');
      blinkCount = 0;
    } else {
      firstBlinkTime = nowMs;
      blinkCount = 1;
    }
  }

  // Check if double-blink timed out without 3rd blink -> DOUBLE BLINK!
  if (blinkCount == 2 && (nowMs - secondBlinkTime) > TRIPLE_BLINK_MS) {
    sendEyeEvent("DOUBLE_BLINK", 'D');
    blinkCount = 0;
  }

  // Involuntary single blink timeout -> Silently discard
  if (blinkCount == 1 && (nowMs - firstBlinkTime) > DOUBLE_BLINK_MS) {
    blinkCount = 0;
  }

  // ----------------------------------------------------
  // 3. PERIODIC DEBUG STREAM TO SERIAL (Every 100ms)
  // ----------------------------------------------------
  static unsigned long lastPrint = 0;
  if (nowMs - lastPrint >= 100) {
    lastPrint = nowMs;
    Serial.print("H:");
    Serial.print((int)horizontalFiltered);
    Serial.print(" \tV:");
    Serial.print((int)verticalFiltered);
    if (clientConnected) {
      Serial.print(" \t[BLE: CONNECTED]");
    } else {
      Serial.print(" \t[BLE: ADVERTISING]");
    }
    Serial.println();
  }
}
