// SØNA Touch 01 - Core Audio Engine
// 432 Hz base, vocal synthesis with formants, per-voice control

import { 
  PHI, 
  BASE_FREQUENCY, 
  MAX_VOICES, 
  RHYTHM, 
  PHI_HARMONICS,
  ZONE_BEHAVIORS 
} from '../utils/constants';
import { SynestheticParams, audioToColor, HSLColor } from '../utils/colorUtils';
import { VoiceManager, ManagedVoice } from './VoiceManager';
import { LoopManager } from './LoopManager';

// Re-export Voice type for compatibility
export type Voice = ManagedVoice;

export interface AudioMappings {
  x: 'none' | 'frequency' | 'filter' | 'harmonics' | 'amplitude' | 'pan';
  y: 'none' | 'frequency' | 'filter' | 'harmonics' | 'amplitude' | 'pan';
}

// Formant frequencies for vowel sounds (Hz)
// Each vowel has 3 formants [F1, F2, F3]
// Refined for smoother, more organic, less nasal/metallic sound
const VOWEL_FORMANTS = {
  // Dark vowels (low intensity) - warmer, rounder
  O: { f: [380, 750, 2400], q: [6, 5, 4], gain: [1, 0.35, 0.15] },
  U: { f: [320, 680, 2300], q: [7, 5, 4], gain: [1, 0.3, 0.12] },
  // Neutral vowel (medium intensity) - balanced, smooth
  A: { f: [650, 1100, 2450], q: [5, 4, 3.5], gain: [1, 0.45, 0.2] },
  // Bright vowels (high intensity) - open but not piercing
  E: { f: [480, 1600, 2400], q: [5, 4, 3], gain: [1, 0.5, 0.22] },
  I: { f: [350, 1900, 2600], q: [5.5, 4, 3], gain: [1, 0.55, 0.25] },
};

// Easing function for smooth intensity morphing
const easeIntensity = (t: number): number => {
  // Soft S-curve: slow start, smooth middle, gentle top
  return t < 0.5 
    ? 2 * t * t 
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private synestheticParams: SynestheticParams = {
    frequency: BASE_FREQUENCY,
    harmonicDensity: 0.5,
    filterBrightness: 0.5,
    warmth: 0.5,
  };
  private mappings: AudioMappings = { x: 'frequency', y: 'filter' };
  private gridMode: 'grid' | 'flow' = 'grid';
  private isInitialized = false;
  private activePointers: Set<number> = new Set();

  // Initialize audio context (must be called after user interaction)
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioContextClass) {
      console.error('[AudioEngine] Web Audio API not supported');
      return;
    }

    this.audioContext = new AudioContextClass();
    
    VoiceManager.setAudioContext(this.audioContext);
    
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // iOS silent unlock — play empty buffer to fully unlock audio pipeline
    try {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (e) {
      console.warn('[AudioEngine] silent unlock failed:', String(e));
    }
    
    // CRITICAL: Mark initialized BEFORE attempting resume
    // On iOS, await resume() can hang indefinitely — we must not block on it
    this.isInitialized = true;

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('[AudioEngine] resume rejected:', String(e));
      }
    }
  }

  // Get analyzer for visualization
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Set synesthetic color parameters
  setSynestheticParams(params: SynestheticParams): void {
    this.synestheticParams = params;
    
    // Update all active voices
    VoiceManager.getAllVoiceIds().forEach(id => {
      const voice = VoiceManager.getVoice(id);
      if (voice && voice.isActive) {
        this.updateVoiceFromParams(voice);
      }
    });
  }

  // Set XY mappings
  setMappings(mappings: AudioMappings): void {
    this.mappings = mappings;
  }

  // Set grid/flow mode with audio reset
  setGridMode(mode: 'grid' | 'flow'): void {
    this.stopAllSound();
    this.gridMode = mode;
  }

  // Interpolate between two vowel formant sets
  private interpolateFormants(
    vowel1: typeof VOWEL_FORMANTS.A,
    vowel2: typeof VOWEL_FORMANTS.A,
    t: number
  ): typeof VOWEL_FORMANTS.A {
    return {
      f: vowel1.f.map((f, i) => f + (vowel2.f[i] - f) * t) as [number, number, number],
      q: vowel1.q.map((q, i) => q + (vowel2.q[i] - q) * t) as [number, number, number],
      gain: vowel1.gain.map((g, i) => g + (vowel2.gain[i] - g) * t) as [number, number, number],
    };
  }

  // Get formant settings based on intensity (0-1) with smooth easing
  private getVowelFormants(intensity: number): typeof VOWEL_FORMANTS.A {
    // Apply easing for smoother transitions
    const easedIntensity = easeIntensity(intensity);
    
    if (easedIntensity < 0.4) {
      // Dark zone: O/U blend → towards A (larger range for calm sounds)
      const t = easedIntensity / 0.4;
      const dark = this.interpolateFormants(VOWEL_FORMANTS.U, VOWEL_FORMANTS.O, 0.4);
      return this.interpolateFormants(dark, VOWEL_FORMANTS.A, t * 0.7); // Don't fully reach A
    } else if (easedIntensity < 0.75) {
      // Neutral zone: A → towards E (smooth middle)
      const t = (easedIntensity - 0.4) / 0.35;
      return this.interpolateFormants(VOWEL_FORMANTS.A, VOWEL_FORMANTS.E, t * 0.8);
    } else {
      // Bright zone: E → I (capped to avoid too thin/sharp)
      const t = (easedIntensity - 0.75) / 0.25;
      return this.interpolateFormants(VOWEL_FORMANTS.E, VOWEL_FORMANTS.I, t * 0.6); // Cap brightness
    }
  }

  // Create a new voice for a touch point
  async createVoice(touchId: number, x: number, y: number): Promise<Voice | null> {
    if (!this.audioContext || !this.masterGain) {
      console.error('[createVoice] missing context or masterGain');
      return null;
    }

    // CRITICAL for iOS: await resume before creating oscillators
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('[createVoice] resume failed:', String(e));
      }
    }

    // Check if this pointer is already tracked
    if (this.activePointers.has(touchId)) {
      this.releaseVoice(touchId);
    }

    this.activePointers.add(touchId);

    const zone = this.calculateZone(x, y);
    
    // === OSCILLATORS: Rich core with slight detune for organic warmth ===
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const baseFreq = this.synestheticParams.frequency;
    
    // Primary sine oscillator - main body
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = baseFreq;
    const gain1 = this.audioContext.createGain();
    gain1.gain.value = 0.45;
    osc1.connect(gain1);
    oscillators.push(osc1);
    gains.push(gain1);
    
    // Secondary oscillator: gentle detune for warmth (+3 cents)
    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq * 1.0017;
    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0.28;
    osc2.connect(gain2);
    oscillators.push(osc2);
    gains.push(gain2);
    
    // Third oscillator: sub-octave for warmth and body
    const osc3 = this.audioContext.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = baseFreq * 0.5;
    const gain3 = this.audioContext.createGain();
    gain3.gain.value = 0.18;
    osc3.connect(gain3);
    oscillators.push(osc3);
    gains.push(gain3);
    
    // Fourth oscillator: soft triangle for texture (-3 cents)
    const osc4 = this.audioContext.createOscillator();
    osc4.type = 'triangle';
    osc4.frequency.value = baseFreq * 0.9983;
    const gain4 = this.audioContext.createGain();
    gain4.gain.value = 0.12;
    osc4.connect(gain4);
    oscillators.push(osc4);
    gains.push(gain4);
    
    // === BREATH NOISE: Subtle air layer for organic quality ===
    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 2, this.audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.3; // Soft noise
    }
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    
    // Noise filter - bandpass to make it breath-like
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.7;
    
    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = 0; // Start silent, controlled by intensity
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    
    // === FORMANT FILTERS: Vowel-like resonances (softened) ===
    const formantFilters: BiquadFilterNode[] = [];
    const formantGains: GainNode[] = [];
    const initialFormants = this.getVowelFormants(0.25); // Start dark/calm
    
    // Create 3 formant filters with gentler settings
    for (let i = 0; i < 3; i++) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = initialFormants.f[i];
      filter.Q.value = initialFormants.q[i];
      // Gentler dB boost for less harsh resonances
      filter.gain.value = 4 + initialFormants.gain[i] * 3;
      formantFilters.push(filter);
      
      const fGain = this.audioContext.createGain();
      fGain.gain.value = initialFormants.gain[i] * 0.85;
      formantGains.push(fGain);
    }
    
    // === VIBRATO LFO - natural, subtle ===
    const vibratoLFO = this.audioContext.createOscillator();
    vibratoLFO.type = 'sine';
    vibratoLFO.frequency.value = 5.2; // Natural singing vibrato rate
    
    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.value = 0; // Start silent
    
    vibratoLFO.connect(vibratoGain);
    // Connect to main oscillators for pitch modulation
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);
    vibratoGain.connect(osc4.frequency);
    
    // === TREMOLO LFO - very subtle brightness variation ===
    const tremoloLFO = this.audioContext.createOscillator();
    tremoloLFO.type = 'sine';
    tremoloLFO.frequency.value = 3.2; // Slow, gentle
    
    const tremoloGain = this.audioContext.createGain();
    tremoloGain.gain.value = 0;
    
    tremoloLFO.connect(tremoloGain);
    
    // === MASTER FILTER (low-pass for overall brightness) ===
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800 * this.synestheticParams.filterBrightness;
    filter.Q.value = 0.7 + this.synestheticParams.harmonicDensity * 1.5; // Lower Q for smoother sound
    
    // === ROUTING ===
    // Oscillators → Formant chain → Master filter → Voice gain → Panner → Master
    const oscillatorMix = this.audioContext.createGain();
    oscillatorMix.gain.value = 1;
    gains.forEach(g => g.connect(oscillatorMix));
    
    // Route through formant filters in parallel, then sum
    const formantMix = this.audioContext.createGain();
    formantMix.gain.value = 0.55; // Reduced for less aggressive resonance
    
    formantFilters.forEach((ff, i) => {
      oscillatorMix.connect(ff);
      ff.connect(formantGains[i]);
      formantGains[i].connect(formantMix);
    });
    
    // Add dry signal for naturalness (more dry = less formant coloration)
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.45; // More dry signal for organic blend
    oscillatorMix.connect(dryGain);
    dryGain.connect(filter);
    formantMix.connect(filter);
    
    // Connect breath noise through the same master filter
    noiseGain.connect(filter);
    
    // Connect tremolo to filter frequency for very subtle brightness modulation
    tremoloGain.connect(filter.frequency);
    
    // Voice master gain
    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    
    // Stereo panner
    const panner = this.audioContext.createStereoPanner();
    panner.pan.setValueAtTime((x - 0.5) * 2, this.audioContext.currentTime);
    
    filter.connect(voiceGain);
    voiceGain.connect(panner);
    panner.connect(this.masterGain);
    
    // Start oscillators, noise, and LFOs
    oscillators.forEach(osc => osc.start());
    noiseSource.start();
    vibratoLFO.start();
    tremoloLFO.start();
    
    // Smooth attack
    voiceGain.gain.setTargetAtTime(0.25, this.audioContext.currentTime, RHYTHM.ATTACK);
    
    const voice: Voice = {
      id: touchId,
      oscillators: [...oscillators, noiseSource as unknown as OscillatorNode], // Include noise for cleanup
      gains: [...gains, noiseGain],
      masterGain: voiceGain,
      filter,
      panner,
      isActive: true,
      x,
      y,
      zone,
      velocity: 0,
      lastUpdate: performance.now(),
      createdAt: performance.now(),
      releaseTimers: [],
      formantFilters,
      formantGains,
      vibratoLFO,
      vibratoGain,
      tremoloLFO,
      tremoloGain,
      intensity: 0.25, // Start calm/dark
      // Synesthetic feedback — will be updated by updateVoiceFromXY
      currentFrequency: this.synestheticParams.frequency,
      currentAmplitude: 0.25,
    };
    
    VoiceManager.addVoice(touchId, voice);
    this.updateVoiceFromXY(voice, x, y);
    
    return voice;
  }

  // Update voice based on XY position
  updateVoice(touchId: number, x: number, y: number): void {
    const voice = VoiceManager.getVoice(touchId);
    if (!voice || !voice.isActive || !this.audioContext) return;

    const now = performance.now();
    const dt = (now - voice.lastUpdate) / 1000;
    
    // Calculate velocity
    const dx = x - voice.x;
    const dy = y - voice.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    voice.velocity = dt > 0 ? distance / dt : 0;
    
    // Update zone if in grid mode
    const newZone = this.calculateZone(x, y);
    if (this.gridMode === 'grid' && newZone !== voice.zone) {
      this.onZoneChange(voice, newZone);
    }
    
    // Apply emergent behaviors in flow mode
    if (this.gridMode === 'flow') {
      this.applyFlowBehaviors(voice);
    }
    
    // Update position
    VoiceManager.updateVoice(touchId, {
      x,
      y,
      zone: newZone,
      velocity: voice.velocity,
      lastUpdate: now,
    });
    
    this.updateVoiceFromXY(voice, x, y);
  }

  // Release a voice
  releaseVoice(touchId: number): void {
    // Remove from active pointers
    this.activePointers.delete(touchId);
    
    // Clear any loops associated with this voice
    LoopManager.clearLoop(touchId);
    // Remove voice through VoiceManager
    VoiceManager.removeVoice(touchId);
  }

  // Stop all sound - guaranteed silence
  stopAllSound(): void {
    // Clear all active pointers
    this.activePointers.clear();
    
    // Clear all loops first
    LoopManager.clearAllLoops();
    
    // Remove all voices immediately
    VoiceManager.removeAllVoices();
    
    // Reset master gain to ensure silence
    if (this.masterGain && this.audioContext) {
      const currentTime = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(currentTime);
      this.masterGain.gain.setValueAtTime(0, currentTime);
      // Restore after brief moment
      this.masterGain.gain.setValueAtTime(0.5, currentTime + 0.05);
    }
    
    // Log successful stop
    console.log('SØNA Touch 01 — All audio stopped successfully.');
  }

  // Reset audio state (for preset/mode changes)
  resetAudioState(): void {
    this.stopAllSound();
  }

  // Check if a pointer is currently active
  isPointerActive(pointerId: number): boolean {
    return this.activePointers.has(pointerId);
  }

  // Private: Update voice from XY position based on mappings
  private updateVoiceFromXY(voice: Voice, x: number, y: number): void {
    if (!this.audioContext || !voice.isActive) return;

    // Calculate intensity from Y position and velocity (higher = more intensity)
    const yIntensity = 1 - y; // Invert: top = high intensity
    const velocityBoost = Math.min(voice.velocity * 0.35, 0.2); // Reduced velocity influence
    const newIntensity = Math.max(0, Math.min(1, yIntensity * 0.65 + velocityBoost + 0.1));
    
    // Smoothly update intensity with slower interpolation for stability
    voice.intensity = voice.intensity + (newIntensity - voice.intensity) * 0.08;
    
    // Update synesthetic feedback defaults (overridden if explicitly mapped)
    voice.currentAmplitude = voice.intensity;
    // If frequency is not mapped via XY, use the synesthetic base frequency
    if (this.mappings.x !== 'frequency' && this.mappings.y !== 'frequency') {
      voice.currentFrequency = this.synestheticParams.frequency;
    }
    
    // Update formants based on intensity (vowel morphing)
    this.updateFormants(voice);
    
    // Update vibrato and breath based on intensity
    this.updateVibrato(voice);
    this.updateBreath(voice);

    const applyMapping = (param: string, value: number) => {
      switch (param) {
        case 'frequency':
          const baseFreq = this.synestheticParams.frequency;
          const freqMultiplier = 0.5 + value * 1.5; // 0.5x to 2x
          const freq = baseFreq * freqMultiplier;
          
          // Track current frequency for synesthetic feedback
          voice.currentFrequency = freq;
          
          // Update main oscillators with proper detuning
          if (voice.oscillators[0]) {
            voice.oscillators[0].frequency.setTargetAtTime(freq, this.audioContext!.currentTime, RHYTHM.FAST);
          }
          if (voice.oscillators[1]) {
            voice.oscillators[1].frequency.setTargetAtTime(freq * 1.002, this.audioContext!.currentTime, RHYTHM.FAST);
          }
          if (voice.oscillators[2]) {
            voice.oscillators[2].frequency.setTargetAtTime(freq * 0.5, this.audioContext!.currentTime, RHYTHM.FAST);
          }
          if (voice.oscillators[3]) {
            voice.oscillators[3].frequency.setTargetAtTime(freq * 0.998, this.audioContext!.currentTime, RHYTHM.FAST);
          }
          break;
          
        case 'filter':
          const filterFreq = 300 + value * 6000 * this.synestheticParams.filterBrightness;
          voice.filter.frequency.setTargetAtTime(
            filterFreq,
            this.audioContext!.currentTime,
            RHYTHM.FAST
          );
          break;
          
        case 'harmonics':
          // Adjust formant gains based on harmonic control
          if (voice.formantGains) {
            voice.formantGains.forEach((gain, i) => {
              const baseGain = [1, 0.6, 0.35][i] || 0.5;
              const boost = 1 + value * 1.5;
              gain.gain.setTargetAtTime(
                baseGain * boost,
                this.audioContext!.currentTime,
                RHYTHM.MEDIUM
              );
            });
          }
          break;
          
        case 'amplitude':
          voice.currentAmplitude = value;
          voice.masterGain.gain.setTargetAtTime(
            value * 0.35,
            this.audioContext!.currentTime,
            RHYTHM.FAST
          );
          break;
          
        case 'pan':
          voice.panner.pan.setTargetAtTime(
            (value - 0.5) * 2,
            this.audioContext!.currentTime,
            RHYTHM.FAST
          );
          break;
      }
    };

    if (this.mappings.x !== 'none') applyMapping(this.mappings.x, x);
    if (this.mappings.y !== 'none') applyMapping(this.mappings.y, 1 - y);
  }

  // Update formant filters for vowel morphing (smoothed)
  private updateFormants(voice: Voice): void {
    if (!this.audioContext || !voice.formantFilters || !voice.formantGains) return;
    
    const formants = this.getVowelFormants(voice.intensity);
    const time = this.audioContext.currentTime;
    const smoothTime = RHYTHM.SLOW; // Slower transitions for organic feel
    
    voice.formantFilters.forEach((filter, i) => {
      filter.frequency.setTargetAtTime(formants.f[i], time, smoothTime);
      filter.Q.setTargetAtTime(formants.q[i], time, smoothTime);
      // Gentler gain values for less harsh resonances
      filter.gain.setTargetAtTime(4 + formants.gain[i] * 4, time, smoothTime);
    });
    
    voice.formantGains.forEach((gain, i) => {
      gain.gain.setTargetAtTime(formants.gain[i] * 0.85, time, smoothTime);
    });
  }

  // Update vibrato based on intensity (refined for musical feel)
  private updateVibrato(voice: Voice): void {
    if (!this.audioContext || !voice.vibratoGain || !voice.tremoloGain) return;
    
    const time = this.audioContext.currentTime;
    const baseFreq = this.synestheticParams.frequency;
    
    // Apply easing to intensity for smoother vibrato response
    const easedIntensity = easeIntensity(voice.intensity);
    
    // Vibrato depth: almost none at low intensity, gentle at high
    // Max ~4 cents (reduced from 6) for more natural sound
    const vibratoDepth = easedIntensity * easedIntensity * baseFreq * 0.0025;
    voice.vibratoGain.gain.setTargetAtTime(vibratoDepth, time, RHYTHM.SLOW);
    
    // Tremolo: very subtle brightness modulation (reduced)
    const tremoloDepth = easedIntensity * 80; // Reduced from 200
    voice.tremoloGain.gain.setTargetAtTime(tremoloDepth, time, RHYTHM.SLOW);
    
    // Natural vibrato rate stays more consistent (5.0-5.8 Hz range)
    if (voice.vibratoLFO) {
      const vibratoRate = 5.0 + easedIntensity * 0.8;
      voice.vibratoLFO.frequency.setTargetAtTime(vibratoRate, time, RHYTHM.SLOW);
    }
  }

  // Update breath/noise layer based on intensity
  private updateBreath(voice: Voice): void {
    if (!this.audioContext || !voice.gains) return;
    
    const time = this.audioContext.currentTime;
    
    // Noise gain is the last in the gains array
    const noiseGain = voice.gains[voice.gains.length - 1];
    if (!noiseGain) return;
    
    // Apply easing - breath is very subtle
    const easedIntensity = easeIntensity(voice.intensity);
    
    // Breath: silent at low intensity, very quiet at high (max 0.03)
    const breathLevel = easedIntensity * easedIntensity * 0.025;
    noiseGain.gain.setTargetAtTime(breathLevel, time, RHYTHM.MEDIUM);
  }

  // Private: Update voice from synesthetic parameters
  private updateVoiceFromParams(voice: Voice): void {
    if (!this.audioContext || !voice.isActive) return;

    const baseFreq = this.synestheticParams.frequency;
    
    // Update oscillators with proper detuning for vocal synthesis
    if (voice.oscillators[0]) {
      voice.oscillators[0].frequency.setTargetAtTime(baseFreq, this.audioContext.currentTime, RHYTHM.MEDIUM);
    }
    if (voice.oscillators[1]) {
      voice.oscillators[1].frequency.setTargetAtTime(baseFreq * 1.002, this.audioContext.currentTime, RHYTHM.MEDIUM);
    }
    if (voice.oscillators[2]) {
      voice.oscillators[2].frequency.setTargetAtTime(baseFreq * 0.5, this.audioContext.currentTime, RHYTHM.MEDIUM);
    }
    if (voice.oscillators[3]) {
      voice.oscillators[3].frequency.setTargetAtTime(baseFreq * 0.998, this.audioContext.currentTime, RHYTHM.MEDIUM);
    }

    // Update filter based on brightness and warmth
    const brightness = this.synestheticParams.filterBrightness;
    const warmth = this.synestheticParams.warmth;
    voice.filter.frequency.setTargetAtTime(
      600 + brightness * 5000,
      this.audioContext.currentTime,
      RHYTHM.MEDIUM
    );
    voice.filter.Q.setTargetAtTime(
      0.5 + warmth * 3,
      this.audioContext.currentTime,
      RHYTHM.MEDIUM
    );
    
    // Update formants based on current intensity
    this.updateFormants(voice);
    this.updateVibrato(voice);
  }

  // Private: Calculate zone from position (3x3 grid)
  private calculateZone(x: number, y: number): number {
    const gridSize = 3;
    const col = Math.min(Math.floor(x * gridSize), gridSize - 1);
    const row = Math.min(Math.floor(y * gridSize), gridSize - 1);
    return row * gridSize + col;
  }

  // Private: Handle zone changes in grid mode
  private onZoneChange(voice: Voice, newZone: number): void {
    if (!this.audioContext || !voice.isActive) return;

    const harmonicDensity = ZONE_BEHAVIORS.HARMONIC_DENSITY[newZone] / 9;
    const modulationSpeed = ZONE_BEHAVIORS.MODULATION_SPEED[newZone];
    
    // Adjust oscillator gains based on zone
    const gainLevels = [0.5, 0.35, 0.2, 0.15];
    voice.gains.forEach((gain, i) => {
      const baseLevel = gainLevels[i] || 0.1;
      const zoneBoost = 1 + harmonicDensity * 0.5;
      gain.gain.setTargetAtTime(
        baseLevel * zoneBoost,
        this.audioContext!.currentTime,
        modulationSpeed
      );
    });
    
    // Zone affects intensity slightly
    voice.intensity = Math.max(0, Math.min(1, voice.intensity + (harmonicDensity - 0.5) * 0.2));
    this.updateFormants(voice);
  }

  // Private: Apply flow mode emergent behaviors (refined for organic response)
  private applyFlowBehaviors(voice: Voice): void {
    if (!this.audioContext || !voice.isActive) return;

    const velocity = voice.velocity;
    const time = this.audioContext.currentTime;
    
    // Velocity affects intensity with gentler response
    const velocityIntensity = Math.min(velocity * 1.5, 0.85); // Cap at 0.85 to avoid harshness
    voice.intensity = voice.intensity + (velocityIntensity - voice.intensity) * 0.06; // Slower blend
    
    // Slow movement → darker, calmer vowel
    if (velocity < 0.08) {
      voice.filter.Q.setTargetAtTime(0.8, time, 0.6); // Lower Q for smoother
      // Fade vibrato gently for stillness
      if (voice.vibratoGain) {
        voice.vibratoGain.gain.setTargetAtTime(0, time, 0.5);
      }
    }
    // Fast movement → slightly brighter, more open vowel
    else if (velocity > 0.35) {
      const boost = 1 + velocity * 0.4; // Gentler boost
      // Moderate formant gain increase
      if (voice.formantGains) {
        voice.formantGains.forEach((gain, i) => {
          const baseGain = [0.85, 0.5, 0.25][i] || 0.4;
          gain.gain.setTargetAtTime(baseGain * boost, time, RHYTHM.MEDIUM);
        });
      }
    }
    
    // Velocity affects filter brightness (reduced range)
    const filterFreq = 800 + velocity * 2500 * this.synestheticParams.filterBrightness;
    voice.filter.frequency.setTargetAtTime(
      Math.min(filterFreq, 5500), // Lower cap for less harshness
      time,
      RHYTHM.MEDIUM
    );
    
    // Update formants, vibrato and breath based on new intensity
    this.updateFormants(voice);
    this.updateVibrato(voice);
    this.updateBreath(voice);
  }

  // Get waveform data for visualization
  getWaveformData(): Float32Array {
    if (!this.analyser) return new Float32Array(0);
    
    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  // Get frequency data
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // Set master volume
  setMasterVolume(volume: number): void {
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext.currentTime,
        0.05
      );
    }
  }

  // Get active voice count from VoiceManager
  getActiveVoiceCount(): number {
    return VoiceManager.getActiveVoiceCount();
  }

  // Get synesthetic color derived from a voice's audio state (GSI mapping)
  // Returns HSL where hue=frequency, lightness=amplitude, saturation=intensity
  getVoiceColor(touchId: number): HSLColor | null {
    const voice = VoiceManager.getVoice(touchId);
    if (!voice || !voice.isActive) return null;
    return audioToColor(voice.currentFrequency, voice.currentAmplitude, voice.intensity);
  }

  // Get the average synesthetic color across all active voices
  getAverageColor(): HSLColor | null {
    const ids = VoiceManager.getAllVoiceIds();
    if (ids.length === 0) return null;
    
    let hueSum = 0, satSum = 0, lightSum = 0;
    let count = 0;
    
    ids.forEach(id => {
      const voice = VoiceManager.getVoice(id);
      if (voice && voice.isActive) {
        const c = audioToColor(voice.currentFrequency, voice.currentAmplitude, voice.intensity);
        hueSum += c.h;
        satSum += c.s;
        lightSum += c.l;
        count++;
      }
    });
    
    if (count === 0) return null;
    return { h: Math.round(hueSum / count), s: Math.round(satSum / count), l: Math.round(lightSum / count) };
  }

  // Check if initialized
  get initialized(): boolean {
    return this.isInitialized;
  }

  // Suspend audio context
  suspend(): void {
    this.audioContext?.suspend();
  }

  // Resume audio context (legacy)
  resume(): void {
    this.audioContext?.resume();
  }

  // Ensure audio context is resumed — non-blocking for iOS compatibility
  ensureResumed(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
        .catch((e) => console.warn('[AudioEngine] ensureResumed failed:', String(e)));
    }
    return Promise.resolve();
  }

  // Check if audio context is suspended
  isSuspended(): boolean {
    return this.audioContext ? this.audioContext.state === 'suspended' : false;
  }

  // Cleanup
  dispose(): void {
    this.stopAllSound();
    this.audioContext?.close();
    this.isInitialized = false;
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();