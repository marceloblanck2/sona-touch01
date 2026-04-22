// SØNA Touch 01 - Voice Management System
// Centralized control for all active voices

import { MAX_VOICES, RHYTHM } from '../utils/constants';

// Limite efetivo por device. Android tablet/mobile não aguenta bem 10 vozes
// com o synth vocal completo (17 nodes de áudio por voz).
// Desktop mantém MAX_VOICES do constants.ts; mobile reduz para 6.
const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const EFFECTIVE_MAX_VOICES = isMobileDevice() ? 6 : MAX_VOICES;

// Release mínimo para o fade "rápido" (usado em stealing e cleanup agressivo).
// Valor anterior 0.01s era curto demais e gerava clicks audíveis.
// 40ms é o mínimo prático para fade sem clique audível.
const FAST_RELEASE_MIN = 0.04;

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
  intensity: number;
  currentFrequency: number;
  currentAmplitude: number;
}

class VoiceManagerClass {
  private voices: Map<number, ManagedVoice> = new Map();
  private audioContext: AudioContext | null = null;
  private pendingCleanups: Map<number, number> = new Map();

  setAudioContext(ctx: AudioContext | null): void {
    this.audioContext = ctx;
  }

  addVoice(voiceId: number, voiceObject: ManagedVoice): void {
    if (this.voices.has(voiceId)) {
      this.removeVoice(voiceId);
    }

    // Usa o limite efetivo (mobile: 6, desktop: 10).
    if (this.voices.size >= EFFECTIVE_MAX_VOICES) {
      this.removeOldestVoice();
    }

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

    const pendingCleanup = this.pendingCleanups.get(voiceId);
    if (pendingCleanup) {
      clearTimeout(pendingCleanup);
      this.pendingCleanups.delete(voiceId);
    }

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
    this.pendingCleanups.forEach(timer => clearTimeout(timer));
    this.pendingCleanups.clear();

    // Em vez de forceDisconnect imediato (que gera clique), usa fade curto.
    // Só força desconexão se não houver audioContext (edge case).
    this.voices.forEach((voice, id) => {
      if (voice.releaseTimers) {
        voice.releaseTimers.forEach(timer => clearTimeout(timer));
      }
      if (this.audioContext) {
        this.fadeOutAndCleanup(voice, id, true);
      } else {
        this.forceDisconnect(voice);
      }
    });
    this.voices.clear();
  }

  private fadeOutAndCleanup(voice: ManagedVoice, voiceId: number, fast: boolean = false): void {
    if (!this.audioContext) {
      this.forceDisconnect(voice);
      return;
    }

    // Mesmo o fade "rápido" tem mínimo de 40ms para evitar clicks audíveis.
    const fadeTime = fast ? FAST_RELEASE_MIN : RHYTHM.RELEASE;
    const currentTime = this.audioContext.currentTime;

    try {
      voice.isActive = false;

      voice.masterGain.gain.cancelScheduledValues(currentTime);
      voice.masterGain.gain.setValueAtTime(voice.masterGain.gain.value, currentTime);
      voice.masterGain.gain.linearRampToValueAtTime(0, currentTime + fadeTime);

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

    voice.oscillators.forEach(osc => {
      try { osc.stop(0); } catch (e) {}
      try { osc.disconnect(); } catch (e) {}
    });

    if (voice.vibratoLFO) {
      try { voice.vibratoLFO.stop(0); } catch (e) {}
      try { voice.vibratoLFO.disconnect(); } catch (e) {}
    }
    if (voice.tremoloLFO) {
      try { voice.tremoloLFO.stop(0); } catch (e) {}
      try { voice.tremoloLFO.disconnect(); } catch (e) {}
    }

    voice.gains.forEach(g => {
      try { g.disconnect(); } catch (e) {}
    });

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

    try { voice.filter.disconnect(); } catch (e) {}
    try {
      voice.masterGain.gain.cancelScheduledValues(0);
      voice.masterGain.gain.value = 0;
      voice.masterGain.disconnect();
    } catch (e) {}
    try { voice.panner.disconnect(); } catch (e) {}

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

  hasActiveVoices(): boolean {
    return this.voices.size > 0;
  }

  // Exposto pra diagnóstico / DebugOverlay.
  getEffectiveMaxVoices(): number {
    return EFFECTIVE_MAX_VOICES;
  }
}

export const VoiceManager = new VoiceManagerClass();
