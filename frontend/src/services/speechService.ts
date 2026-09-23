// Speech and Audio Synthesis Service for Locked-In Syndrome Assistive Dashboard

class SpeechAudioService {
  private audioCtx: AudioContext | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private rate: number = 0.95;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private tonesEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initVoices();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.initVoices();
        };
      }
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Prefer clear natural English voice
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')));
      this.voice = preferred || voices.find(v => v.lang.startsWith('en')) || voices[0];
    }
  }

  public setConfig(options: { rate?: number; pitch?: number; volume?: number; tonesEnabled?: boolean; voiceIndex?: number }) {
    if (options.rate !== undefined) this.rate = options.rate;
    if (options.pitch !== undefined) this.pitch = options.pitch;
    if (options.volume !== undefined) this.volume = options.volume;
    if (options.tonesEnabled !== undefined) this.tonesEnabled = options.tonesEnabled;
    if (options.voiceIndex !== undefined && typeof window !== 'undefined') {
      const voices = window.speechSynthesis.getVoices();
      if (voices[options.voiceIndex]) {
        this.voice = voices[options.voiceIndex];
      }
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  // Play synthesized audio tone
  public playTone(frequency: number, duration: number = 0.08, type: OscillatorType = 'sine', gainVal: number = 0.15) {
    if (!this.tonesEnabled || typeof window === 'undefined') return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio autoplay restrictions before first user gesture
    }
  }

  // Audio feedback for eye movement (Saccade Left / Right)
  public playNavigationTone(direction: 'left' | 'right') {
    const freq = direction === 'left' ? 440 : 587; // A4 for left, D5 for right
    this.playTone(freq, 0.06, 'triangle', 0.12);
  }

  // Audio feedback for Section Travel (Double Blink)
  public playSectionTone() {
    this.playTone(523.25, 0.08, 'sine', 0.2); // C5
    setTimeout(() => this.playTone(659.25, 0.12, 'sine', 0.22), 80); // E5
  }

  // Audio feedback for Selection / Drilldown (Triple Blink)
  public playSelectionTone() {
    this.playTone(587.33, 0.07, 'sine', 0.2); // D5
    setTimeout(() => this.playTone(739.99, 0.08, 'sine', 0.22), 70); // F#5
    setTimeout(() => this.playTone(880.00, 0.15, 'sine', 0.25), 140); // A5
  }

  // Audio alarm for Emergency SOS
  public playEmergencyAlarm() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playTone(900, 0.12, 'sawtooth', 0.35);
        setTimeout(() => this.playTone(600, 0.12, 'sawtooth', 0.35), 130);
      }, i * 280);
    }
  }

  // Speak Text aloud using Web Speech Synthesis
  public speak(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      if (onEnd) {
        utterance.onend = onEnd;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  }
}

export const speechService = new SpeechAudioService();
