// SØNA Touch 01 — Tuning System
// Base: A4 = 432 Hz (MIDI 69)
// All frequency conversions go through here.

import { TonalNote } from './SCALES';

export const A4_MIDI = 69;
export const A4_FREQ = 432; // Hz

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert MIDI note number to frequency at 432 Hz tuning.
 */
export function midiToFreq432(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Convert MIDI note number to note name.
 */
export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

/**
 * Convert MIDI note number to standard octave.
 */
export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/**
 * Enriched ScaleNote — carries all metadata needed for ResolvedState.
 * Computed once at scale build time so resolveGesture has zero overhead.
 */
export interface ScaleNote {
  freq: number;
  weight: number;
  role: TonalNote['role'];
  midi: number;
  noteName: string;
  scaleDegree: number;  // 1-indexed position within the scale (1 = root)
  octave: number;
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
    for (let i = 0; i < scale.length; i++) {
      const note = scale[i];
      const midi = rootMidi + note.interval + oct * 12;
      const freq = midiToFreq432(midi);

      if (freq >= minFreq && freq <= maxFreq) {
        notes.push({
          freq,
          weight: note.weight,
          role: note.role,
          midi,
          noteName: midiToNoteName(midi),
          scaleDegree: i + 1,
          octave: midiToOctave(midi),
        });
      }
    }
  }

  return notes.sort((a, b) => a.freq - b.freq);
}
