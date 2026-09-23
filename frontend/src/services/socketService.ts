import { io, Socket } from 'socket.io-client';
import type { PatientRequestData, HealthTelemetryData } from './apiService';

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.socket) return;

    try {
      this.socket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 5000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Connected to Revoice WebSocket Server');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        console.log('❌ Disconnected from Revoice WebSocket Server');
      });
    } catch (err) {
      console.warn('Socket connection error:', err);
    }
  }

  public onNewRequest(callback: (req: PatientRequestData) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('new_patient_request', callback);
    return () => this.socket?.off('new_patient_request', callback);
  }

  public onRequestAttended(callback: (req: PatientRequestData) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('request_attended', callback);
    return () => this.socket?.off('request_attended', callback);
  }

  public onEmergencyAlarm(callback: (req: PatientRequestData) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('emergency_alarm', callback);
    return () => this.socket?.off('emergency_alarm', callback);
  }

  public onHealthTelemetry(callback: (data: HealthTelemetryData) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('health_telemetry', callback);
    return () => this.socket?.off('health_telemetry', callback);
  }

  public emitEyeGesture(gesture: string, source: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('eye_gesture', { gesture, source, timestamp: Date.now() });
    }
  }
}

export const socketService = new SocketService();
