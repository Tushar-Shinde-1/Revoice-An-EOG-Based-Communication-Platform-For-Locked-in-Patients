import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  Droplets, 
  Bath, 
  Shirt, 
  Bed, 
  AlertCircle, 
  HeartHandshake, 
  BellRing, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { speechService } from '../services/speechService';
import { apiService } from '../services/apiService';
import type { PatientRequestData } from '../services/apiService';

export interface CategoryItem {
  id: string;
  label: string;
  speech: string;
  icon: React.ReactNode;
  color: string;
  subItems?: { id: string; label: string; speech: string; icon: string }[];
}

interface DailyCommunicationProps {
  focusedIndex: number;
  isSubMenu: boolean;
  onEnterSubMenu: () => void;
  onExitSubMenu: () => void;
  triggerSelect: boolean;
  onSelectHandled: () => void;
  activeItemCount: (count: number) => void;
}

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'food',
    label: 'Food',
    speech: 'I would like something to eat.',
    icon: <Utensils size={44} />,
    color: '#f97316',
    subItems: [
      { id: 'f_meal', label: 'Main Meal / Rice', speech: 'I want to eat my regular meal.', icon: '🍚' },
      { id: 'f_soup', label: 'Warm Soup', speech: 'Please give me some warm soup.', icon: '🥣' },
      { id: 'f_soft', label: 'Soft Food / Porridge', speech: 'I would like soft food or porridge.', icon: '🍲' },
      { id: 'f_fruit', label: 'Fresh Fruits', speech: 'I want to eat some fresh fruits.', icon: '🍎' },
      { id: 'f_snack', label: 'Snack / Biscuit', speech: 'Can I have a light snack or biscuit?', icon: '🍪' }
    ]
  },
  {
    id: 'water',
    label: 'Water / Drink',
    speech: 'I am thirsty, please give me water.',
    icon: <Droplets size={44} />,
    color: '#06b6d4',
    subItems: [
      { id: 'w_sip', label: 'Sip of Water', speech: 'Please give me a sip of water with a straw.', icon: '💧' },
      { id: 'w_warm', label: 'Warm Water', speech: 'I need warm water please.', icon: '☕' },
      { id: 'w_cold', label: 'Cold Water', speech: 'Please give me cool fresh water.', icon: '🧊' },
      { id: 'w_juice', label: 'Fresh Juice', speech: 'I would like some fresh fruit juice.', icon: '🧃' },
      { id: 'w_mouth', label: 'Moisten Lips', speech: 'My mouth and lips are dry, please moisten them.', icon: '👄' }
    ]
  },
  {
    id: 'toilet',
    label: 'Washroom / Toilet',
    speech: 'I need to use the washroom or bedpan urgently.',
    icon: <Bath size={44} />,
    color: '#8b5cf6',
    subItems: [
      { id: 't_urgent', label: 'Urgent Toilet', speech: 'I need the washroom right now, urgent.', icon: '🚨' },
      { id: 't_bedpan', label: 'Bedpan Needed', speech: 'Please bring the bedpan.', icon: '🛏️' },
      { id: 't_wash', label: 'Wash Hands / Face', speech: 'Please help me wash my hands and face.', icon: '🧼' },
      { id: 't_clean', label: 'Sponge / Cleaning', speech: 'I need to be cleaned or sponge bathed.', icon: '🧽' }
    ]
  },
  {
    id: 'clothing',
    label: 'Clothing & Temp',
    speech: 'I need to adjust my clothing or room temperature.',
    icon: <Shirt size={44} />,
    color: '#3b82f6',
    subItems: [
      { id: 'c_cold', label: 'Feeling Cold / Blanket', speech: 'I am feeling cold. Please put a blanket on me.', icon: '🥶' },
      { id: 'c_hot', label: 'Feeling Warm / Fan', speech: 'I am feeling warm. Please turn on the fan or AC.', icon: '🥵' },
      { id: 'c_change', label: 'Change Clothes', speech: 'My clothes are uncomfortable, please change them.', icon: '👕' },
      { id: 'c_adjust', label: 'Straighten Clothes', speech: 'Please straighten my shirt and bedsheet.', icon: '🛏️' }
    ]
  },
  {
    id: 'comfort',
    label: 'Position & Comfort',
    speech: 'I need to change my posture or bed position.',
    icon: <Bed size={44} />,
    color: '#10b981',
    subItems: [
      { id: 'p_turn_l', label: 'Turn to Left', speech: 'Please gently turn my body to the left side.', icon: '⬅️' },
      { id: 'p_turn_r', label: 'Turn to Right', speech: 'Please gently turn my body to the right side.', icon: '➡️' },
      { id: 'p_sit', label: 'Elevate Head / Sit Up', speech: 'Please raise my bed so I can sit up higher.', icon: '⬆️' },
      { id: 'p_flat', label: 'Lay Flat Down', speech: 'Please lower the bed so I can lie down flat.', icon: '⬇️' },
      { id: 'p_pillow', label: 'Adjust Pillow', speech: 'My pillow is uncomfortable, please reposition it.', icon: '🛋️' }
    ]
  },
  {
    id: 'pain',
    label: 'Pain & Medicine',
    speech: 'I am experiencing pain or need medicine.',
    icon: <AlertCircle size={44} />,
    color: '#ef4444',
    subItems: [
      { id: 'm_head', label: 'Headache', speech: 'I have a painful headache.', icon: '🤕' },
      { id: 'm_chest', label: 'Chest / Breathing', speech: 'I have discomfort in my chest or breathing.', icon: '🫁' },
      { id: 'm_back', label: 'Back / Body Ache', speech: 'My back and body are aching severely.', icon: '⚡' },
      { id: 'm_med', label: 'Due for Medicine', speech: 'Is it time for my scheduled medication?', icon: '💊' },
      { id: 'm_doctor', label: 'Call Doctor / Nurse', speech: 'Please call the nurse or attending doctor.', icon: '🩺' }
    ]
  },
  {
    id: 'family',
    label: 'Family & Social',
    speech: 'I want to communicate with my family.',
    icon: <HeartHandshake size={44} />,
    color: '#ec4899',
    subItems: [
      { id: 's_talk', label: 'Please Stay & Talk', speech: 'Please sit with me and talk, I like your company.', icon: '💬' },
      { id: 's_hand', label: 'Hold My Hand', speech: 'Please hold my hand.', icon: '🤝' },
      { id: 's_yes', label: 'Yes / Agree', speech: 'Yes, I agree.', icon: '✅' },
      { id: 's_no', label: 'No / Disagree', speech: 'No, I disagree or do not want that.', icon: '❌' },
      { id: 's_thanks', label: 'Thank You So Much', speech: 'Thank you very much for taking care of me.', icon: '🙏' },
      { id: 's_love', label: 'I Love You', speech: 'I love you so much.', icon: '❤️' }
    ]
  },
  {
    id: 'sos',
    label: 'EMERGENCY SOS',
    speech: 'EMERGENCY! I need immediate help right now!',
    icon: <BellRing size={44} className="text-red-400 animate-pulse" />,
    color: '#dc2626',
    subItems: [
      { id: 'sos_urgent', label: '🚨 URGENT NURSE', speech: 'EMERGENCY! Caregiver, please come to the bed immediately!', icon: '🚨' },
      { id: 'sos_choke', label: 'Choking / Suction', speech: 'I need suction or assistance clearing my throat!', icon: '⚠️' }
    ]
  }
];

export const DailyCommunication: React.FC<DailyCommunicationProps> = ({
  focusedIndex,
  isSubMenu,
  onEnterSubMenu,
  onExitSubMenu,
  triggerSelect,
  onSelectHandled,
  activeItemCount
}) => {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);

  // Compute active list
  const currentItems = isSubMenu
    ? [
        { id: 'back', label: '⬅️ Return / Back', speech: 'Going back to main menu.', icon: '🔙' },
        ...(CATEGORIES[activeCategoryIndex]?.subItems || [])
      ]
    : CATEGORIES;

  // Inform parent of current item count for navigation bounds
  useEffect(() => {
    activeItemCount(currentItems.length);
  }, [isSubMenu, activeCategoryIndex, currentItems.length, activeItemCount]);

  // Handle selection (Triple Blink trigger)
  useEffect(() => {
    if (!triggerSelect) return;

    if (!isSubMenu) {
      // We are in main category list -> Enter sub-menu
      const chosenCategory = CATEGORIES[focusedIndex];
      if (chosenCategory) {
        if (chosenCategory.id === 'sos') {
          // Trigger Emergency immediately
          handleEmergencySOS();
        } else {
          setActiveCategoryIndex(focusedIndex);
          onEnterSubMenu();
          speechService.playSelectionTone();
          speechService.speak(`${chosenCategory.label} menu opened.`);
        }
      }
    } else {
      // We are inside sub-menu
      if (focusedIndex === 0) {
        // "Return / Back" selected
        onExitSubMenu();
        speechService.playSelectionTone();
      } else {
        const subItem = CATEGORIES[activeCategoryIndex]?.subItems?.[focusedIndex - 1];
        if (subItem) {
          triggerAction(CATEGORIES[activeCategoryIndex].id, subItem.label, subItem.speech);
        }
      }
    }

    onSelectHandled();
  }, [triggerSelect]);

  const handleEmergencySOS = async () => {
    speechService.playEmergencyAlarm();
    speechService.speak('EMERGENCY! Immediate assistance required at patient bed!');
    setSelectedNotification('EMERGENCY SOS BROADCASTED TO CAREGIVER!');

    const reqData: Partial<PatientRequestData> = {
      category: 'sos',
      label: 'EMERGENCY SOS',
      speechText: 'EMERGENCY! Immediate assistance required at patient bed!',
      urgency: 'emergency',
      triggerMethod: 'triple_blink'
    };

    await apiService.createRequest(reqData);
    setTimeout(() => setSelectedNotification(null), 5000);
  };

  const triggerAction = async (category: string, label: string, speechText: string) => {
    speechService.playSelectionTone();
    speechService.speak(speechText);
    setSelectedNotification(`Request Sent: "${label}"`);

    const reqData: Partial<PatientRequestData> = {
      category: category as any,
      label,
      speechText,
      urgency: category === 'sos' || category === 'pain' ? 'urgent' : 'normal',
      triggerMethod: 'triple_blink'
    };

    await apiService.createRequest(reqData);
    setTimeout(() => setSelectedNotification(null), 4000);
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Visual Feedback Toast Notification */}
      {selectedNotification && (
        <div className="mb-4 py-3 px-6 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold flex items-center justify-center gap-3 animate-bounce shadow-lg">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <span className="text-lg md:text-xl">{selectedNotification}</span>
        </div>
      )}

      {/* Header breadcrumb if in submenu */}
      {isSubMenu && (
        <div className="flex items-center gap-3 mb-4 text-cyan-400 font-bold text-lg md:text-xl">
          <span className="text-slate-400">Daily Activities</span>
          <span>&gt;</span>
          <span className="text-white flex items-center gap-2">
            {CATEGORIES[activeCategoryIndex]?.label}
          </span>
          <span className="text-xs ml-auto px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Look Left / Right to Move • Triple-Blink to Select
          </span>
        </div>
      )}

      {/* Main Categories Grid */}
      {!isSubMenu ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 flex-1 items-stretch">
          {CATEGORIES.map((cat, idx) => {
            const isFocused = focusedIndex === idx;
            const isSOS = cat.id === 'sos';

            return (
              <div
                key={cat.id}
                className={`
                  relative p-5 md:p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer
                  transition-all duration-300
                  ${isSOS ? 'bg-red-950/40 border-red-500/40 hover:bg-red-900/50' : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-800/80'}
                  border-2
                  ${isFocused ? 'eye-focus-active !border-cyan-300' : ''}
                `}
                onClick={() => {
                  if (isSOS) handleEmergencySOS();
                  else {
                    setActiveCategoryIndex(idx);
                    onEnterSubMenu();
                  }
                }}
              >
                {/* Active Halo Tag */}
                {isFocused && (
                  <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Sparkles size={12} /> Focused (Triple-Blink)
                  </div>
                )}

                <div 
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300"
                  style={{ 
                    backgroundColor: `${cat.color}22`, 
                    color: cat.color,
                    border: `1px solid ${cat.color}44` 
                  }}
                >
                  {cat.icon}
                </div>

                <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
                  {cat.label}
                </h3>
                <p className="text-xs md:text-sm text-slate-400 line-clamp-2">
                  {cat.speech}
                </p>

                {/* Submenu count badge */}
                {cat.subItems && (
                  <div className="mt-2 text-xs px-2.5 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
                    {cat.subItems.length} Options
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Sub-Menu Items Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-5 flex-1 items-stretch">
          {currentItems.map((item: any, idx) => {
            const isFocused = focusedIndex === idx;
            const isBack = item.id === 'back';

            return (
              <div
                key={item.id}
                className={`
                  relative p-4 md:p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer
                  transition-all duration-300
                  ${isBack ? 'bg-purple-950/40 border-purple-500/40' : 'bg-slate-900/70 border-slate-700/60'}
                  border-2
                  ${isFocused ? 'eye-focus-active !border-cyan-300' : ''}
                `}
                onClick={() => {
                  if (isBack) onExitSubMenu();
                  else triggerAction(CATEGORIES[activeCategoryIndex].id, item.label, item.speech);
                }}
              >
                {isFocused && (
                  <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Sparkles size={12} /> Focused
                  </div>
                )}

                <div className="text-4xl md:text-5xl mb-2">
                  {item.icon}
                </div>
                <h4 className="text-lg md:text-xl font-bold text-white mb-1">
                  {item.label}
                </h4>
                <p className="text-xs md:text-sm text-slate-400">
                  {item.speech}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
