import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  Battery, 
  Wifi, 
  CheckCircle2, 
  Clock, 
  X, 
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/apiService';
import type { PatientRequestData, HealthTelemetryData } from '../services/apiService';
import { socketService } from '../services/socketService';
import { eyeInputManager } from '../services/eyeInputManager';

interface HealthMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  saccadeStats: { left: number; right: number; blinks: number };
}

export const HealthMonitoringModal: React.FC<HealthMonitoringModalProps> = ({
  isOpen,
  onClose,
  saccadeStats
}) => {
  const [requests, setRequests] = useState<PatientRequestData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [healthData] = useState<HealthTelemetryData>({
    blinkRatePerMinute: 15,
    saccadeCount: { left: saccadeStats.left, right: saccadeStats.right },
    batteryPercentage: 94,
    signalQuality: 'good',
    connectionType: 'simulator',
    deviceState: 'active'
  });

  const deviceStatus = eyeInputManager.getStatus();

  const fetchRecentRequests = async () => {
    setLoading(true);
    const data = await apiService.getRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecentRequests();
    }
  }, [isOpen]);

  // Subscribe to live socket events
  useEffect(() => {
    const unsubNew = socketService.onNewRequest(newReq => {
      setRequests(prev => [newReq, ...prev]);
    });

    const unsubAttended = socketService.onRequestAttended(updatedReq => {
      setRequests(prev => prev.map(r => r._id === updatedReq._id ? updatedReq : r));
    });

    return () => {
      unsubNew();
      unsubAttended();
    };
  }, []);

  const handleMarkAttended = async (id?: string) => {
    if (!id) return;
    await apiService.attendRequest(id, 'Nurse / Caregiver');
    setRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'attended', attendedBy: 'Nurse / Caregiver', attendedAt: new Date().toISOString() } : r));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Caregiver Health & Request Monitoring</h3>
              <p className="text-xs text-slate-400">Real-time patient vitals, hardware diagnostics & communication log</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Top Vitals & Hardware Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Patient State */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Heart size={14} className="text-rose-400" /> Patient Status
              </span>
              <span className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                Active / Awake
              </span>
              <span className="text-[11px] text-slate-500">Communicating via Eyes</span>
            </div>

            {/* Saccade & Eye Movements */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Activity size={14} className="text-cyan-400" /> Eye Activity
              </span>
              <span className="text-xl font-bold text-cyan-300 font-mono">
                L: {saccadeStats.left} | R: {saccadeStats.right}
              </span>
              <span className="text-[11px] text-slate-500">Blinks: {saccadeStats.blinks} detected</span>
            </div>

            {/* Board Battery */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Battery size={14} className="text-emerald-400" /> NPG Lite Battery
              </span>
              <span className="text-xl font-bold text-white font-mono">
                {healthData.batteryPercentage}%
              </span>
              <span className="text-[11px] text-emerald-400">Normal (LiPo 1S ~4.0V)</span>
            </div>

            {/* Hardware Link */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Wifi size={14} className="text-purple-400" /> Hardware Signal
              </span>
              <span className="text-lg font-bold text-purple-300 capitalize truncate">
                {deviceStatus.deviceName}
              </span>
              <span className="text-[11px] text-slate-400 capitalize">
                Mode: {deviceStatus.connectionType}
              </span>
            </div>
          </div>

          {/* Patient Requests & History Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-cyan-400" />
                Live Patient Requests Feed
              </h4>
              <button
                onClick={fetchRecentRequests}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {requests.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No communication requests logged yet today.
                </div>
              ) : (
                requests.map(req => {
                  const isEmergency = req.urgency === 'emergency';
                  const isAttended = req.status === 'attended';

                  return (
                    <div
                      key={req._id}
                      className={`
                        p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all
                        ${isEmergency ? 'bg-red-950/50 border-red-500/70' : isAttended ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-800/70 border-cyan-500/40'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm
                          ${isEmergency ? 'bg-red-500 text-white animate-pulse' : 'bg-cyan-500/20 text-cyan-300'}
                        `}>
                          {isEmergency ? 'SOS' : req.category[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm md:text-base">{req.label}</span>
                            {isEmergency && (
                              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 italic">"{req.speechText}"</p>
                          <span className="text-[10px] text-slate-500">
                            {req.createdAt ? new Date(req.createdAt).toLocaleTimeString() : 'Just now'}
                          </span>
                        </div>
                      </div>

                      {/* Attend Action Button */}
                      <div>
                        {isAttended ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                            <CheckCircle2 size={16} /> Attended
                          </div>
                        ) : (
                          <button
                            onClick={() => handleMarkAttended(req._id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow"
                          >
                            <UserCheck size={14} /> Mark Attended
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Locked-In Syndrome Caregiver Monitoring Console</span>
          <span>Port 5000 API • WebSocket Live</span>
        </div>
      </div>
    </div>
  );
};
