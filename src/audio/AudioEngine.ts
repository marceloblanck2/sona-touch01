// SØNA Pad v2 - Core Audio Engine
// 432 Hz base, additive synthesis, per-voice control

import { 
  PHI, 
  BASE_FREQUENCY, 
  MAX_VOICES, 
  RHYTHM, 
  PHI_HARMONICS,
  ZONE_BEHAVIORS 
} from '../utils/constants';
import { SynestheticParams } from '../utils/colorUtils';

export interface Voice {
  id: number;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  masterGain: GainNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  isActive: boolean;
  x: number;
  y: number;
  zone: number;
  velocity: number;
  lastUpdate: number;
}

export interface AudioMappings {
  x: 'none' | 'frequency' | 'filter' | 'harmonics' | 'amplitude' | 'pan';
  y: 'none' | 'frequency' | 'filter' | 'harmonics' | 'amplitude' | 'pan';
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices: Map<number, Voice> = new Map();
  private synestheticParams: SynestheticParams = {
    frequency: BASE_FREQUENCY,
    harmonicDensity: 0.5,
    filterBrightness: 0.5,
    warmth: 0.5,
  };
  private mappings: AudioMappings = { x: 'frequency', y: 'filter' };
  private gridMode: 'grid' | 'flow' = 'grid';
  private isInitialized = false;

  // Initialize audio context (must be called after user interaction)
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.audioContext = new AudioContext();
    
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
    this.voices.forEach(voice => {
      if (voice.isActive) {
        this.updateVoiceFromParams(voice);
      }
    });
  }

  // Set XY mappings
  setMappings(mappings: AudioMappings): void {
    this.mappings = mappings;
  }

  // Set grid/flow mode
  setGridMode(mode: 'grid' | 'flow'): void {
    this.gridMode = mode;
  }

  // Create a new voice for a touch point
  createVoice(touchId: number, x: number, y: number): Voice | null {
    if (!this.audioContext || !this.masterGain) return null;
    if (this.voices.size >= MAX_VOICES) return null;

    const zone = this.calculateZone(x, y);
    const harmonicCount = ZONE_BEHAVIORS.HARMONIC_DENSITY[zone] || 3;
    
    // Create oscillators for additive synthesis
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    
    for (let i = 0; i < harmonicCount; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      // Use PHI harmonics for natural sound
      const harmonic = PHI_HARMONICS[i % PHI_HARMONICS.length];
      osc.frequency.value = this.synestheticParams.frequency * harmonic;
      osc.type = 'sine';
      
      // Decreasing amplitude for higher harmonics
      gain.gain.value = 1 / (i + 1) / harmonicCount;
      
      osc.connect(gain);
      oscillators.push(osc);
      gains.push(gain);
    }
    
    // Filter
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000 * this.synestheticParams.filterBrightness;
    filter.Q.value = 1 + this.synestheticParams.harmonicDensity * 5;
    
    // Master gain for this voice
    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.value = 0;
    
    // Stereo panner
    const panner = this.audioContext.createStereoPanner();
    panner.pan.value = (x - 0.5) * 2; // -1 to 1
    
    // Connect: oscillators → gains → filter → voiceGain → panner → master
    gains.forEach(g => g.connect(filter));
    filter.connect(voiceGain);
    voiceGain.connect(panner);
    panner.connect(this.masterGain);
    
    // Start oscillators
    oscillators.forEach(osc => osc.start());
    
    // Smooth attack
    voiceGain.gain.setTargetAtTime(0.3, this.audioContext.currentTime, RHYTHM.ATTACK);
    
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
    };
    
    this.voices.set(touchId, voice);
    this.updateVoiceFromXY(voice, x, y);
    
    return voice;
  }

  // Update voice based on XY position
  updateVoice(touchId: number, x: number, y: number): void {
    const voice = this.voices.get(touchId);
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
    voice.x = x;
    voice.y = y;
    voice.zone = newZone;
    voice.lastUpdate = now;
    
    this.updateVoiceFromXY(voice, x, y);
  }

  // Release a voice
  releaseVoice(touchId: number): void {
    const voice = this.voices.get(touchId);
    if (!voice || !this.audioContext) return;

    voice.isActive = false;
    
    // Smooth release
    const releaseTime = this.audioContext.currentTime + RHYTHM.RELEASE;
    voice.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, RHYTHM.RELEASE);
    
    // Cleanup after release
    setTimeout(() => {
      voice.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (e) {}
      });
      voice.gains.forEach(g => g.disconnect());
      voice.filter.disconnect();
      voice.masterGain.disconnect();
      voice.panner.disconnect();
      this.voices.delete(touchId);
    }, RHYTHM.RELEASE * 3 * 1000);
  }

  // Private: Update voice from XY position based on mappings
  private updateVoiceFromXY(voice: Voice, x: number, y: number): void {
    if (!this.audioContext) return;

    const applyMapping = (param: string, value: number) => {
      switch (param) {
        case 'frequency':
          const freqMultiplier = 0.5 + value * 1.5; // 0.5x to 2x
          voice.oscillators.forEach((osc, i) => {
            const harmonic = PHI_HARMONICS[i % PHI_HARMONICS.length];
            osc.frequency.setTargetAtTime(
              this.synestheticParams.frequency * harmonic * freqMultiplier,
              this.audioContext!.currentTime,
              RHYTHM.FAST
            );
          });
          break;
          
        case 'filter':
          const filterFreq = 200 + value * 8000 * this.synestheticParams.filterBrightness;
          voice.filter.frequency.setTargetAtTime(
            filterFreq,
            this.audioContext!.currentTime,
            RHYTHM.FAST
          );
          break;
          
        case 'harmonics':
          voice.gains.forEach((gain, i) => {
            const baseLevel = 1 / (i + 1) / voice.gains.length;
            const harmonicBoost = value * 2;
            gain.gain.setTargetAtTime(
              baseLevel * (1 + harmonicBoost * (i > 0 ? 1 : 0)),
              this.audioContext!.currentTime,
              RHYTHM.MEDIUM
            );
          });
          break;
          
        case 'amplitude':
          voice.masterGain.gain.setTargetAtTime(
            value * 0.5,
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
    if (this.mappings.y !== 'none') applyMapping(this.mappings.y, 1 - y); // Invert Y
  }

  // Private: Update voice from synesthetic parameters
  private updateVoiceFromParams(voice: Voice): void {
    if (!this.audioContext) return;

    // Update base frequencies
    voice.oscillators.forEach((osc, i) => {
      const harmonic = PHI_HARMONICS[i % PHI_HARMONICS.length];
      osc.frequency.setTargetAtTime(
        this.synestheticParams.frequency * harmonic,
        this.audioContext!.currentTime,
        RHYTHM.MEDIUM
      );
    });

    // Update filter based on brightness and warmth
    const brightness = this.synestheticParams.filterBrightness;
    const warmth = this.synestheticParams.warmth;
    voice.filter.frequency.setTargetAtTime(
      500 + brightness * 6000,
      this.audioContext!.currentTime,
      RHYTHM.MEDIUM
    );
    voice.filter.Q.setTargetAtTime(
      0.5 + warmth * 4,
      this.audioContext!.currentTime,
      RHYTHM.MEDIUM
    );
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
    if (!this.audioContext) return;

    const harmonicDensity = ZONE_BEHAVIORS.HARMONIC_DENSITY[newZone] / 9;
    const modulationSpeed = ZONE_BEHAVIORS.MODULATION_SPEED[newZone];
    
    // Adjust harmonic levels based on zone
    voice.gains.forEach((gain, i) => {
      const baseLevel = 1 / (i + 1) / voice.gains.length;
      const zoneBoost = harmonicDensity * (i > 0 ? 2 : 1);
      gain.gain.setTargetAtTime(
        baseLevel * (1 + zoneBoost),
        this.audioContext!.currentTime,
        modulationSpeed
      );
    });
  }

  // Private: Apply flow mode emergent behaviors
  private applyFlowBehaviors(voice: Voice): void {
    if (!this.audioContext) return;

    const velocity = voice.velocity;
    
    // Slow movement → drone-like smoothing
    if (velocity < 0.1) {
      voice.filter.Q.setTargetAtTime(1, this.audioContext.currentTime, 0.5);
    }
    // Fast movement → harmonic agitation
    else if (velocity > 0.6) {
      voice.gains.forEach((gain, i) => {
        if (i > 0) {
          const boost = 1 + velocity * 2;
          const baseLevel = 1 / (i + 1) / voice.gains.length;
          gain.gain.setTargetAtTime(
            baseLevel * boost,
            this.audioContext!.currentTime,
            RHYTHM.FAST
          );
        }
      });
    }
    
    // Velocity affects filter
    const filterFreq = 500 + velocity * 4000 * this.synestheticParams.filterBrightness;
    voice.filter.frequency.setTargetAtTime(
      Math.min(filterFreq, 10000),
      this.audioContext!.currentTime,
      RHYTHM.FAST
    );
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
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext?.currentTime || 0,
        0.05
      );
    }
  }

  // Get active voice count
  getActiveVoiceCount(): number {
    return Array.from(this.voices.values()).filter(v => v.isActive).length;
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
    this.voices.forEach((_, id) => this.releaseVoice(id));
    this.audioContext?.close();
    this.isInitialized = false;
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
