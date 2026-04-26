// SØNA Pad v2 - Color Utilities for Synesthetic Sound Transformation

import { PHI, BASE_FREQUENCY } from './constants';

export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Convert hex to HSL
export function hexToHSL(hex: string): HSLColor {
  const rgb = hexToRGB(hex);
  return rgbToHSL(rgb);
}

// Convert hex to RGB
export function hexToRGB(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// Convert RGB to HSL
export function rgbToHSL(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Convert HSL to hex
export function hslToHex(hsl: HSLColor): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Color to audio parameters (pseudo-synesthesia)
export interface SynestheticParams {
  frequency: number;      // Base frequency influenced by hue
  harmonicDensity: number; // Saturation → richness (0-1)
  filterBrightness: number; // Lightness → filter openness (0-1)
  warmth: number;          // Color temperature (0-1)
}

export function colorToAudioParams(color: HSLColor): SynestheticParams {
  // Normalize hue to 0-1
  const hueNormalized = color.h / 360;
  
  // Frequency: Base 432Hz modified by hue using Golden Ratio
  // Creates a full octave range across the color wheel
  const frequency = BASE_FREQUENCY * (1 + hueNormalized * (PHI - 1));
  
  // Harmonic density from saturation
  const harmonicDensity = color.s / 100;
  
  // Filter brightness from lightness
  const filterBrightness = color.l / 100;
  
  // Warmth: warm colors (red/orange/yellow) = high, cool colors (blue/green) = low
  const warmth = hueNormalized < 0.5 
    ? 1 - (hueNormalized * 2)  // Red to cyan
    : (hueNormalized - 0.5) * 2; // Cyan to red
  
  return {
    frequency,
    harmonicDensity,
    filterBrightness,
    warmth,
  };
}

// Get complementary color
export function getComplementary(hsl: HSLColor): HSLColor {
  return {
    h: (hsl.h + 180) % 360,
    s: hsl.s,
    l: hsl.l,
  };
}

// Get analogous colors
export function getAnalogous(hsl: HSLColor): [HSLColor, HSLColor] {
  return [
    { h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l },
  ];
}

// Determine color mood for AI preset naming
export function getColorMood(hsl: HSLColor): 'warm' | 'cool' | 'vibrant' | 'dark' | 'neutral' {
  if (hsl.s < 20) return 'neutral';
  if (hsl.l < 30) return 'dark';
  if (hsl.s > 70 && hsl.l > 50) return 'vibrant';
  
  // Warm: reds, oranges, yellows (0-60, 300-360)
  if (hsl.h < 60 || hsl.h > 300) return 'warm';
  
  return 'cool';
}

// Update CSS custom properties with synesthetic color
export function applySynthColor(color: HSLColor) {
  const root = document.documentElement;
  root.style.setProperty('--synth-hue', color.h.toString());
  root.style.setProperty('--synth-saturation', `${color.s}%`);
  root.style.setProperty('--synth-lightness', `${color.l}%`);
}

// ============================================================
// SYNESTHETIC FEEDBACK: Sound → Color (GSI Parametric Mapping)
// ============================================================
// These functions derive visual properties FROM audio state,
// implementing the GSI principle that what you see IS what you hear.
// Frequency → Hue, Amplitude → Brightness, Intensity → Saturation

// Convert a frequency (Hz) to a hue (0-360)
// Inverse of the colorToAudioParams frequency mapping
// Maps the audible range to the full color wheel
export function frequencyToHue(freq: number): number {
  // Logarithmic mapping across full tonal range (108–1728 Hz = 4 octaves)
  // Matches human pitch perception and covers the expanded tonal field range.
  // 108 Hz → hue 0° (red-orange) · 432 Hz → hue 180° (cyan) · 1728 Hz → hue 360°
  const minFreq = BASE_FREQUENCY * 0.25; // 108 Hz
  const maxFreq = BASE_FREQUENCY * 4.0;  // 1728 Hz
  const logMin = Math.log2(minFreq);
  const logMax = Math.log2(maxFreq);
  const logFreq = Math.log2(Math.max(minFreq, Math.min(maxFreq, freq)));
  const norm = (logFreq - logMin) / (logMax - logMin);
  return norm * 360;
}

// Convert audio state to a complete HSL color
// freq: current frequency in Hz
// amplitude: 0-1 output level → lightness
// intensity: 0-1 vowel morphing intensity → saturation
export function audioToColor(freq: number, amplitude: number, intensity: number): HSLColor {
  return {
    h: frequencyToHue(freq),
    s: Math.round(40 + intensity * 60),  // 40-100% saturation
    l: Math.round(35 + amplitude * 50),  // 35-85% lightness
  };
}
