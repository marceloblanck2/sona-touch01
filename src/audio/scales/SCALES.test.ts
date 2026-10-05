import { describe, it, expect } from 'vitest';
import { SCALES, ScaleDefinition } from './SCALES';

describe('SCALES data integrity', () => {
  it('chromatic is explicitly null (no quantization)', () => {
    expect(SCALES.chromatic).toBeNull();
  });

  const namedScales = Object.entries(SCALES).filter(
    ([, def]) => def !== null
  ) as [string, ScaleDefinition][];

  it('covers natural_minor, major and harmonic_minor', () => {
    const names = namedScales.map(([name]) => name);
    expect(names).toEqual(
      expect.arrayContaining(['natural_minor', 'major', 'harmonic_minor'])
    );
  });

  for (const [name, scale] of namedScales) {
    describe(name, () => {
      it('has exactly one root note (interval 0) with role "anchor"', () => {
        const roots = scale.filter((n) => n.interval === 0);
        expect(roots).toHaveLength(1);
        expect(roots[0].role).toBe('anchor');
      });

      it('has unique intervals, all within a single octave [0, 11]', () => {
        const intervals = scale.map((n) => n.interval);
        expect(new Set(intervals).size).toBe(intervals.length);
        for (const i of intervals) {
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThanOrEqual(11);
        }
      });

      it('has intervals sorted ascending', () => {
        const intervals = scale.map((n) => n.interval);
        const sorted = [...intervals].sort((a, b) => a - b);
        expect(intervals).toEqual(sorted);
      });

      it('has all weights within [0, 1]', () => {
        for (const n of scale) {
          expect(n.weight).toBeGreaterThanOrEqual(0);
          expect(n.weight).toBeLessThanOrEqual(1);
        }
      });
    });
  }
});
