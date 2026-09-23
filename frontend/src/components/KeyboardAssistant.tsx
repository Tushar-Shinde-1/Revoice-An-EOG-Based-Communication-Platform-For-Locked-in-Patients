import React, { useState, useEffect } from 'react';
import { Volume2, Check, Sparkles } from 'lucide-react';
import { speechService } from '../services/speechService';
import { apiService } from '../services/apiService';

interface KeyboardAssistantProps {
  focusedIndex: number;
  triggerSelect: boolean;
  onSelectHandled: () => void;
  activeItemCount: (count: number) => void;
}

const COMMON_WORDS_DICTIONARY = [
  'HELLO', 'HELP', 'HOW', 'HERE', 'HUNGRY', 'HURT',
  'THANK', 'THANKS', 'THE', 'THAT', 'THIS', 'THIRSTY', 'TIRED',
  'PLEASE', 'PAIN', 'PILLOW', 'POSITION', 'PHONE',
  'YES', 'NO', 'NEED', 'NURSE', 'NOT', 'NOW',
  'I', 'LOVE', 'YOU', 'LIKE', 'LATER', 'LITTLE',
  'WATER', 'WASHROOM', 'WANT', 'WHAT', 'WHEN', 'WHERE',
  'DOCTOR', 'MEDICINE', 'COLD', 'HOT', 'GOOD', 'BAD', 'FAMILY'
];

const QUICK_PHRASES = [
  'I love you',
  'Thank you for caring',
  'Please adjust my pillow',
  'I am tired, want to sleep',
  'Can we open the window?',
  'What time is it?'
];

// Layout with rows of letters, utility keys
const KEYBOARD_KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F',
  'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X',
  'Y', 'Z', '␣ SPACE', '⌫ DEL', '🗑️ CLEAR', '🗣️ SPEAK'
];

export const KeyboardAssistant: React.FC<KeyboardAssistantProps> = ({
  focusedIndex,
  triggerSelect,
  onSelectHandled,
  activeItemCount
}) => {
  const [text, setText] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastActionToast, setLastActionToast] = useState<string | null>(null);

  // Total selectable items: Keyboard keys + quick suggestions
  const allSelectables = [...KEYBOARD_KEYS];

  useEffect(() => {
    activeItemCount(allSelectables.length);
  }, [allSelectables.length, activeItemCount]);

  // Update suggestions when current word changes
  useEffect(() => {
    const words = text.trim().split(' ');
    const currentWord = words[words.length - 1]?.toUpperCase() || '';

    if (currentWord.length >= 1) {
      const matched = COMMON_WORDS_DICTIONARY.filter(w => w.startsWith(currentWord)).slice(0, 4);
      setSuggestions(matched);
    } else {
      setSuggestions([]);
    }
  }, [text]);

  // Handle Triple Blink selection
  useEffect(() => {
    if (!triggerSelect) return;

    const selectedKey = allSelectables[focusedIndex];
    if (selectedKey) {
      handleKeyAction(selectedKey);
    }

    onSelectHandled();
  }, [triggerSelect]);

  const handleKeyAction = (key: string) => {
    speechService.playSelectionTone();

    if (key === '␣ SPACE') {
      setText(prev => prev + ' ');
    } else if (key === '⌫ DEL') {
      setText(prev => prev.slice(0, -1));
    } else if (key === '🗑️ CLEAR') {
      setText('');
      speechService.playTone(300, 0.1, 'sawtooth');
    } else if (key === '🗣️ SPEAK') {
      if (text.trim()) {
        speakAndSend();
      } else {
        speechService.speak('Please type something first.');
      }
    } else {
      // Normal character
      setText(prev => prev + key);
    }
  };

  const speakAndSend = async () => {
    const phrase = text.trim();
    if (!phrase) return;

    speechService.speak(phrase);
    setLastActionToast(`Spoken: "${phrase}"`);

    await apiService.createRequest({
      category: 'keyboard',
      label: 'Eye-Typed Message',
      speechText: phrase,
      urgency: 'normal',
      triggerMethod: 'triple_blink'
    });

    setTimeout(() => setLastActionToast(null), 4000);
  };

  const insertSuggestion = (word: string) => {
    speechService.playSelectionTone();
    const words = text.trim().split(' ');
    words.pop(); // remove prefix
    words.push(word);
    setText(words.join(' ') + ' ');
  };

  const insertPhrase = (phrase: string) => {
    speechService.playSelectionTone();
    setText(phrase);
    speechService.speak(phrase);
  };

  return (
    <div className="w-full flex flex-col h-full gap-4">
      {/* Typed Output Display Screen */}
      <div className="p-4 md:p-5 rounded-2xl bg-slate-900/90 border-2 border-cyan-500/40 shadow-xl flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs md:text-sm font-semibold text-slate-400">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Volume2 size={16} /> Eye-Typed Message Display
          </span>
          <span>{text.length} characters</span>
        </div>

        <div className="min-h-[60px] md:min-h-[72px] flex items-center px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-2xl md:text-3xl font-mono text-cyan-200 tracking-wide break-words">
          {text || (
            <span className="text-slate-600 font-sans text-xl md:text-2xl font-normal">
              Look Left / Right to navigate keys • Triple-Blink to type...
            </span>
          )}
        </div>

        {/* Live Word Predictions */}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 pt-1 overflow-x-auto">
            <span className="text-xs text-slate-400 font-medium">Suggestions:</span>
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => insertSuggestion(sug)}
                className="px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-mono text-sm hover:bg-cyan-900/80 cursor-pointer transition-all"
              >
                + {sug}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {lastActionToast && (
        <div className="py-2.5 px-4 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold flex items-center justify-center gap-2 text-sm md:text-base animate-pulse">
          <Check size={18} /> {lastActionToast}
        </div>
      )}

      {/* Virtual Eye Keyboard Grid */}
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5 md:gap-3 flex-1 items-stretch">
        {KEYBOARD_KEYS.map((key, idx) => {
          const isFocused = focusedIndex === idx;
          const isSpeak = key.includes('SPEAK');
          const isDel = key.includes('DEL');
          const isClear = key.includes('CLEAR');
          const isSpace = key.includes('SPACE');

          let keyColorClass = 'bg-slate-900/70 border-slate-700/60 text-white';
          if (isSpeak) keyColorClass = 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 font-bold';
          else if (isDel) keyColorClass = 'bg-amber-950/40 border-amber-500/50 text-amber-300';
          else if (isClear) keyColorClass = 'bg-rose-950/40 border-rose-500/50 text-rose-300';
          else if (isSpace) keyColorClass = 'bg-blue-950/40 border-blue-500/50 text-blue-300';

          return (
            <div
              key={key}
              onClick={() => handleKeyAction(key)}
              className={`
                relative p-3 md:p-4 rounded-xl flex items-center justify-center text-center cursor-pointer select-none
                border-2 transition-all duration-200 text-lg md:text-2xl font-bold font-mono
                ${keyColorClass}
                ${isFocused ? 'eye-focus-active !border-cyan-300 !scale-105' : 'hover:border-slate-500'}
              `}
            >
              {isFocused && (
                <div className="absolute -top-2.5 px-2 py-0.2 rounded-full bg-cyan-400 text-slate-950 font-black text-[10px] tracking-wider shadow">
                  KEY
                </div>
              )}
              {key}
            </div>
          );
        })}
      </div>

      {/* Quick Phrase Shortcuts (Caregiver / Patient presets) */}
      <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-400" />
          <span>Quick Patient Phrases (Click or select to speak immediately):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PHRASES.map((phrase, idx) => (
            <button
              key={idx}
              onClick={() => insertPhrase(phrase)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-cyan-900/40 border border-slate-700 hover:border-cyan-500/40 text-slate-300 text-xs md:text-sm font-medium transition-all cursor-pointer"
            >
              "{phrase}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
