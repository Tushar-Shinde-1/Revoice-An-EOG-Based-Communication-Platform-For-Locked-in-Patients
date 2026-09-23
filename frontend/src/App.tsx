import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Keyboard, 
  Gamepad2, 
  Settings, 
  Activity, 
  Eye, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { eyeInputManager } from './services/eyeInputManager';
import type { EyeGestureEvent } from './services/eyeInputManager';
import { speechService } from './services/speechService';
import { socketService } from './services/socketService';
import { DailyCommunication } from './components/DailyCommunication';
import { KeyboardAssistant } from './components/KeyboardAssistant';
import { GamesSection } from './components/GamesSection';
import { HealthMonitoringModal } from './components/HealthMonitoringModal';
import { SettingsModal } from './components/SettingsModal';

const SECTIONS = [
  { id: 'daily', label: '1. Daily Communication', icon: <MessageSquare size={20} /> },
  { id: 'keyboard', label: '2. Keyboard Assistant', icon: <Keyboard size={20} /> },
  { id: 'games', label: '3. Accessible Games', icon: <Gamepad2 size={20} /> }
];

export const App: React.FC = () => {
  // Navigation state
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [activeItemCount, setActiveItemCount] = useState<number>(8);
  const [isSubMenu, setIsSubMenu] = useState<boolean>(false);
  const [triggerSelect, setTriggerSelect] = useState<boolean>(false);

  // Gesture feedback & stats
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const [gestureFlash, setGestureFlash] = useState<string | null>(null);
  const [saccadeStats, setSaccadeStats] = useState({ left: 0, right: 0, blinks: 0 });

  // Caregiver Modals
  const [isHealthOpen, setIsHealthOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [unreadRequests, setUnreadRequests] = useState<number>(0);

  // Keep item count in sync
  const handleActiveItemCount = useCallback((count: number) => {
    setActiveItemCount(count);
  }, []);

  // Central Eye Gesture Handler
  const handleEyeGesture = useCallback((event: EyeGestureEvent) => {
    const { gesture } = event;
    setLastGesture(gesture);
    setGestureFlash(gesture);
    setTimeout(() => setGestureFlash(null), 500);

    // Relay to socket for live caregiver view
    socketService.emitEyeGesture(gesture, event.source);

    if (gesture === 'LOOK_LEFT') {
      speechService.playNavigationTone('left');
      setSaccadeStats(prev => ({ ...prev, left: prev.left + 1 }));
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : activeItemCount - 1));
    } else if (gesture === 'LOOK_RIGHT') {
      speechService.playNavigationTone('right');
      setSaccadeStats(prev => ({ ...prev, right: prev.right + 1 }));
      setFocusedIndex(prev => (prev < activeItemCount - 1 ? prev + 1 : 0));
    } else if (gesture === 'DOUBLE_BLINK') {
      // DOUBLE BLINK: Section Traveling (1 -> 2 -> 3 -> 1)
      speechService.playSectionTone();
      setSaccadeStats(prev => ({ ...prev, blinks: prev.blinks + 2 }));
      setIsSubMenu(false);
      setFocusedIndex(0);
      setCurrentSectionIndex(prev => {
        const next = (prev + 1) % SECTIONS.length;
        speechService.speak(`Switched to ${SECTIONS[next].label}`);
        return next;
      });
    } else if (gesture === 'TRIPLE_BLINK') {
      // TRIPLE BLINK: Enter Section or Select Option
      speechService.playSelectionTone();
      setSaccadeStats(prev => ({ ...prev, blinks: prev.blinks + 3 }));
      setTriggerSelect(true);
    }
  }, [activeItemCount]);

  // Subscribe to eye input manager
  useEffect(() => {
    const unsubscribe = eyeInputManager.subscribe(handleEyeGesture);
    return () => unsubscribe();
  }, [handleEyeGesture]);

  // Subscribe to unread requests count for caregiver badge
  useEffect(() => {
    const unsub = socketService.onNewRequest(() => {
      setUnreadRequests(prev => prev + 1);
      speechService.playTone(800, 0.1);
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#070913] text-slate-100 relative overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-600/10 blur-[120px]"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px]"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px]"></div>
      </div>

      {/* TOP BAR: BRANDING + CORNER PANELS */}
      <header className="relative z-20 px-4 md:px-8 py-3 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl flex items-center justify-between gap-4">
        
        {/* Left Corner: Caregiver Settings & Hardware Calibration */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-cyan-300 flex items-center gap-2 text-xs md:text-sm font-semibold transition-all shadow-sm cursor-pointer group"
          >
            <Settings size={17} className="group-hover:rotate-45 transition-transform duration-300 text-purple-400" />
            <span className="hidden sm:inline">Caregiver Settings & Calibration</span>
            <span className="sm:hidden">Settings</span>
          </button>
        </div>

        {/* Center: Revoice Title & Patient Status Indicator */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400">
              REVOICE
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold tracking-widest border border-cyan-500/30 uppercase">
              LIS EYE ASSISTANT
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Locked-In Syndrome Autonomous Eye-Communication System
          </p>
        </div>

        {/* Right Corner: Health Monitoring & Live Request Feed */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsHealthOpen(true);
              setUnreadRequests(0);
            }}
            className="relative px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-emerald-300 flex items-center gap-2 text-xs md:text-sm font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Activity size={17} className="text-emerald-400" />
            <span className="hidden sm:inline">Health Monitoring & Vitals</span>
            <span className="sm:hidden">Vitals</span>

            {/* Unread Alert Badge */}
            {unreadRequests > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg animate-bounce">
                {unreadRequests}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* SECTION TABS (Section Traveling via Double-Blink) */}
      <nav className="relative z-10 px-4 md:px-8 py-3 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-center gap-3 md:gap-6">
        {SECTIONS.map((sec, idx) => {
          const isActive = currentSectionIndex === idx;
          return (
            <button
              key={sec.id}
              onClick={() => {
                setCurrentSectionIndex(idx);
                setFocusedIndex(0);
                setIsSubMenu(false);
                speechService.playSectionTone();
                speechService.speak(`Switched to ${sec.label}`);
              }}
              className={`
                px-4 md:px-6 py-2.5 rounded-2xl flex items-center gap-2.5 text-sm md:text-base font-bold transition-all duration-300 border-2 cursor-pointer
                ${isActive 
                  ? 'section-tab-active bg-cyan-950/40 border-cyan-400 text-white shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}
              `}
            >
              <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>{sec.icon}</span>
              <span>{sec.label}</span>
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping ml-1"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 relative z-10 p-4 md:p-6 lg:p-8 flex flex-col max-w-7xl w-full mx-auto">
        {currentSectionIndex === 0 && (
          <DailyCommunication
            focusedIndex={focusedIndex}
            isSubMenu={isSubMenu}
            onEnterSubMenu={() => {
              setIsSubMenu(true);
              setFocusedIndex(0);
            }}
            onExitSubMenu={() => {
              setIsSubMenu(false);
              setFocusedIndex(0);
            }}
            triggerSelect={triggerSelect}
            onSelectHandled={() => setTriggerSelect(false)}
            activeItemCount={handleActiveItemCount}
          />
        )}

        {currentSectionIndex === 1 && (
          <KeyboardAssistant
            focusedIndex={focusedIndex}
            triggerSelect={triggerSelect}
            onSelectHandled={() => setTriggerSelect(false)}
            activeItemCount={handleActiveItemCount}
          />
        )}

        {currentSectionIndex === 2 && (
          <GamesSection
            focusedIndex={focusedIndex}
            triggerSelect={triggerSelect}
            onSelectHandled={() => setTriggerSelect(false)}
            activeItemCount={handleActiveItemCount}
            lastGesture={lastGesture}
          />
        )}
      </main>

      {/* EYE MOVEMENT SIMULATOR & HARDWARE STATUS FOOTER */}
      <footer className="relative z-20 px-4 md:px-8 py-3 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Live Detected Eye Gesture Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Eye size={16} className="text-cyan-400" />
            <span className="font-semibold text-slate-300">Eye Signal:</span>
          </div>

          <div className={`
            px-3 py-1 rounded-xl font-mono text-xs md:text-sm font-black tracking-wider transition-all duration-300 border
            ${gestureFlash === 'LOOK_LEFT' ? 'bg-cyan-500 text-slate-950 border-cyan-300 scale-110' :
              gestureFlash === 'LOOK_RIGHT' ? 'bg-purple-500 text-slate-950 border-purple-300 scale-110' :
              gestureFlash === 'DOUBLE_BLINK' ? 'bg-amber-400 text-slate-950 border-amber-200 scale-110' :
              gestureFlash === 'TRIPLE_BLINK' ? 'bg-emerald-400 text-slate-950 border-emerald-200 scale-110' :
              'bg-slate-900 text-slate-400 border-slate-800'}
          `}>
            {lastGesture || 'READY (WAITING FOR EYE GESTURE)'}
          </div>

          <div className="text-[11px] text-slate-500 hidden lg:block">
            (Single Blinks: <span className="text-emerald-400">Safely Suppressed</span>)
          </div>
        </div>

        {/* Interactive Eye Simulator Buttons (Allows direct testing without hardware) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold mr-1 hidden sm:inline">
            Simulator:
          </span>

          <button
            onClick={() => eyeInputManager.emitGesture('LOOK_LEFT', 'simulator')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Press Left Arrow or 'A'"
          >
            <ChevronLeft size={14} /> Look Left [←]
          </button>

          <button
            onClick={() => eyeInputManager.emitGesture('LOOK_RIGHT', 'simulator')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-300 text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Press Right Arrow or 'D'"
          >
            Look Right [→] <ChevronRight size={14} />
          </button>

          <button
            onClick={() => eyeInputManager.emitGesture('DOUBLE_BLINK', 'simulator')}
            className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Press '2' or 'B' (Double Blink switches sections)"
          >
            👁️👁️ Double Blink [2]
          </button>

          <button
            onClick={() => eyeInputManager.emitGesture('TRIPLE_BLINK', 'simulator')}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Press '3' or 'T' or Enter (Triple Blink enters/selects)"
          >
            👁️👁️👁️ Triple Blink [3]
          </button>
        </div>
      </footer>

      {/* CORNER MODALS */}
      <HealthMonitoringModal
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        saccadeStats={saccadeStats}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
