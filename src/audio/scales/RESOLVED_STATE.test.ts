import { describe, it, expect } from 'vitest';
import { deriveVisualState, buildResolvedState, SATURATION, LIGHTNESS, GLOW, SCALE, RESTING } from './RESOLVED_STATE';
import { ScaleNote } from './TUNING';

describe('deriveVisualState — hue (color/note mapping)', () => {
  it('maps scaleDegreeNormalized = 0 to hueStart', () => {
    const { hue } = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 0,
      yEnergy: 0,
      restingDuration: 0,
      role: 'anchor',
      hueStart: 220,
      hueEnd: 295,
    });
    expect(hue).toBeCloseTo(220, 10);
  });

  it('maps scaleDegreeNormalized = 1 to hueEnd', () => {
    const { hue } = deriveVisualState({
      scaleDegreeNormalized: 1,
      velocity: 0,
      yEnergy: 0,
      restingDuration: 0,
      role: 'anchor',
      hueStart: 220,
      hueEnd: 295,
    });
    expect(hue).toBeCloseTo(295, 10);
  });

  it('wraps a hue that overshoots 360 back into [0, 360)', () => {
    const { hue } = deriveVisualState({
      scaleDegreeNormalized: 0.5,
      velocity: 0,
      yEnergy: 0,
      restingDuration: 0,
      role: 'anchor',
      hueStart: 350,
      hueEnd: 370, // lerp midpoint = 360 -> should wrap to 0
    });
    expect(hue).toBeCloseTo(0, 10);
  });

  it('wraps a negative hue into [0, 360)', () => {
    const { hue } = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 0,
      yEnergy: 0,
      restingDuration: 0,
      role: 'anchor',
      hueStart: -10,
      hueEnd: 10,
    });
    expect(hue).toBeCloseTo(350, 10);
  });
});

describe('deriveVisualState — saturation/lightness base + role modifiers', () => {
  it('applies velocity-driven saturation and the "motion" role additive modifier', () => {
    const { saturation } = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 0,
      yEnergy: 0,
      restingDuration: 0,
      role: 'motion',
      hueStart: 0,
      hueEnd: 1,
    });
    // base lerp(40,95,0)=40, + motion.saturation (+12) = 52
    expect(saturation).toBeCloseTo(52, 10);
  });

  it('applies yEnergy-driven lightness and the "motion" role additive modifier', () => {
    const { lightness } = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 0,
      yEnergy: 1,
      restingDuration: 0,
      role: 'motion',
      hueStart: 0,
      hueEnd: 1,
    });
    // base lerp(25,75,1)=75, + motion.lightness (+5) = 80
    expect(lightness).toBeCloseTo(80, 10);
  });
});

describe('deriveVisualState — clamping under extreme input', () => {
  it('clamps saturation and glow at their ceiling under tension + full velocity/yEnergy + full resting, while lightness and scale stay below their ceiling', () => {
    const result = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 1,
      yEnergy: 1,
      restingDuration: 5000, // far past RESTING.durationToFull (1000)
      role: 'tension',
      hueStart: 0,
      hueEnd: 1,
    });

    // saturation: lerp(40,95,1)=95, +tension(+20)=115, +restingBoost(8)=123 -> clamps to 100
    expect(result.saturation).toBeCloseTo(SATURATION.clampMax, 10);
    // glow: 0.3 + 1*0.3 + 1*0.2 = 0.8, +tension.glow(0.25)=1.05, +restingBoost(0.25)=1.30 -> clamps to 1
    expect(result.glow).toBeCloseTo(GLOW.clampMax, 10);
    // lightness: lerp(25,75,1)=75, +tension.lightness(+8)=83 -> below clampMax (85), NOT clamped
    expect(result.lightness).toBeCloseTo(83, 10);
    expect(result.lightness).toBeLessThan(LIGHTNESS.clampMax);
    // scale: 1.0 + tension.scale(0.18) + restingBoost(0.20) = 1.38 -> below clampMax (1.5), NOT clamped
    expect(result.scale).toBeCloseTo(1.38, 10);
    expect(result.scale).toBeLessThan(SCALE.clampMax);
  });

  it('saturates restingFactor at 1 — restingDuration far beyond durationToFull has the same effect as exactly durationToFull', () => {
    const atThreshold = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 0,
      yEnergy: 0,
      restingDuration: RESTING.durationToFull,
      role: 'anchor',
      hueStart: 0,
      hueEnd: 1,
    });
    const farBeyond = deriveVisualState({
      scaleDegreeNormalized: 0,
      velocity: 0,
      yEnergy: 0,
      restingDuration: RESTING.durationToFull * 10,
      role: 'anchor',
      hueStart: 0,
      hueEnd: 1,
    });
    expect(farBeyond.scale).toBeCloseTo(atThreshold.scale, 10);
    expect(farBeyond.glow).toBeCloseTo(atThreshold.glow, 10);
    expect(farBeyond.saturation).toBeCloseTo(atThreshold.saturation, 10);
  });
});

describe('buildResolvedState', () => {
  it('passes note fields through unchanged from the ScaleNote input', () => {
    const note: ScaleNote = {
      freq: 432,
      weight: 1,
      role: 'anchor',
      midi: 69,
      noteName: 'A',
      scaleDegree: 1,
      octave: 4,
    };

    const state = buildResolvedState({
      note,
      velocity: 0.5,
      yEnergy: 0.5,
      restingDuration: 0,
      scaleDegreeNormalized: 0,
      hueStart: 0,
      hueEnd: 1,
    });

    expect(state.note).toBe(note.noteName);
    expect(state.midi).toBe(note.midi);
    expect(state.frequency).toBe(note.freq);
    expect(state.role).toBe(note.role);
    expect(state.scaleDegree).toBe(note.scaleDegree);
    expect(state.octave).toBe(note.octave);
  });
});
