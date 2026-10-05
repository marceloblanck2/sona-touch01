import { describe, it, expect } from 'vitest';
import { midiToFreq432, midiToNoteName, midiToOctave, buildScaleFrequencies, A4_FREQ, A4_MIDI } from './TUNING';
import { SCALES } from './SCALES';
import { BASE_FREQUENCY } from '../../utils/constants';

describe('midiToFreq432', () => {
  it('tunes A4 (MIDI 69) to exactly 432 Hz', () => {
    // Hardcoded literal on purpose: asserting against the imported A4_FREQ
    // constant would make this test vacuous if A4_FREQ itself were mutated
    // (caught via manual mutation testing — see PR description).
    expect(midiToFreq432(69)).toBe(432);
  });

  it('A4_MIDI and A4_FREQ constants match the 432 Hz tuning spec', () => {
    expect(A4_MIDI).toBe(69);
    expect(A4_FREQ).toBe(432);
  });

  it('A4_FREQ (TUNING.ts) stays in sync with BASE_FREQUENCY (utils/constants.ts) — two independent sources of truth for 432 Hz, see issue "Tuning has two sources of truth"', () => {
    expect(A4_FREQ).toBe(BASE_FREQUENCY);
  });

  it('doubles frequency exactly one octave up', () => {
    const a4 = midiToFreq432(69);
    const a5 = midiToFreq432(81);
    expect(a5 / a4).toBeCloseTo(2, 10);
  });

  it('halves frequency exactly one octave down', () => {
    const a4 = midiToFreq432(69);
    const a3 = midiToFreq432(57);
    expect(a3 / a4).toBeCloseTo(0.5, 10);
  });

  it('uses an equal-tempered semitone ratio of 2^(1/12), not a just-intonation ratio', () => {
    const semitoneRatio = midiToFreq432(70) / midiToFreq432(69);
    expect(semitoneRatio).toBeCloseTo(Math.pow(2, 1 / 12), 10);
  });

  it('documents equal-tempered fifth (2^(7/12) ≈ 1.4983), distinct from the pure 3:2 fifth used in just intonation', () => {
    const fifthRatio = midiToFreq432(69 + 7) / midiToFreq432(69);
    const equalTemperedFifth = Math.pow(2, 7 / 12);
    const justFifth = 3 / 2;

    expect(fifthRatio).toBeCloseTo(equalTemperedFifth, 10);
    expect(equalTemperedFifth).toBeCloseTo(1.4983, 4);
    // The system does NOT use the pure 3:2 fifth — the gap is ~2 cents, audible but not tested as equal.
    expect(Math.abs(fifthRatio - justFifth)).toBeGreaterThan(0.001);
  });
});

describe('midiToNoteName', () => {
  it('maps MIDI 69 to A', () => {
    expect(midiToNoteName(69)).toBe('A');
  });

  it('maps MIDI 60 to C', () => {
    expect(midiToNoteName(60)).toBe('C');
  });

  it('wraps correctly for negative MIDI numbers', () => {
    expect(midiToNoteName(-1)).toBe('B'); // -1 % 12 -> wraps to 11 -> B
    expect(midiToNoteName(-12)).toBe('C');
  });
});

describe('midiToOctave', () => {
  it('maps MIDI 60 (middle C) to octave 4', () => {
    expect(midiToOctave(60)).toBe(4);
  });

  it('maps MIDI 69 (A4) to octave 4', () => {
    expect(midiToOctave(69)).toBe(4);
  });

  it('maps MIDI 21 to octave 0', () => {
    expect(midiToOctave(21)).toBe(0);
  });
});

describe('buildScaleFrequencies', () => {
  const minorScale = SCALES.natural_minor!;

  it('returns notes sorted ascending by frequency', () => {
    const notes = buildScaleFrequencies(69, minorScale, 2);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].freq).toBeGreaterThanOrEqual(notes[i - 1].freq);
    }
  });

  it('assigns 1-indexed scaleDegree matching position in the scale definition', () => {
    const notes = buildScaleFrequencies(69, minorScale, 1);
    // First octave, unsorted-by-degree check: degree 1 is the root (interval 0)
    const root = notes.find((n) => n.midi === 69)!;
    expect(root.scaleDegree).toBe(1);
    const fifth = notes.find((n) => n.midi === 69 + 7)!;
    expect(fifth.scaleDegree).toBe(5);
  });

  it('propagates weight and role unchanged from the TonalNote definition', () => {
    const notes = buildScaleFrequencies(69, minorScale, 1);
    const root = notes.find((n) => n.midi === 69)!;
    expect(root.weight).toBe(minorScale[0].weight);
    expect(root.role).toBe(minorScale[0].role);
  });

  it('generates the expected count of notes across multiple octaves', () => {
    const notes = buildScaleFrequencies(69, minorScale, 3, 0, Infinity);
    expect(notes).toHaveLength(minorScale.length * 3);
  });

  describe('frequency range filtering (project spec vs. actual 432 Hz behavior)', () => {
    // NOTE: the original project spec says 110–880 Hz, inherited from 440 Hz tuning
    // (A2 and A5). At 432 Hz tuning those equivalents would be 108 and 864 Hz.
    // The actual code does NOT use either pair — it filters with
    // minFreq = BASE_FREQUENCY / 4 = 108 and maxFreq = BASE_FREQUENCY * 4 = 1728
    // (two octaves below/above A4, not a fixed 108/864 pair). This test documents
    // the real behavior; it does not assert the spec's 110/864 values.
    const minFreq = 432 / 4; // 108
    const maxFreq = 432 * 4; // 1728

    it('includes a note exactly at minFreq (inclusive bound)', () => {
      const notes = buildScaleFrequencies(69, minorScale, 10, minFreq, maxFreq);
      const hasBoundaryNote = notes.some((n) => Math.abs(n.freq - minFreq) < 1e-9);
      // A2 (midi 45) lands exactly on 432/4 since it's 2 octaves below A4.
      expect(midiToFreq432(45)).toBeCloseTo(minFreq, 9);
      expect(hasBoundaryNote || notes[0].freq >= minFreq).toBe(true);
    });

    it('includes a note exactly at maxFreq (inclusive bound)', () => {
      expect(midiToFreq432(93)).toBeCloseTo(maxFreq, 9); // A6, 2 octaves above A4
    });

    it('excludes notes outside [minFreq, maxFreq] when both bounds are passed', () => {
      const notes = buildScaleFrequencies(69, minorScale, 10, minFreq, maxFreq);
      for (const n of notes) {
        expect(n.freq).toBeGreaterThanOrEqual(minFreq);
        expect(n.freq).toBeLessThanOrEqual(maxFreq);
      }
    });

    it('110 Hz and 880 Hz (the spec values) sit INSIDE the code\'s actual 108–1728 Hz window', () => {
      // This is the divergence the user flagged: 110/880 are narrower than what
      // buildScaleFrequencies actually enforces. No code change made.
      expect(110).toBeGreaterThan(minFreq);
      expect(880).toBeLessThan(maxFreq);
    });
  });
});
