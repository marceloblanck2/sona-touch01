// SØNA Touch 01 - Voice Management System
// Centralized control for all active voices

import { MAX_VOICES, RHYTHM } from '../utils/constants';

export interface ManagedVoice {
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
  createdAt: number;
  releaseTimers: number[];
  // Vocal synthesis additions
  formantFilters?: BiquadFilterNode[];
  formantGains?: GainNode[];
  vibratoLFO?: OscillatorNode;
  vibratoGain?: GainNode;
  tremoloLFO?: OscillatorNode;
  tremoloGain?: GainNode;
  intensity: number; // 0-1 for vowel morphing
}

class VoiceManagerClass {
  private voices: Map<number, ManagedVoice> = new Map();
  private audioContext: AudioContext | null = null;
  private pendingCleanups: Map<number, number> = new Map(); // Track cleanup timeouts

  setAudioContext(ctx: AudioContext | null): void {
    this.audioContext = ctx;
  }

  addVoice(voiceId: number, voiceObject: ManagedVoice): void {
    // If voice already exists, remove it first to prevent duplicates
    if (this.voices.has(voiceId)) {
      this.removeVoice(voiceId);
    }
    
    // Enforce maximum 9 voices - remove oldest if at limit
    if (this.voices.size >= MAX_VOICES) {
      this.removeOldestVoice();
    }
    
    // Initialize release timers array
    voiceObject.releaseTimers = [];
    this.voices.set(voiceId, voiceObject);
  }

  updateVoice(voiceId: number, params: Partial<ManagedVoice>): void {
    const voice = this.voices.get(voiceId);
    if (voice && voice.isActive) {
      Object.assign(voice, params);
    }
  }

  getVoice(voiceId: number): ManagedVoice | undefined {
    return this.voices.get(voiceId);
  }

  removeVoice(voiceId: number): void {
    const voice = this.voices.get(voiceId);
    if (!voice) return;

    // Cancel any pending cleanup for this voice
    const pendingCleanup = this.pendingCleanups.get(voiceId);
    if (pendingCleanup) {
      clearTimeout(pendingCleanup);
      this.pendingCleanups.delete(voiceId);
    }

    // Clear any release timers
    if (voice.releaseTimers) {
      voice.releaseTimers.forEach(timer => clearTimeout(timer));
      voice.releaseTimers = [];
    }

    this.fadeOutAndCleanup(voice, voiceId);
    this.voices.delete(voiceId);
  }

  removeOldestVoice(): void {
    if (this.voices.size === 0) return;

    let oldestId: number | null = null;
    let oldestTime = Infinity;

    this.voices.forEach((voice, id) => {
      if (voice.createdAt < oldestTime) {
        oldestTime = voice.createdAt;
        oldestId = id;
      }
    });

    if (oldestId !== null) {
      this.removeVoice(oldestId);
    }
  }

  removeAllVoices(): void {
    // Cancel all pending cleanups first
    this.pendingCleanups.forEach(timer => clearTimeout(timer));
    this.pendingCleanups.clear();

    // Immediately force disconnect all voices (no fade for STOP)
    this.voices.forEach((voice, id) => {
      // Clear release timers
      if (voice.releaseTimers) {
        voice.releaseTimers.forEach(timer => clearTimeout(timer));
      }
      this.forceDisconnect(voice);
    });
    this.voices.clear();
  }

  private fadeOutAndCleanup(voice: ManagedVoice, voiceId: number, fast: boolean = false): void {
    if (!this.audioContext) {
      this.forceDisconnect(voice);
      return;
    }

    const fadeTime = fast ? 0.01 : RHYTHM.RELEASE;
    const currentTime = this.audioContext.currentTime;

    try {
      // Mark as inactive immediately to prevent updates
      voice.isActive = false;
      
      // Quick fade out to avoid clicks
      voice.masterGain.gain.cancelScheduledValues(currentTime);
      voice.masterGain.gain.setValueAtTime(voice.masterGain.gain.value, currentTime);
      voice.masterGain.gain.linearRampToValueAtTime(0, currentTime + fadeTime);

      // Schedule disconnect after fade
      const cleanupTimer = window.setTimeout(() => {
        this.forceDisconnect(voice);
        this.pendingCleanups.delete(voiceId);
      }, fadeTime * 1000 + 20);
      
      this.pendingCleanups.set(voiceId, cleanupTimer);
    } catch (e) {
      this.forceDisconnect(voice);
    }
  }

  private forceDisconnect(voice: ManagedVoice): void {
    voice.isActive = false;
    
    // Stop and disconnect all oscillators
    voice.oscillators.forEach(osc => {
      try { osc.stop(0); } catch (e) {}
      try { osc.disconnect(); } catch (e) {}
    });

    // Stop vibrato and tremolo LFOs
    if (voice.vibratoLFO) {
      try { voice.vibratoLFO.stop(0); } catch (e) {}
      try { voice.vibratoLFO.disconnect(); } catch (e) {}
    }
    if (voice.tremoloLFO) {
      try { voice.tremoloLFO.stop(0); } catch (e) {}
      try { voice.tremoloLFO.disconnect(); } catch (e) {}
    }

    // Disconnect all gain nodes
    voice.gains.forEach(g => {
      try { g.disconnect(); } catch (e) {}
    });

    // Disconnect formant filters and gains
    if (voice.formantFilters) {
      voice.formantFilters.forEach(f => {
        try { f.disconnect(); } catch (e) {}
      });
    }
    if (voice.formantGains) {
      voice.formantGains.forEach(g => {
        try { g.disconnect(); } catch (e) {}
      });
    }
    if (voice.vibratoGain) {
      try { voice.vibratoGain.disconnect(); } catch (e) {}
    }
    if (voice.tremoloGain) {
      try { voice.tremoloGain.disconnect(); } catch (e) {}
    }

    // Disconnect filter, master gain, and panner
    try { voice.filter.disconnect(); } catch (e) {}
    try { 
      voice.masterGain.gain.cancelScheduledValues(0);
      voice.masterGain.gain.value = 0;
      voice.masterGain.disconnect(); 
    } catch (e) {}
    try { voice.panner.disconnect(); } catch (e) {}

    // Clear arrays
    voice.oscillators = [];
    voice.gains = [];
    voice.formantFilters = [];
    voice.formantGains = [];
  }

  getActiveVoiceCount(): number {
    return this.voices.size;
  }

  getAllVoiceIds(): number[] {
    return Array.from(this.voices.keys());
  }

  hasVoice(voiceId: number): boolean {
    return this.voices.has(voiceId);
  }

  // Check if any voices are truly playing
  hasActiveVoices(): boolean {
    return this.voices.size > 0;
  }
}

// Global singleton instance
export const VoiceManager = new VoiceManagerClass();