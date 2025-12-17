// SØNA Pad v2 - Core Constants
// Based on Golden Ratio (φ = 1.618) and 3-6-9 numerical structure

export const PHI = 1.618033988749895; // Golden Ratio
export const BASE_FREQUENCY = 432; // Hz - Natural tuning
export const MAX_VOICES = 10; // Support 10 concurrent touches

// 3-6-9 Rhythm values (in seconds)
export const RHYTHM = {
  ATTACK: 0.03,
  DECAY: 0.06,
  RELEASE: 0.09,
  FAST: 0.03,
  MEDIUM: 0.06,
  SLOW: 0.09,
} as const;

// Golden Ratio multipliers for harmonic series
export const PHI_HARMONICS = [
  1,
  PHI,
  PHI * PHI,
  PHI * PHI * PHI,
  1 / PHI,
  1 / (PHI * PHI),
] as const;

// Grid configurations
export const GRID_3x3 = 3;
export const GRID_6x6 = 6;

// Zone behaviors based on 3-6-9
export const ZONE_BEHAVIORS = {
  HARMONIC_DENSITY: [3, 6, 9, 6, 9, 3, 9, 3, 6], // per zone
  MODULATION_SPEED: [0.3, 0.6, 0.9, 0.6, 0.9, 0.3, 0.9, 0.3, 0.6],
  REPETITION_RATE: [3, 6, 9, 3, 6, 9, 3, 6, 9],
} as const;

// Audio mapping options
export const MAPPING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'filter', label: 'Filter Cutoff' },
  { value: 'harmonics', label: 'Harmonic Density' },
  { value: 'amplitude', label: 'Amplitude' },
  { value: 'pan', label: 'Stereo Pan' },
] as const;

// Color presets for AI naming
export const COLOR_MOODS = {
  warm: ['Solar', 'Amber', 'Flame', 'Coral', 'Sunset'],
  cool: ['Ocean', 'Arctic', 'Frost', 'Lunar', 'Mist'],
  vibrant: ['Neon', 'Electric', 'Pulse', 'Radiant', 'Vivid'],
  dark: ['Shadow', 'Obsidian', 'Void', 'Deep', 'Night'],
  neutral: ['Stone', 'Silver', 'Ash', 'Cloud', 'Silk'],
} as const;

// Gesture thresholds
export const GESTURE = {
  SLOW_THRESHOLD: 0.1, // normalized velocity
  FAST_THRESHOLD: 0.6,
  CIRCULAR_THRESHOLD: 0.8, // curvature detection
  ZONE_CROSS_TIME: 100, // ms
} as const;

export type MappingOption = typeof MAPPING_OPTIONS[number]['value'];
export type GridMode = 'grid' | 'flow';
