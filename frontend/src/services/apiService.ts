// API Client Service for Revoice LIS Dashboard

const API_BASE_URL = 'http://localhost:5000/api';

export interface PatientRequestData {
  _id?: string;
  category: 'food' | 'water' | 'toilet' | 'clothing' | 'comfort' | 'pain' | 'family' | 'sos' | 'keyboard' | 'custom';
  subCategory?: string;
  label: string;
  speechText: string;
  urgency?: 'normal' | 'urgent' | 'emergency';
  status?: 'pending' | 'in-progress' | 'attended';
  triggerMethod?: string;
  createdAt?: string;
  attendedAt?: string;
  attendedBy?: string;
}

export interface HealthTelemetryData {
  _id?: string;
  blinkRatePerMinute: number;
  saccadeCount: { left: number; right: number };
  batteryPercentage: number;
  signalQuality: 'excellent' | 'good' | 'moderate' | 'poor' | 'disconnected';
  connectionType: 'ble' | 'serial' | 'simulator' | 'disconnected';
  deviceState: 'active' | 'idle' | 'sleeping' | 'alert';
  createdAt?: string;
}

export interface CaregiverSettingsData {
  calibration: {
    horizontalThreshold: number;
    blinkThreshold: number;
    eyeDebounceMs: number;
    blinkDebounceMs: number;
    doubleBlinkWindowMs: number;
    tripleBlinkWindowMs: number;
  };
  speech: {
    voiceIndex: number;
    rate: number;
    pitch: number;
    volume: number;
    audioTonesEnabled: boolean;
  };
  caregiver: {
    name: string;
    contactNumber: string;
    roomNumber: string;
    audioAlertVolume: number;
  };
  theme: {
    mode: 'dark' | 'light' | 'high-contrast';
  };
}

class ApiService {
  // Requests API
  async getRequests(status?: string): Promise<PatientRequestData[]> {
    try {
      const url = status ? `${API_BASE_URL}/requests?status=${status}` : `${API_BASE_URL}/requests`;
      const res = await fetch(url);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('API getRequests fallback:', err);
      return [];
    }
  }

  async createRequest(reqData: Partial<PatientRequestData>): Promise<PatientRequestData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('API createRequest fallback:', err);
      return null;
    }
  }

  async attendRequest(id: string, attendedBy: string = 'Caregiver'): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/requests/${id}/attend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendedBy })
      });
      const json = await res.json();
      return json.success;
    } catch (err) {
      console.warn('API attendRequest fallback:', err);
      return false;
    }
  }

  // Health API
  async getLatestHealth(): Promise<HealthTelemetryData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/health/latest`);
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('API getLatestHealth fallback:', err);
      return null;
    }
  }

  async sendTelemetry(data: Partial<HealthTelemetryData>): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/health/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.warn('API sendTelemetry fallback:', err);
    }
  }

  // Settings API
  async getSettings(): Promise<CaregiverSettingsData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings`);
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('API getSettings fallback:', err);
      return null;
    }
  }

  async updateSettings(data: Partial<CaregiverSettingsData>): Promise<CaregiverSettingsData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('API updateSettings fallback:', err);
      return null;
    }
  }
}

export const apiService = new ApiService();
