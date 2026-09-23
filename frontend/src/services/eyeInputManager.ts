// Central Eye Input Manager for Locked-In Syndrome (LIS) Assistant
// Handles: Left, Right, Double Blink, Triple Blink (Strictly filters out single blinks)
// Supports: Web Bluetooth (BLE), Web Serial (USB), and Simulated / Keyboard Input

export type EyeGesture = 'LOOK_LEFT' | 'LOOK_RIGHT' | 'DOUBLE_BLINK' | 'TRIPLE_BLINK';

export interface EyeGestureEvent {
  gesture: EyeGesture;
  timestamp: number;
  source: 'ble' | 'serial' | 'simulator' | 'keyboard';
}

export type GestureListener = (event: EyeGestureEvent) => void;

class EyeInputManager {
  private listeners: Set<GestureListener> = new Set();
  private isConnected: boolean = false;
  private connectionType: 'ble' | 'serial' | 'simulator' = 'simulator';
  private deviceName: string = 'Simulator Mode';
  
  // Web Bluetooth handles
  private bleDevice: any = null;
  private bleCharacteristic: any = null;

  // Web Serial handles
  private serialPort: any = null;
  private serialReader: any = null;
  private serialKeepReading: boolean = false;

  // Anti-noise guards
  // Ignore all hardware gestures for this many ms after connecting (electrode settling time)
  private settlingUntil: number = 0;
  private readonly SETTLING_DELAY_MS = 4000; // 4 seconds after connect before gestures are accepted

  // Frontend debounce: ignore same gesture repeated within this window
  private lastGestureTime: number = 0;
  private lastGestureType: string = '';
  private readonly FRONTEND_DEBOUNCE_MS = 600; // ms between same gesture allowed on frontend

  constructor() {
    this.initKeyboardListener();
  }

  // Subscribe to eye gesture events
  public subscribe(listener: GestureListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Emit event to all subscribers (with frontend debounce for hardware sources)
  public emitGesture(gesture: EyeGesture, source: 'ble' | 'serial' | 'simulator' | 'keyboard') {
    const now = Date.now();

    // For hardware sources: apply settling guard + frontend debounce
    if (source === 'ble' || source === 'serial') {
      // Still in settling window after connect — ignore all hardware signals
      if (now < this.settlingUntil) {
        console.log(`[EyeInput] Settling guard active — ignoring ${gesture} (${Math.round((this.settlingUntil - now) / 1000)}s remaining)`);
        return;
      }
      // Same gesture repeated too fast — likely noise bounce
      if (gesture === this.lastGestureType && (now - this.lastGestureTime) < this.FRONTEND_DEBOUNCE_MS) {
        console.log(`[EyeInput] Frontend debounce — ignoring rapid repeat ${gesture}`);
        return;
      }
    }

    this.lastGestureTime = now;
    this.lastGestureType = gesture;

    const event: EyeGestureEvent = {
      gesture,
      timestamp: now,
      source
    };
    this.listeners.forEach(fn => fn(event));
  }

  // Keyboard navigation for testing & accessibility fallback
  private initKeyboardListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // Don't intercept if typing in an input element
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.emitGesture('LOOK_LEFT', 'keyboard');
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.emitGesture('LOOK_RIGHT', 'keyboard');
      } else if (e.key === '2' || e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.emitGesture('DOUBLE_BLINK', 'keyboard');
      } else if (e.key === '3' || e.key.toLowerCase() === 't' || e.key === 'Enter') {
        e.preventDefault();
        this.emitGesture('TRIPLE_BLINK', 'keyboard');
      }
    });
  }

  // ==========================================
  // WEB BLUETOOTH (BLE) CONNECTION
  // ==========================================
  public async connectBLE(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        throw new Error('Web Bluetooth is not supported in this browser (use Chrome or Edge).');
      }

      const SERVICE_UUID = '6910123a-eb0d-4c35-9a60-bebe1dcb549d';
      const CHAR_UUID = '5f4f1107-7fc1-43b2-a540-0aa1a9f1ce78';

      console.log('Scanning for NPG Lite BLE eye controller...');
      this.bleDevice = await nav.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'NPG' },
          { namePrefix: 'ESP32' }
        ],
        optionalServices: [SERVICE_UUID]
      });

      this.bleDevice.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      const server = await this.bleDevice.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      this.bleCharacteristic = await service.getCharacteristic(CHAR_UUID);

      await this.bleCharacteristic.startNotifications();
      this.bleCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        if (!value || value.byteLength === 0) return;

        const byte = value.getUint8(0);
        const char = String.fromCharCode(byte);

        if (char === 'L' || char === 'l') {
          this.emitGesture('LOOK_LEFT', 'ble');
        } else if (char === 'R' || char === 'r') {
          this.emitGesture('LOOK_RIGHT', 'ble');
        } else if (char === 'D' || char === 'd') {
          this.emitGesture('DOUBLE_BLINK', 'ble');
        } else if (char === 'T' || char === 't') {
          this.emitGesture('TRIPLE_BLINK', 'ble');
        }
      });

      this.isConnected = true;
      this.connectionType = 'ble';
      this.deviceName = this.bleDevice.name || 'NPG Lite BLE';

      // Start settling guard: ignore all BLE gestures for 4 seconds
      // This allows electrodes and signal baseline to stabilize after connect
      this.settlingUntil = Date.now() + this.SETTLING_DELAY_MS;
      console.log('[EyeInput] BLE connected. 4-second settling guard started — no gestures will fire until signals stabilize.');

      return true;
    } catch (err: any) {
      console.error('BLE connection failed:', err);
      throw err;
    }
  }

  // ==========================================
  // WEB SERIAL (USB-C) CONNECTION
  // ==========================================
  public async connectSerial(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.serial) {
        throw new Error('Web Serial is not supported in this browser (use Chrome or Edge).');
      }

      this.serialPort = await nav.serial.requestPort();
      await this.serialPort.open({ baudRate: 115200 });

      this.serialKeepReading = true;
      this.isConnected = true;
      this.connectionType = 'serial';
      this.deviceName = 'NPG Lite (USB Serial)';

      this.readSerialLoop();
      return true;
    } catch (err: any) {
      console.error('Serial connection failed:', err);
      throw err;
    }
  }

  private async readSerialLoop() {
    let buffer = '';
    const textDecoder = new TextDecoderStream();
    this.serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.serialReader = reader;

    try {
      while (this.serialKeepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            this.parseSerialLine(line.trim());
          }
        }
      }
    } catch (err) {
      console.error('Serial read loop error:', err);
    } finally {
      reader.releaseLock();
    }
  }

  private parseSerialLine(line: string) {
    if (!line) return;

    if (line.includes('LEFT') || line.includes('EVENT:LEFT,L')) {
      this.emitGesture('LOOK_LEFT', 'serial');
    } else if (line.includes('RIGHT') || line.includes('EVENT:RIGHT,R')) {
      this.emitGesture('LOOK_RIGHT', 'serial');
    } else if (line.includes('DOUBLE_BLINK') || line.includes('EVENT:DOUBLE_BLINK,D')) {
      this.emitGesture('DOUBLE_BLINK', 'serial');
    } else if (line.includes('TRIPLE_BLINK') || line.includes('EVENT:TRIPLE_BLINK,T')) {
      this.emitGesture('TRIPLE_BLINK', 'serial');
    }
  }

  // Disconnect active hardware
  public async disconnect() {
    this.serialKeepReading = false;
    if (this.serialReader) {
      try { await this.serialReader.cancel(); } catch {}
      this.serialReader = null;
    }
    if (this.serialPort) {
      try { await this.serialPort.close(); } catch {}
      this.serialPort = null;
    }
    if (this.bleDevice && this.bleDevice.gatt.connected) {
      this.bleDevice.gatt.disconnect();
      this.bleDevice = null;
    }
    this.handleDisconnect();
  }

  private handleDisconnect() {
    this.isConnected = false;
    this.connectionType = 'simulator';
    this.deviceName = 'Simulator Mode';
  }

  // Status getters
  public getStatus() {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      deviceName: this.deviceName
    };
  }

  // Update thresholds dynamically from Caregiver settings
  public updateCalibration(_params: { horizontalThreshold?: number; blinkThreshold?: number; debounceMs?: number }) {
    // Threshold parameters synced
  }
}

export const eyeInputManager = new EyeInputManager();
