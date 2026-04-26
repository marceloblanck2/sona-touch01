// SØNA Touch 01 — Tuning System
// Base: A4 = 432 Hz (MIDI 69)
// All frequency conversions go through here.

import { TonalNote } from './SCALES';

export const A4_MIDI = 69;
export const A4_FREQ = 432; // Hz

/**
 * Convert MIDI note number to frequency at 432 Hz tuning.
 */
export function midiToFreq432(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export interface ScaleNote {
  freq: number;
  weight: number;
  role: TonalNote['role'];
}

/**
 * Build a sorted array of frequencies from a scale definition,
 * spanning multiple octaves starting from rootMidi.
 * Only includes notes within [minFreq, maxFreq] — keeps GRAVITY clean.
 */
export function buildScaleFrequencies(
  rootMidi: number,
  scale: TonalNote[],
  octaves: number,
  minFreq = 0,
  maxFreq = Infinity
): ScaleNote[] {
  const notes: ScaleNote[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    for (const note of scale) {
      const midi = rootMidi + note.interval + oct * 12;
      const freq = midiToFreq432(midi);

      if (freq >= minFreq && freq <= maxFreq) {
        notes.push({ freq, weight: note.weight, role: note.role });
      }
    }
  }

  return notes.sort((a, b) => a.freq - b.freq);
}
