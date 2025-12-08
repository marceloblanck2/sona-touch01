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
import { SynestheticParams } from '../utils/colorUtils';
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
const VOWEL_FORMANTS = {
  // Dark vowels (low intensity)
  O: { f: [400, 800, 2600], q: [12, 10, 8], gain: [1, 0.5, 0.3] },
  U: { f: [350, 700, 2500], q: [14, 12, 8], gain: [1, 0.4, 0.25] },
  // Neutral vowel (medium intensity)
  A: { f: [700, 1200, 2600], q: [10, 8, 6], gain: [1, 0.6, 0.35] },
  // Bright vowels (high intensity)
  E: { f: [500, 1800, 2600], q: [8, 7, 6], gain: [1, 0.7, 0.4] },
  I: { f: [300, 2200, 3000], q: [10, 6, 5], gain: [1, 0.8, 0.45] },
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
    if (this.isInitialized) return;

    this.audioContext = new AudioContext();
    VoiceManager.setAudioContext(this.audioContext);
    
    // Master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    
    // Analyser for waveform visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    this.isInitialized = true;
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

  // Get formant settings based on intensity (0-1)
  private getVowelFormants(intensity: number): typeof VOWEL_FORMANTS.A {
    if (intensity < 0.33) {
      // Dark: O/U blend → towards A
      const t = intensity / 0.33;
      const dark = this.interpolateFormants(VOWEL_FORMANTS.U, VOWEL_FORMANTS.O, 0.5);
      return this.interpolateFormants(dark, VOWEL_FORMANTS.A, t);
    } else if (intensity < 0.66) {
      // Neutral: A → towards E
      const t = (intensity - 0.33) / 0.33;
      return this.interpolateFormants(VOWEL_FORMANTS.A, VOWEL_FORMANTS.E, t);
    } else {
      // Bright: E → I
      const t = (intensity - 0.66) / 0.34;
      return this.interpolateFormants(VOWEL_FORMANTS.E, VOWEL_FORMANTS.I, t);
    }
  }

  // Create a new voice for a touch point
  createVoice(touchId: number, x: number, y: number): Voice | null {
    if (!this.audioContext || !this.masterGain) return null;

    // Check if this pointer is already tracked
    if (this.activePointers.has(touchId)) {
      this.releaseVoice(touchId);
    }

    this.activePointers.add(touchId);

    const zone = this.calculateZone(x, y);
    
    // === OSCILLATORS: Rich core with slight detune ===
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const baseFreq = this.synestheticParams.frequency;
    
    // Primary sine oscillator
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = baseFreq;
    const gain1 = this.audioContext.createGain();
    gain1.gain.value = 0.5;
    osc1.connect(gain1);
    oscillators.push(osc1);
    gains.push(gain1);
    
    // Secondary oscillator: slight detune for warmth
    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq * 1.002; // +2 cents detune
    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0.35;
    osc2.connect(gain2);
    oscillators.push(osc2);
    gains.push(gain2);
    
    // Third oscillator: sub-octave for body
    const osc3 = this.audioContext.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = baseFreq * 0.5; // Octave below
    const gain3 = this.audioContext.createGain();
    gain3.gain.value = 0.2;
    osc3.connect(gain3);
    oscillators.push(osc3);
    gains.push(gain3);
    
    // Fourth oscillator: soft triangle for air/breath
    const osc4 = this.audioContext.createOscillator();
    osc4.type = 'triangle';
    osc4.frequency.value = baseFreq * 0.998; // -2 cents detune
    const gain4 = this.audioContext.createGain();
    gain4.gain.value = 0.15;
    osc4.connect(gain4);
    oscillators.push(osc4);
    gains.push(gain4);
    
    // === FORMANT FILTERS: Vowel-like resonances ===
    const formantFilters: BiquadFilterNode[] = [];
    const formantGains: GainNode[] = [];
    const initialFormants = this.getVowelFormants(0.3); // Start neutral-dark
    
    // Create 3 formant filters
    for (let i = 0; i < 3; i++) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = initialFormants.f[i];
      filter.Q.value = initialFormants.q[i];
      filter.gain.value = 8 + initialFormants.gain[i] * 4; // dB boost
      formantFilters.push(filter);
      
      const fGain = this.audioContext.createGain();
      fGain.gain.value = initialFormants.gain[i];
      formantGains.push(fGain);
    }
    
    // === VIBRATO LFO ===
    const vibratoLFO = this.audioContext.createOscillator();
    vibratoLFO.type = 'sine';
    vibratoLFO.frequency.value = 5.5; // ~5.5 Hz natural vibrato rate
    
    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.value = 0; // Start with no vibrato
    
    vibratoLFO.connect(vibratoGain);
    // Connect vibrato to all main oscillator frequencies
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);
    vibratoGain.connect(osc4.frequency);
    
    // === TREMOLO LFO for brightness ===
    const tremoloLFO = this.audioContext.createOscillator();
    tremoloLFO.type = 'sine';
    tremoloLFO.frequency.value = 4; // Slower than vibrato
    
    const tremoloGain = this.audioContext.createGain();
    tremoloGain.gain.value = 0; // Start with no tremolo
    
    tremoloLFO.connect(tremoloGain);
    
    // === MASTER FILTER (low-pass for overall brightness) ===
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000 * this.synestheticParams.filterBrightness;
    filter.Q.value = 1 + this.synestheticParams.harmonicDensity * 3;
    
    // === ROUTING ===
    // Oscillators → Formant chain → Master filter → Voice gain → Panner → Master
    const oscillatorMix = this.audioContext.createGain();
    oscillatorMix.gain.value = 1;
    gains.forEach(g => g.connect(oscillatorMix));
    
    // Route through formant filters in parallel, then sum
    const formantMix = this.audioContext.createGain();
    formantMix.gain.value = 0.7;
    
    formantFilters.forEach((ff, i) => {
      oscillatorMix.connect(ff);
      ff.connect(formantGains[i]);
      formantGains[i].connect(formantMix);
    });
    
    // Also add some dry signal for naturalness
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.3;
    oscillatorMix.connect(dryGain);
    dryGain.connect(filter);
    formantMix.connect(filter);
    
    // Connect tremolo to filter frequency for subtle brightness modulation
    tremoloGain.connect(filter.frequency);
    
    // Voice master gain
    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.value = 0;
    
    // Stereo panner
    const panner = this.audioContext.createStereoPanner();
    panner.pan.value = (x - 0.5) * 2;
    
    filter.connect(voiceGain);
    voiceGain.connect(panner);
    panner.connect(this.masterGain);
    
    // Start oscillators and LFOs
    oscillators.forEach(osc => osc.start());
    vibratoLFO.start();
    tremoloLFO.start();
    
    // Smooth attack
    voiceGain.gain.setTargetAtTime(0.25, this.audioContext.currentTime, RHYTHM.ATTACK);
    
    const voice: Voice = {
      id: touchId,
      oscillators,
      gains,
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
      intensity: 0.3, // Start neutral
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
    const velocityBoost = Math.min(voice.velocity * 0.5, 0.3);
    const newIntensity = Math.max(0, Math.min(1, yIntensity * 0.7 + velocityBoost + 0.15));
    
    // Smoothly update intensity
    voice.intensity = voice.intensity + (newIntensity - voice.intensity) * 0.15;
    
    // Update formants based on intensity (vowel morphing)
    this.updateFormants(voice);
    
    // Update vibrato based on intensity
    this.updateVibrato(voice);

    const applyMapping = (param: string, value: number) => {
      switch (param) {
        case 'frequency':
          const baseFreq = this.synestheticParams.frequency;
          const freqMultiplier = 0.5 + value * 1.5; // 0.5x to 2x
          const freq = baseFreq * freqMultiplier;
          
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

  // Update formant filters for vowel morphing
  private updateFormants(voice: Voice): void {
    if (!this.audioContext || !voice.formantFilters || !voice.formantGains) return;
    
    const formants = this.getVowelFormants(voice.intensity);
    const time = this.audioContext.currentTime;
    
    voice.formantFilters.forEach((filter, i) => {
      filter.frequency.setTargetAtTime(formants.f[i], time, RHYTHM.MEDIUM);
      filter.Q.setTargetAtTime(formants.q[i], time, RHYTHM.MEDIUM);
      filter.gain.setTargetAtTime(8 + formants.gain[i] * 6, time, RHYTHM.MEDIUM);
    });
    
    voice.formantGains.forEach((gain, i) => {
      gain.gain.setTargetAtTime(formants.gain[i], time, RHYTHM.MEDIUM);
    });
  }

  // Update vibrato based on intensity
  private updateVibrato(voice: Voice): void {
    if (!this.audioContext || !voice.vibratoGain || !voice.tremoloGain) return;
    
    const time = this.audioContext.currentTime;
    const baseFreq = this.synestheticParams.frequency;
    
    // Vibrato depth: 0 at low intensity, up to ~6 cents at high intensity
    const vibratoDepth = voice.intensity * voice.intensity * baseFreq * 0.004;
    voice.vibratoGain.gain.setTargetAtTime(vibratoDepth, time, RHYTHM.MEDIUM);
    
    // Tremolo: subtle brightness modulation
    const tremoloDepth = voice.intensity * 200; // Filter frequency modulation
    voice.tremoloGain.gain.setTargetAtTime(tremoloDepth, time, RHYTHM.MEDIUM);
    
    // Slightly increase vibrato rate with intensity
    if (voice.vibratoLFO) {
      const vibratoRate = 4.5 + voice.intensity * 2; // 4.5-6.5 Hz
      voice.vibratoLFO.frequency.setTargetAtTime(vibratoRate, time, RHYTHM.SLOW);
    }
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

  // Private: Apply flow mode emergent behaviors
  private applyFlowBehaviors(voice: Voice): void {
    if (!this.audioContext || !voice.isActive) return;

    const velocity = voice.velocity;
    const time = this.audioContext.currentTime;
    
    // Velocity affects intensity for vowel morphing
    const velocityIntensity = Math.min(velocity * 2, 1);
    voice.intensity = voice.intensity + (velocityIntensity - voice.intensity) * 0.1;
    
    // Slow movement → darker, calmer vowel
    if (velocity < 0.1) {
      voice.filter.Q.setTargetAtTime(1.5, time, 0.5);
      // Reduce vibrato for stillness
      if (voice.vibratoGain) {
        voice.vibratoGain.gain.setTargetAtTime(0, time, 0.3);
      }
    }
    // Fast movement → brighter, more open vowel with vibrato
    else if (velocity > 0.4) {
      const boost = 1 + velocity;
      // Increase formant gains for more presence
      if (voice.formantGains) {
        voice.formantGains.forEach((gain, i) => {
          const baseGain = [1, 0.7, 0.4][i] || 0.5;
          gain.gain.setTargetAtTime(baseGain * boost, time, RHYTHM.FAST);
        });
      }
    }
    
    // Velocity affects filter brightness
    const filterFreq = 600 + velocity * 3500 * this.synestheticParams.filterBrightness;
    voice.filter.frequency.setTargetAtTime(
      Math.min(filterFreq, 8000),
      time,
      RHYTHM.FAST
    );
    
    // Update formants and vibrato based on new intensity
    this.updateFormants(voice);
    this.updateVibrato(voice);
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

  // Check if initialized
  get initialized(): boolean {
    return this.isInitialized;
  }

  // Suspend audio context
  suspend(): void {
    this.audioContext?.suspend();
  }

  // Resume audio context
  resume(): void {
    this.audioContext?.resume();
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