// SØNA Pad v2 - Voice Management System
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
}

class VoiceManagerClass {
  private voices: Map<number, ManagedVoice> = new Map();
  private audioContext: AudioContext | null = null;

  setAudioContext(ctx: AudioContext | null): void {
    this.audioContext = ctx;
  }

  addVoice(voiceId: number, voiceObject: ManagedVoice): void {
    // Enforce maximum 9 voices - remove oldest if at limit
    if (this.voices.size >= MAX_VOICES) {
      this.removeOldestVoice();
    }
    
    this.voices.set(voiceId, voiceObject);
  }

  updateVoice(voiceId: number, params: Partial<ManagedVoice>): void {
    const voice = this.voices.get(voiceId);
    if (voice) {
      Object.assign(voice, params);
    }
  }

  getVoice(voiceId: number): ManagedVoice | undefined {
    return this.voices.get(voiceId);
  }

  removeVoice(voiceId: number): void {
    const voice = this.voices.get(voiceId);
    if (!voice) return;

    this.fadeOutAndCleanup(voice);
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
    this.voices.forEach((voice, id) => {
      this.fadeOutAndCleanup(voice, true);
    });
    this.voices.clear();
  }

  private fadeOutAndCleanup(voice: ManagedVoice, fast: boolean = false): void {
    if (!this.audioContext) {
      // Force immediate cleanup without audio context
      this.forceDisconnect(voice);
      return;
    }

    const fadeTime = fast ? 0.02 : RHYTHM.RELEASE;
    const currentTime = this.audioContext.currentTime;

    try {
      // Quick fade out to avoid clicks
      voice.masterGain.gain.cancelScheduledValues(currentTime);
      voice.masterGain.gain.setValueAtTime(voice.masterGain.gain.value, currentTime);
      voice.masterGain.gain.linearRampToValueAtTime(0, currentTime + fadeTime);

      // Stop and disconnect after fade
      setTimeout(() => {
        this.forceDisconnect(voice);
      }, fadeTime * 1000 + 50);
    } catch (e) {
      // If audio scheduling fails, force disconnect
      this.forceDisconnect(voice);
    }
  }

  private forceDisconnect(voice: ManagedVoice): void {
    voice.isActive = false;
    
    voice.oscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
      try { osc.disconnect(); } catch (e) {}
    });

    voice.gains.forEach(g => {
      try { g.disconnect(); } catch (e) {}
    });

    try { voice.filter.disconnect(); } catch (e) {}
    try { voice.masterGain.disconnect(); } catch (e) {}
    try { voice.panner.disconnect(); } catch (e) {}
  }

  getActiveVoiceCount(): number {
    return Array.from(this.voices.values()).filter(v => v.isActive).length;
  }

  getAllVoiceIds(): number[] {
    return Array.from(this.voices.keys());
  }

  hasVoice(voiceId: number): boolean {
    return this.voices.has(voiceId);
  }
}

// Global singleton instance
export const VoiceManager = new VoiceManagerClass();
