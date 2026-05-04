// SØNA Touch 01 — Resolved State
// Single source of truth per touch: gesture + note + visual together.
// "O gesto, a nota resolvida, a cor e a intensidade respondem como um único organismo."

import { NoteRole } from './SCALES';
import { ScaleNote } from './TUNING';

// ============================================================================
// CONSTANTS — todas concentradas aqui para facilitar tuning
// ============================================================================

// --- Field defaults (Lá menor for testing) ---
export const FIELD_DEFAULTS = {
  hueBase: 220,
  hueRange: 75,
} as const;

// --- Saturation range (controlled by velocity) ---
export const SATURATION = {
  min: 40,
  max: 95,
  clampMin: 25,
  clampMax: 100,
} as const;

// --- Lightness range (controlled by yEnergy) ---
export const LIGHTNESS = {
  min: 25,
  max: 75,
  clampMin: 15,
  clampMax: 85,
} as const;

// --- Scale (visual size multiplier) ---
export const SCALE = {
  base: 1.0,
  clampMin: 0.8,
  clampMax: 1.5,
} as const;

// --- Glow (visual intensity 0-1) ---
export const GLOW = {
  base: 0.3,
  clampMin: 0,
  clampMax: 1,
} as const;

// --- Resting behavior ---
export const RESTING = {
  velocityThreshold: 0.05,    // below this = resting
  durationToFull: 1000,        // ms to reach restingFactor = 1
  scaleBoost: 0.20,
  glowBoost: 0.25,
  saturationBoost: 8,
} as const;

// --- Role modifiers (initially expressive for validation) ---
export interface RoleModifier {
  saturation: number;
  lightness: number;
  glow: number;
  scale: number;
}

export const ROLE_MODIFIERS: Record<NoteRole, RoleModifier> = {
  anchor:     { saturation: -15, lightness:  +5, glow: +0.10, scale: +0.10 },
  resolution: { saturation:  +5, lightness: +12, glow: +0.18, scale: +0.12 },
  tension:    { saturation: +20, lightness:  +8, glow: +0.25, scale: +0.18 },
  shadow:     { saturation: -10, lightness: -18, glow: -0.05, scale: +0.05 },
  motion:     { saturation: +12, lightness:  +5, glow: +0.12, scale: +0.10 },
  opening:    { saturation: +15, lightness: +10, glow: +0.20, scale: +0.15 },
  color:      { saturation: +18, lightness:  +5, glow: +0.15, scale: +0.08 },
};

// ============================================================================
// INTERFACE
// ============================================================================

export interface ResolvedState {
  // --- Note data (updates only when resolved note changes) ---
  note: string;          // "A", "C#", "D"
  midi: number;          // MIDI note number
  frequency: number;     // Hz at 432
  role: NoteRole;
  scaleDegree: number;   // 1 to 7 (position within scale)
  octave: number;        // standard octave number

  // --- Gesture data (updates continuously) ---
  velocity: number;        // 0-1 normalized
  yEnergy: number;         // 0-1 (Y baixo = energia alta)
  restingDuration: number; // ms still on current note

  // --- Visual derived (updates continuously) ---
  hue: number;          // 0-360
  saturation: number;   // 0-100
  lightness: number;    // 0-100
  scale: number;        // 0.8-1.5
  glow: number;         // 0-1
}

// ============================================================================
// HELPERS
// ============================================================================

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * clamp(t, 0, 1);

// ============================================================================
// VISUAL DERIVATION
// Hue derived from note position within field hue range.
// Saturation/Lightness modulated by gesture.
// Role and resting modifiers applied as additive overlays.
// ============================================================================

export interface VisualDerivationInput {
  scaleDegreeNormalized: number;  // 0-1 position within scale (low to high)
  velocity: number;
  yEnergy: number;
  restingDuration: number;
  role: NoteRole;
  hueStart: number;
  hueEnd: number;
}

export interface VisualOutput {
  hue: number;
  saturation: number;
  lightness: number;
  scale: number;
  glow: number;
}

export function deriveVisualState(input: VisualDerivationInput): VisualOutput {
  const {
    scaleDegreeNormalized,
    velocity,
    yEnergy,
    restingDuration,
    role,
    hueStart,
    hueEnd,
  } = input;

  // --- Hue: position in field arc ---
  const hue = lerp(hueStart, hueEnd, scaleDegreeNormalized);

  // --- Base saturation from velocity ---
  let saturation = lerp(SATURATION.min, SATURATION.max, velocity);

  // --- Base lightness from yEnergy ---
  let lightness = lerp(LIGHTNESS.min, LIGHTNESS.max, yEnergy);

  // --- Base scale and glow ---
  let scale = SCALE.base;
  let glow = GLOW.base + velocity * 0.3 + yEnergy * 0.2;

  // --- Apply role modifiers ---
  const mod = ROLE_MODIFIERS[role];
  saturation += mod.saturation;
  lightness += mod.lightness;
  glow += mod.glow;
  scale += mod.scale;

  // --- Apply resting modifiers ---
  const restingFactor = clamp(restingDuration / RESTING.durationToFull, 0, 1);
  scale += restingFactor * RESTING.scaleBoost;
  glow += restingFactor * RESTING.glowBoost;
  saturation += restingFactor * RESTING.saturationBoost;

  // --- Final clamps ---
  return {
    hue: ((hue % 360) + 360) % 360,
    saturation: clamp(saturation, SATURATION.clampMin, SATURATION.clampMax),
    lightness: clamp(lightness, LIGHTNESS.clampMin, LIGHTNESS.clampMax),
    scale: clamp(scale, SCALE.clampMin, SCALE.clampMax),
    glow: clamp(glow, GLOW.clampMin, GLOW.clampMax),
  };
}

// ============================================================================
// BUILDER — assembles ResolvedState from raw inputs
// ============================================================================

export interface ResolvedStateInput {
  note: ScaleNote;
  velocity: number;
  yEnergy: number;
  restingDuration: number;
  scaleDegreeNormalized: number;  // 0-1 position in current field
  hueStart: number;
  hueEnd: number;
}

export function buildResolvedState(input: ResolvedStateInput): ResolvedState {
  const { note, velocity, yEnergy, restingDuration, scaleDegreeNormalized, hueStart, hueEnd } = input;

  const visual = deriveVisualState({
    scaleDegreeNormalized,
    velocity,
    yEnergy,
    restingDuration,
    role: note.role,
    hueStart,
    hueEnd,
  });

  return {
    // Note
    note: note.noteName,
    midi: note.midi,
    frequency: note.freq,
    role: note.role,
    scaleDegree: note.scaleDegree,
    octave: note.octave,

    // Gesture
    velocity,
    yEnergy,
    restingDuration,

    // Visual
    hue: visual.hue,
    saturation: visual.saturation,
    lightness: visual.lightness,
    scale: visual.scale,
    glow: visual.glow,
  };
}
