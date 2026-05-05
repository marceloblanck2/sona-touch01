// SØNA Touch 01 - Core Audio Engine
// 432 Hz base, vocal synthesis with formants, per-voice control
// ResolvedState integration: single source of truth per touch.

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
import { SCALES } from './scales/SCALES';
import { buildScaleFrequencies, ScaleNote } from './scales/TUNING';
import { resolveNote, applyVelocityModulation } from './scales/GRAVITY';
import { TonalField, MUSICAL_PRESETS } from './scales/MUSICAL_PRESETS';
import {
  ResolvedState,
  buildResolvedState,
  RESTING,
} from './scales/RESOLVED_STATE';

// Re-export types for compatibility
export type Voice = ManagedVoice;
export type { ResolvedState };

export interface AudioMappings {
  x: 'none' | 'frequency' | 'filter' | 'harmonics' | 'amplitude' | 'pan';
  y: 'none' | 'frequency' | 'filter' | 'harmonics' | 'amplitude' | 'pan';
}

// Formant frequencies for vowel sounds (Hz)
const VOWEL_FORMANTS = {
  O: { f: [380, 750, 2400], q: [6, 5, 4], gain: [1, 0.35, 0.15] },
  U: { f: [320, 680, 2300], q: [7, 5, 4], gain: [1, 0.3, 0.12] },
  A: { f: [650, 1100, 2450], q: [5, 4, 3.5], gain: [1, 0.45, 0.2] },
  E: { f: [480, 1600, 2400], q: [5, 4, 3], gain: [1, 0.5, 0.22] },
  I: { f: [350, 1900, 2600], q: [5.5, 4, 3], gain: [1, 0.55, 0.25] },
};

const FORMANT_GAIN_BASE_DB = 2;
const FORMANT_GAIN_RANGE_DB = 4;
const VOICE_PEAK_GAIN = 0.22;

const easeIntensity = (t: number): number => {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
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

  // Tonal field
  private tonalField: TonalField | null = null;
  private scaleNotes: ScaleNote[] = [];

  // ResolvedState — single source of truth per touch
  private resolvedStates: Map<number, ResolvedState> = new Map();
  private lastMoveTimestamps: Map<number, number> = new Map();

  initialize(): void {
    if (this.isInitialized) {
      if (
        this.audioContext &&
        (this.audioContext.state === 'suspended' ||
          this.audioContext.state === 'interrupted')
      ) {
        this.audioContext.resume().catch((e) =>
          console.warn('[AudioEngine] resume on re-init failed:', String(e))
        );
      }
      return;
    }

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      console.error('[AudioEngine] Web Audio API not supported');
      return;
    }

    this.audioContext = new AudioContextClass();

    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.01);
      console.log('[AudioEngine] silent unlock fired');
    } catch (e) {
      console.warn('[AudioEngine] silent unlock failed:', String(e));
    }

    VoiceManager.setAudioContext(this.audioContext);

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.setValueAtTime(0.5, this.audioContext.currentTime);

    this.masterLimiter = this.audioContext.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-6, this.audioContext.currentTime);
    this.masterLimiter.knee.setValueAtTime(6, this.audioContext.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20, this.audioContext.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.masterLimiter.release.setValueAtTime(0.1, this.audioContext.currentTime);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    if (
      this.audioContext.state === 'suspended' ||
      this.audioContext.state === 'interrupted'
    ) {
      this.audioContext.resume().catch((e) =>
        console.warn('[AudioEngine] resume rejected:', String(e))
      );
    }

    this.isInitialized = true;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  setSynestheticParams(params: SynestheticParams): void {
    this.synestheticParams = params;
    VoiceManager.getAllVoiceIds().forEach(id => {
      const voice = VoiceManager.getVoice(id);
      if (voice && voice.isActive) {
        this.updateVoiceFromParams(voice);
      }
    });
  }

  setMappings(mappings: AudioMappings): void {
    this.mappings = mappings;
  }

  setTonalField(field: TonalField | null): void {
    this.tonalField = field;

    // Tonal field changed: previous resolved notes/colors are no longer valid.
    this.resolvedStates.clear();
    this.lastMoveTimestamps.clear();

    if (!field || field.scaleKey === 'chromatic') {
      this.scaleNotes = [];
      return;
    }

    const scaleDef = SCALES[field.scaleKey];
    if (!scaleDef) {
      this.scaleNotes = [];
      return;
    }

    const minFreq = BASE_FREQUENCY * 0.25;
    const maxFreq = BASE_FREQUENCY * 4.0;
    this.scaleNotes = buildScaleFrequencies(field.rootMidi, scaleDef, field.octaves, minFreq, maxFreq);
  }

  getTonalPresets(): TonalField[] {
    return MUSICAL_PRESETS;
  }

  getCurrentTonalField(): TonalField | null {
    return this.tonalField;
  }

  getHueRange(): [number, number] {
    if (!this.tonalField) return [0, 270];
    return [this.tonalField.hueStart, this.tonalField.hueEnd];
  }

  getNoteMarkers(): Array<{ position: number; role: string; weight: number }> {
    if (this.scaleNotes.length === 0) return [];
    const total = this.scaleNotes.length - 1;
    return this.scaleNotes.map((note, i) => ({
      position: total > 0 ? i / total : 0,
      role: note.role,
      weight: note.weight,
    }));
  }

  // ============================================================================
  // RESOLVED STATE — single source of truth per touch
  // ============================================================================

  /**
   * Get current ResolvedState for a specific touch.
   */
  getResolvedState(touchId: number): ResolvedState | null {
    return this.resolvedStates.get(touchId) ?? null;
  }

  /**
   * Get a snapshot of all current ResolvedStates.
   */
  getAllResolvedStates(): Map<number, ResolvedState> {
    return new Map(this.resolvedStates);
  }

  /**
   * Compute and store ResolvedState for a touch.
   * Called from createVoice and updateVoice — keeps state in sync with audio.
   * Returns null if no tonal field is active (chromatic mode has no resolved note).
   */
  private updateResolvedState(
    touchId: number,
    x: number,
    y: number,
    velocity: number
  ): ResolvedState | null {
    if (this.scaleNotes.length === 0 || !this.tonalField) {
      // Chromatic mode — no resolved state for now
      this.resolvedStates.delete(touchId);
      return null;
    }

    // 1. Compute raw frequency from X position via note index
    //    (matches updateVoiceFromXY frequency mapping)
    const value = x; // X is the pad axis where frequency lives by default
    const index = value * (this.scaleNotes.length - 1);
    const lo = Math.floor(index);
    const hi = Math.min(lo + 1, this.scaleNotes.length - 1);
    const t = index - lo;
    const rawFreq = this.scaleNotes[lo].freq + (this.scaleNotes[hi].freq - this.scaleNotes[lo].freq) * t;

    // 2. Resolve via gravity
    const resolved = resolveNote(rawFreq, this.scaleNotes, y);
    if (!resolved) {
      this.resolvedStates.delete(touchId);
      return null;
    }

    // 3. Compute resting duration
    // Velocity arrives from pad-space delta/time and can exceed 1. Normalize it
    // before sending it to ResolvedState and before using the resting threshold.
    const normalizedVelocity = Math.min(Math.max(velocity / 2.0, 0), 1);

    const now = performance.now();
    const lastMove = this.lastMoveTimestamps.get(touchId);
    const previousState = this.resolvedStates.get(touchId);
    const noteChanged = previousState ? previousState.midi !== resolved.midi : true;

    let restingDuration = 0;

    // Reset resting when:
    // - the touch is new;
    // - the gesture is moving;
    // - gravity resolves to a different note.
    // Without noteChanged here, glow/scale could keep accumulating after a note jump.
    if (lastMove === undefined || normalizedVelocity > RESTING.velocityThreshold || noteChanged) {
      this.lastMoveTimestamps.set(touchId, now);
      restingDuration = 0;
    } else {
      restingDuration = now - lastMove;
    }

    // 4. Compute scaleDegreeNormalized (position of resolved note within field)
    const noteIndex = this.scaleNotes.indexOf(resolved);
    const totalSpan = Math.max(this.scaleNotes.length - 1, 1);
    const scaleDegreeNormalized = noteIndex / totalSpan;

    // 5. yEnergy: Y baixo = energia alta (Y=0 top, Y=1 bottom in pad coords)
    const yEnergy = 1 - y;

    // 6. Build ResolvedState
    const state = buildResolvedState({
      note: resolved,
      velocity: normalizedVelocity,
      yEnergy,
      restingDuration,
      scaleDegreeNormalized,
      hueStart: this.tonalField.hueStart,
      hueEnd: this.tonalField.hueEnd,
    });

    this.resolvedStates.set(touchId, state);
    return state;
  }

  /**
   * Refresh dynamic ResolvedState values while touches are held still.
   * Pointer events do not fire when a finger stops moving, but restingDuration,
   * glow, scale and saturation still need to evolve. Called from the hook RAF.
   */
  refreshResolvedStates(): void {
    if (this.scaleNotes.length === 0 || !this.tonalField) return;

    VoiceManager.getAllVoiceIds().forEach((id) => {
      const voice = VoiceManager.getVoice(id);
      if (voice && voice.isActive) {
        // velocity 0 means: no new movement this frame, allow restingDuration to grow.
        this.updateResolvedState(id, voice.x, voice.y, 0);
      }
    });
  }

  // ============================================================================

  setGridMode(mode: 'grid' | 'flow'): void {
    this.stopAllSound();
    this.gridMode = mode;
  }

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

  private getVowelFormants(intensity: number): typeof VOWEL_FORMANTS.A {
    const easedIntensity = easeIntensity(intensity);

    if (easedIntensity < 0.4) {
      const t = easedIntensity / 0.4;
      const dark = this.interpolateFormants(VOWEL_FORMANTS.U, VOWEL_FORMANTS.O, 0.4);
      return this.interpolateFormants(dark, VOWEL_FORMANTS.A, t * 0.7);
    } else if (easedIntensity < 0.75) {
      const t = (easedIntensity - 0.4) / 0.35;
      return this.interpolateFormants(VOWEL_FORMANTS.A, VOWEL_FORMANTS.E, t * 0.8);
    } else {
      const t = (easedIntensity - 0.75) / 0.25;
      return this.interpolateFormants(VOWEL_FORMANTS.E, VOWEL_FORMANTS.I, t * 0.6);
    }
  }

  async createVoice(touchId: number, x: number, y: number): Promise<Voice | null> {
    if (!this.audioContext || !this.masterGain) {
      console.error('[createVoice] missing context or masterGain');
      return null;
    }

    if (
      this.audioContext.state === 'suspended' ||
      this.audioContext.state === 'interrupted'
    ) {
      this.audioContext.resume().catch((e) =>
        console.warn('[createVoice] resume failed:', String(e))
      );
    }

    if (this.activePointers.has(touchId)) {
      this.releaseVoice(touchId);
    }

    this.activePointers.add(touchId);

    const zone = this.calculateZone(x, y);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const baseFreq = this.synestheticParams.frequency;

    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = baseFreq;
    const gain1 = this.audioContext.createGain();
    gain1.gain.value = 0.45;
    osc1.connect(gain1);
    oscillators.push(osc1);
    gains.push(gain1);

    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq * 1.0017;
    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0.28;
    osc2.connect(gain2);
    oscillators.push(osc2);
    gains.push(gain2);

    const osc3 = this.audioContext.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = baseFreq * 0.5;
    const gain3 = this.audioContext.createGain();
    gain3.gain.value = 0.18;
    osc3.connect(gain3);
    oscillators.push(osc3);
    gains.push(gain3);

    const osc4 = this.audioContext.createOscillator();
    osc4.type = 'triangle';
    osc4.frequency.value = baseFreq * 0.9983;
    const gain4 = this.audioContext.createGain();
    gain4.gain.value = 0.12;
    osc4.connect(gain4);
    oscillators.push(osc4);
    gains.push(gain4);

    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 2, this.audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.7;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = 0;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    const formantFilters: BiquadFilterNode[] = [];
    const formantGains: GainNode[] = [];
    const initialFormants = this.getVowelFormants(0.25);

    for (let i = 0; i < 3; i++) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = initialFormants.f[i];
      filter.Q.value = initialFormants.q[i];
      filter.gain.value = FORMANT_GAIN_BASE_DB + initialFormants.gain[i] * FORMANT_GAIN_RANGE_DB;
      formantFilters.push(filter);

      const fGain = this.audioContext.createGain();
      fGain.gain.value = initialFormants.gain[i] * 0.85;
      formantGains.push(fGain);
    }

    const vibratoLFO = this.audioContext.createOscillator();
    vibratoLFO.type = 'sine';
    vibratoLFO.frequency.value = 5.2;

    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.value = 0;

    vibratoLFO.connect(vibratoGain);
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);
    vibratoGain.connect(osc4.frequency);

    const tremoloLFO = this.audioContext.createOscillator();
    tremoloLFO.type = 'sine';
    tremoloLFO.frequency.value = 3.2;

    const tremoloGain = this.audioContext.createGain();
    tremoloGain.gain.value = 0;

    tremoloLFO.connect(tremoloGain);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800 * this.synestheticParams.filterBrightness;
    filter.Q.value = 0.7 + this.synestheticParams.harmonicDensity * 1.5;

    const oscillatorMix = this.audioContext.createGain();
    oscillatorMix.gain.value = 1;
    gains.forEach(g => g.connect(oscillatorMix));

    const formantMix = this.audioContext.createGain();
    formantMix.gain.value = 0.55;

    formantFilters.forEach((ff, i) => {
      oscillatorMix.connect(ff);
      ff.connect(formantGains[i]);
      formantGains[i].connect(formantMix);
    });

    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.45;
    oscillatorMix.connect(dryGain);
    dryGain.connect(filter);
    formantMix.connect(filter);

    noiseGain.connect(filter);

    tremoloGain.connect(filter.frequency);

    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.setValueAtTime(0, this.audioContext.currentTime);

    const panner =
      typeof this.audioContext.createStereoPanner === 'function'
        ? this.audioContext.createStereoPanner()
        : null;

    if (panner) {
      panner.pan.setValueAtTime((x - 0.5) * 2, this.audioContext.currentTime);
    }

    filter.connect(voiceGain);

    if (panner) {
      voiceGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      voiceGain.connect(this.masterGain);
    }

    oscillators.forEach(osc => osc.start());
    noiseSource.start();
    vibratoLFO.start();
    tremoloLFO.start();
    (window as any).__lastOscStart = performance.now();

    voiceGain.gain.setTargetAtTime(VOICE_PEAK_GAIN, this.audioContext.currentTime, RHYTHM.ATTACK);

    const voice: Voice = {
      id: touchId,
      oscillators: [...oscillators, noiseSource as unknown as OscillatorNode],
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
      intensity: 0.25,
      currentFrequency: this.synestheticParams.frequency,
      currentAmplitude: 0.25,
    };

    VoiceManager.addVoice(touchId, voice);

    // Initialize resolvedState for this touch
    this.lastMoveTimestamps.set(touchId, performance.now());
    this.updateResolvedState(touchId, x, y, 0);

    this.updateVoiceFromXY(voice, x, y);

    return voice;
  }

  updateVoice(touchId: number, x: number, y: number): void {
    const voice = VoiceManager.getVoice(touchId);
    if (!voice || !voice.isActive || !this.audioContext) return;

    const now = performance.now();
    const dt = (now - voice.lastUpdate) / 1000;

    const dx = x - voice.x;
    const dy = y - voice.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    voice.velocity = dt > 0 ? distance / dt : 0;

    const newZone = this.calculateZone(x, y);
    if (this.gridMode === 'grid' && newZone !== voice.zone) {
      this.onZoneChange(voice, newZone);
    }

    if (this.gridMode === 'flow') {
      this.applyFlowBehaviors(voice);
    }

    VoiceManager.updateVoice(touchId, {
      x,
      y,
      zone: newZone,
      velocity: voice.velocity,
      lastUpdate: now,
    });

    // Update resolvedState BEFORE updateVoiceFromXY so audio reads from it
    this.updateResolvedState(touchId, x, y, voice.velocity);

    this.updateVoiceFromXY(voice, x, y);
  }

  releaseVoice(touchId: number): void {
    this.activePointers.delete(touchId);
    LoopManager.clearLoop(touchId);
    VoiceManager.removeVoice(touchId);
    this.resolvedStates.delete(touchId);
    this.lastMoveTimestamps.delete(touchId);
  }

  stopAllSound(): void {
    this.activePointers.clear();
    this.resolvedStates.clear();
    this.lastMoveTimestamps.clear();
    LoopManager.clearAllLoops();
    VoiceManager.removeAllVoices();

    if (this.masterGain && this.audioContext) {
      const currentTime = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(currentTime);
      this.masterGain.gain.setValueAtTime(0, currentTime);
      this.masterGain.gain.setValueAtTime(0.5, currentTime + 0.05);
    }

    console.log('SØNA Touch 01 — All audio stopped successfully.');
  }

  resetAudioState(): void {
    this.stopAllSound();
  }

  isPointerActive(pointerId: number): boolean {
    return this.activePointers.has(pointerId);
  }

  getState(): { ctxState: string; sampleRate: number; isInitialized: boolean } {
    return {
      ctxState: this.audioContext?.state ?? 'none',
      sampleRate: this.audioContext?.sampleRate ?? 0,
      isInitialized: this.isInitialized,
    };
  }

  private updateVoiceFromXY(voice: Voice, x: number, y: number): void {
    if (!this.audioContext || !voice.isActive) return;

    if (voice.panner) {
      voice.panner.pan.setTargetAtTime(
        (x - 0.5) * 2,
        this.audioContext.currentTime,
        RHYTHM.FAST
      );
    }

    const yIntensity = 1 - y;
    const velocityBoost = Math.min(voice.velocity * 0.35, 0.2);
    const newIntensity = Math.max(0, Math.min(1, yIntensity * 0.65 + velocityBoost + 0.1));

    voice.intensity = voice.intensity + (newIntensity - voice.intensity) * 0.08;

    voice.currentAmplitude = voice.intensity;
    if (this.mappings.x !== 'frequency' && this.mappings.y !== 'frequency') {
      voice.currentFrequency = this.synestheticParams.frequency;
    }

    this.updateFormants(voice);
    this.updateVibrato(voice);
    this.updateBreath(voice);

    const applyMapping = (param: string, value: number) => {
      switch (param) {
        case 'frequency': {
          const baseFreq = this.synestheticParams.frequency;

          // Read from resolvedState when tonal field is active (single source of truth)
          // Fallback to inline computation when chromatic
          let rawFreq: number;
          let freq: number;

          if (this.scaleNotes.length > 0) {
            const index = value * (this.scaleNotes.length - 1);
            const lo = Math.floor(index);
            const hi = Math.min(lo + 1, this.scaleNotes.length - 1);
            const t = index - lo;
            rawFreq = this.scaleNotes[lo].freq + (this.scaleNotes[hi].freq - this.scaleNotes[lo].freq) * t;

            const resolvedState = this.resolvedStates.get(voice.id);
            if (resolvedState) {
              const normVel = Math.min((voice.velocity ?? 0) / 2.0, 1);
              freq = applyVelocityModulation(rawFreq, resolvedState.frequency, normVel);
            } else {
              freq = rawFreq;
            }
          } else {
            rawFreq = baseFreq * (0.5 + value * 1.5);
            freq = rawFreq;
          }

          const glideTime = this.tonalField?.glideTime ?? RHYTHM.FAST;
          voice.currentFrequency = freq;

          if (voice.oscillators[0]) {
            voice.oscillators[0].frequency.setTargetAtTime(freq, this.audioContext!.currentTime, glideTime);
          }
          if (voice.oscillators[1]) {
            voice.oscillators[1].frequency.setTargetAtTime(freq * 1.002, this.audioContext!.currentTime, glideTime);
          }
          if (voice.oscillators[2]) {
            voice.oscillators[2].frequency.setTargetAtTime(freq * 0.5, this.audioContext!.currentTime, glideTime);
          }
          if (voice.oscillators[3]) {
            voice.oscillators[3].frequency.setTargetAtTime(freq * 0.998, this.audioContext!.currentTime, glideTime);
          }
          break;
        }

        case 'filter':
          const filterFreq = 300 + value * 6000 * this.synestheticParams.filterBrightness;
          voice.filter.frequency.setTargetAtTime(
            filterFreq,
            this.audioContext!.currentTime,
            RHYTHM.FAST
          );
          break;

        case 'harmonics':
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
            value * VOICE_PEAK_GAIN * 1.6,
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

  private updateFormants(voice: Voice): void {
    if (!this.audioContext || !voice.formantFilters || !voice.formantGains) return;

    const formants = this.getVowelFormants(voice.intensity);
    const time = this.audioContext.currentTime;
    const smoothTime = RHYTHM.SLOW;

    voice.formantFilters.forEach((filter, i) => {
      filter.frequency.setTargetAtTime(formants.f[i], time, smoothTime);
      filter.Q.setTargetAtTime(formants.q[i], time, smoothTime);
      filter.gain.setTargetAtTime(
        FORMANT_GAIN_BASE_DB + formants.gain[i] * FORMANT_GAIN_RANGE_DB,
        time,
        smoothTime
      );
    });

    voice.formantGains.forEach((gain, i) => {
      gain.gain.setTargetAtTime(formants.gain[i] * 0.85, time, smoothTime);
    });
  }

  private updateVibrato(voice: Voice): void {
    if (!this.audioContext || !voice.vibratoGain || !voice.tremoloGain) return;

    const time = this.audioContext.currentTime;
    const baseFreq = this.synestheticParams.frequency;

    const easedIntensity = easeIntensity(voice.intensity);

    const vibratoDepth = easedIntensity * easedIntensity * baseFreq * 0.0025;
    voice.vibratoGain.gain.setTargetAtTime(vibratoDepth, time, RHYTHM.SLOW);

    const tremoloDepth = easedIntensity * 80;
    voice.tremoloGain.gain.setTargetAtTime(tremoloDepth, time, RHYTHM.SLOW);

    if (voice.vibratoLFO) {
      const vibratoRate = 5.0 + easedIntensity * 0.8;
      voice.vibratoLFO.frequency.setTargetAtTime(vibratoRate, time, RHYTHM.SLOW);
    }
  }

  private updateBreath(voice: Voice): void {
    if (!this.audioContext || !voice.gains) return;

    const time = this.audioContext.currentTime;

    const noiseGain = voice.gains[voice.gains.length - 1];
    if (!noiseGain) return;

    const easedIntensity = easeIntensity(voice.intensity);

    const breathLevel = easedIntensity * easedIntensity * 0.025;
    noiseGain.gain.setTargetAtTime(breathLevel, time, RHYTHM.MEDIUM);
  }

  private updateVoiceFromParams(voice: Voice): void {
    if (!this.audioContext || !voice.isActive) return;

    const baseFreq = this.synestheticParams.frequency;

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

    this.updateFormants(voice);
    this.updateVibrato(voice);
  }

  private calculateZone(x: number, y: number): number {
    const gridSize = 3;
    const col = Math.min(Math.floor(x * gridSize), gridSize - 1);
    const row = Math.min(Math.floor(y * gridSize), gridSize - 1);
    return row * gridSize + col;
  }

  private onZoneChange(voice: Voice, newZone: number): void {
    if (!this.audioContext || !voice.isActive) return;

    const harmonicDensity = ZONE_BEHAVIORS.HARMONIC_DENSITY[newZone] / 9;
    const modulationSpeed = ZONE_BEHAVIORS.MODULATION_SPEED[newZone];

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

    voice.intensity = Math.max(0, Math.min(1, voice.intensity + (harmonicDensity - 0.5) * 0.2));
    this.updateFormants(voice);
  }

  private applyFlowBehaviors(voice: Voice): void {
    if (!this.audioContext || !voice.isActive) return;

    const velocity = voice.velocity;
    const time = this.audioContext.currentTime;

    const velocityIntensity = Math.min(velocity * 1.5, 0.85);
    voice.intensity = voice.intensity + (velocityIntensity - voice.intensity) * 0.06;

    if (velocity < 0.08) {
      voice.filter.Q.setTargetAtTime(0.8, time, 0.6);
      if (voice.vibratoGain) {
        voice.vibratoGain.gain.setTargetAtTime(0, time, 0.5);
      }
    }
    else if (velocity > 0.35) {
      const boost = 1 + velocity * 0.4;
      if (voice.formantGains) {
        voice.formantGains.forEach((gain, i) => {
          const baseGain = [0.85, 0.5, 0.25][i] || 0.4;
          gain.gain.setTargetAtTime(baseGain * boost, time, RHYTHM.MEDIUM);
        });
      }
    }

    const filterFreq = 800 + velocity * 2500 * this.synestheticParams.filterBrightness;
    voice.filter.frequency.setTargetAtTime(
      Math.min(filterFreq, 5500),
      time,
      RHYTHM.MEDIUM
    );

    this.updateFormants(voice);
    this.updateVibrato(voice);
    this.updateBreath(voice);
  }

  getWaveformData(): Float32Array {
    if (!this.analyser) return new Float32Array(0);

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext.currentTime,
        0.05
      );
    }
  }

  getActiveVoiceCount(): number {
    return VoiceManager.getActiveVoiceCount();
  }

  getVoiceColor(touchId: number): HSLColor | null {
    const voice = VoiceManager.getVoice(touchId);
    if (!voice || !voice.isActive) return null;

    // Prefer ResolvedState color if available (single source of truth)
    const resolved = this.resolvedStates.get(touchId);
    if (resolved) {
      return { h: resolved.hue, s: resolved.saturation, l: resolved.lightness };
    }

    // Fallback to legacy frequency-based color
    const [hs, he] = this.getHueRange();
    return audioToColor(voice.currentFrequency, voice.currentAmplitude, voice.intensity, hs, he);
  }

  getAverageColor(): HSLColor | null {
    const ids = VoiceManager.getAllVoiceIds();
    if (ids.length === 0) return null;

    let hueSum = 0, satSum = 0, lightSum = 0;
    let count = 0;

    ids.forEach(id => {
      const voice = VoiceManager.getVoice(id);
      if (voice && voice.isActive) {
        const resolved = this.resolvedStates.get(id);
        if (resolved) {
          hueSum += resolved.hue;
          satSum += resolved.saturation;
          lightSum += resolved.lightness;
        } else {
          const [hs2, he2] = this.getHueRange();
          const c = audioToColor(voice.currentFrequency, voice.currentAmplitude, voice.intensity, hs2, he2);
          hueSum += c.h;
          satSum += c.s;
          lightSum += c.l;
        }
        count++;
      }
    });

    if (count === 0) return null;
    return { h: Math.round(hueSum / count), s: Math.round(satSum / count), l: Math.round(lightSum / count) };
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  suspend(): void {
    this.audioContext?.suspend();
  }

  resume(): void {
    if (
      this.audioContext &&
      (this.audioContext.state === 'suspended' ||
        this.audioContext.state === 'interrupted')
    ) {
      this.audioContext.resume().catch((e) =>
        console.warn('[AudioEngine] resume failed:', String(e))
      );
    }
  }

  forceSilentUnlock(): void {
    if (!this.audioContext) return;

    try {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (e) {
      console.warn('[AudioEngine] forceSilentUnlock failed:', String(e));
    }
  }

  forceRecreateContext(): void {
    try {
      if (this.audioContext) {
        this.audioContext.close();
      }
    } catch (e) {}

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) return;

    this.audioContext = new AudioContextClass();

    try {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (e) {}

    this.masterGain = this.audioContext.createGain();

    this.masterLimiter = this.audioContext.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-6, this.audioContext.currentTime);
    this.masterLimiter.knee.setValueAtTime(6, this.audioContext.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20, this.audioContext.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.masterLimiter.release.setValueAtTime(0.1, this.audioContext.currentTime);

    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.audioContext.destination);

    VoiceManager.setAudioContext(this.audioContext);

    this.isInitialized = true;
  }

  ensureResumed(): Promise<void> {
    if (
      this.audioContext &&
      (this.audioContext.state === 'suspended' ||
        this.audioContext.state === 'interrupted')
    ) {
      this.audioContext.resume()
        .catch((e) => console.warn('[AudioEngine] ensureResumed failed:', String(e)));
    }
    return Promise.resolve();
  }

  isSuspended(): boolean {
    return this.audioContext
      ? this.audioContext.state === 'suspended' ||
          this.audioContext.state === 'interrupted'
      : false;
  }

  dispose(): void {
    this.stopAllSound();
    this.audioContext?.close();
    this.isInitialized = false;
  }
}

export const audioEngine = new AudioEngine();
