import { describe, it, expect } from 'vitest';
import { resolveNote, resolveFrequency, applyVelocityModulation } from './GRAVITY';
import { ScaleNote } from './TUNING';

function makeNote(partial: Partial<ScaleNote>): ScaleNote {
  return {
    freq: 432,
    weight: 1,
    role: 'anchor',
    midi: 69,
    noteName: 'A',
    scaleDegree: 1,
    octave: 4,
    ...partial,
  };
}

describe('resolveNote', () => {
  it('returns null when scaleNotes is empty (chromatic mode)', () => {
    expect(resolveNote(440, [], 0.5)).toBeNull();
  });

  it('picks the closer note when weights and roles are equal', () => {
    const near = makeNote({ freq: 430, midi: 1 });
    const far = makeNote({ freq: 500, midi: 2 });
    const result = resolveNote(431, [near, far], 0.5);
    expect(result?.midi).toBe(1);
  });

  it('lets a distant anchor outweigh a closer passing note of lower weight', () => {
    const anchor = makeNote({ freq: 400, weight: 1.0, role: 'anchor', midi: 1 });
    const passing = makeNote({ freq: 410, weight: 0.1, role: 'motion', midi: 2 });
    // rawFreq close to the weak passing note, but far enough that the anchor's
    // higher weight should still win — demonstrates gravity deforms the path
    // rather than always snapping to the nearest note.
    const result = resolveNote(412, [anchor, passing], 0.0);
    expect(result?.midi).toBe(1);
  });

  it('changes the winner as y shifts role weight (tension grows with y, anchor shrinks)', () => {
    const anchor = makeNote({ freq: 420, weight: 1.0, role: 'anchor', midi: 1 });
    const tension = makeNote({ freq: 440, weight: 1.0, role: 'tension', midi: 2 });
    const rawFreq = 430; // equidistant from both

    const atRest = resolveNote(rawFreq, [anchor, tension], 0); // tension weight low at y=0
    const atTensionPeak = resolveNote(rawFreq, [anchor, tension], 1); // tension weight high at y=1

    expect(atRest?.role).toBe('anchor');
    expect(atTensionPeak?.role).toBe('tension');
  });

  it('with weight 0 on every note, pull is always 0 and the FIRST note in the array wins by default (documented edge case, not necessarily intended)', () => {
    const first = makeNote({ freq: 1000, weight: 0, midi: 1 });
    const closer = makeNote({ freq: 441, weight: 0, midi: 2 });
    const result = resolveNote(440, [first, closer], 0.5);
    // bestPull starts at 0 and `pull > bestPull` never fires when all pulls are 0,
    // so bestNote stays scaleNotes[0] regardless of actual distance.
    expect(result?.midi).toBe(1);
  });
});

describe('resolveFrequency', () => {
  it('returns rawFreq unchanged when scaleNotes is empty', () => {
    expect(resolveFrequency(440, [], 0.5)).toBe(440);
  });

  it('returns the resolved note frequency when a match exists', () => {
    const note = makeNote({ freq: 432 });
    expect(resolveFrequency(430, [note], 0.5)).toBe(432);
  });
});

describe('applyVelocityModulation', () => {
  it('snaps fully to resolvedFreq when velocity is 0 (still)', () => {
    expect(applyVelocityModulation(400, 432, 0)).toBeCloseTo(432, 10);
  });

  it('stays at rawFreq (no snap) when velocity is 1 (fast)', () => {
    expect(applyVelocityModulation(400, 432, 1)).toBeCloseTo(400, 10);
  });

  it('clamps velocity above 1 to behave the same as velocity = 1', () => {
    const atOne = applyVelocityModulation(400, 432, 1);
    const atTwo = applyVelocityModulation(400, 432, 2);
    expect(atTwo).toBeCloseTo(atOne, 10);
  });

  it('blends exactly halfway at velocity = 0.5', () => {
    expect(applyVelocityModulation(400, 432, 0.5)).toBeCloseTo(416, 10);
  });
});
