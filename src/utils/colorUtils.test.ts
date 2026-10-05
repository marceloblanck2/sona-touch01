import { describe, it, expect } from 'vitest';
import {
  hexToRGB,
  hexToHSL,
  rgbToHSL,
  hslToHex,
  colorToAudioParams,
  getComplementary,
  getAnalogous,
  getColorMood,
  frequencyToHue,
  audioToColor,
} from './colorUtils';
import { PHI, BASE_FREQUENCY } from './constants';

describe('hexToRGB', () => {
  it('parses a hex string with #', () => {
    expect(hexToRGB('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses a hex string without #', () => {
    expect(hexToRGB('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses uppercase hex', () => {
    expect(hexToRGB('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('falls back to black for an invalid hex string', () => {
    expect(hexToRGB('not-a-color')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToHSL / hexToHSL', () => {
  it('converts pure red', () => {
    expect(hexToHSL('#ff0000')).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('converts pure green', () => {
    expect(hexToHSL('#00ff00')).toEqual({ h: 120, s: 100, l: 50 });
  });

  it('converts pure blue', () => {
    expect(hexToHSL('#0000ff')).toEqual({ h: 240, s: 100, l: 50 });
  });

  it('converts white (no hue/saturation, full lightness)', () => {
    expect(hexToHSL('#ffffff')).toEqual({ h: 0, s: 0, l: 100 });
  });

  it('converts black (no hue/saturation, zero lightness)', () => {
    expect(hexToHSL('#000000')).toEqual({ h: 0, s: 0, l: 0 });
  });

  it('converts a neutral gray (zero saturation)', () => {
    const hsl = rgbToHSL({ r: 128, g: 128, b: 128 });
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(50);
  });
});

describe('hslToHex', () => {
  it('round-trips pure red through hexToHSL -> hslToHex', () => {
    expect(hslToHex(hexToHSL('#ff0000'))).toBe('#ff0000');
  });

  it('round-trips pure green through hexToHSL -> hslToHex', () => {
    expect(hslToHex(hexToHSL('#00ff00'))).toBe('#00ff00');
  });

  it('round-trips pure blue through hexToHSL -> hslToHex', () => {
    expect(hslToHex(hexToHSL('#0000ff'))).toBe('#0000ff');
  });

  it('round-trips gray through hexToHSL -> hslToHex', () => {
    expect(hslToHex(hexToHSL('#808080'))).toBe('#808080');
  });
});

describe('colorToAudioParams (color -> sound mapping)', () => {
  it('maps hue 0 to the base 432 Hz frequency', () => {
    const params = colorToAudioParams({ h: 0, s: 50, l: 50 });
    expect(params.frequency).toBeCloseTo(BASE_FREQUENCY, 10);
  });

  it('maps hue 360 to 432 Hz scaled by the golden ratio', () => {
    const params = colorToAudioParams({ h: 360, s: 50, l: 50 });
    expect(params.frequency).toBeCloseTo(BASE_FREQUENCY * PHI, 10);
  });

  it('derives harmonicDensity from saturation and filterBrightness from lightness', () => {
    const params = colorToAudioParams({ h: 0, s: 80, l: 20 });
    expect(params.harmonicDensity).toBeCloseTo(0.8, 10);
    expect(params.filterBrightness).toBeCloseTo(0.2, 10);
  });

  it('warmth is maximal at hue 0 (red), zero at hue 180 (cyan), maximal again at hue 360 (red)', () => {
    expect(colorToAudioParams({ h: 0, s: 50, l: 50 }).warmth).toBeCloseTo(1, 10);
    expect(colorToAudioParams({ h: 180, s: 50, l: 50 }).warmth).toBeCloseTo(0, 10);
    expect(colorToAudioParams({ h: 360, s: 50, l: 50 }).warmth).toBeCloseTo(1, 10);
  });
});

describe('getComplementary', () => {
  it('rotates hue by 180 degrees and preserves s/l', () => {
    expect(getComplementary({ h: 90, s: 60, l: 40 })).toEqual({ h: 270, s: 60, l: 40 });
  });

  it('wraps correctly past 360', () => {
    expect(getComplementary({ h: 270, s: 60, l: 40 })).toEqual({ h: 90, s: 60, l: 40 });
  });
});

describe('getAnalogous', () => {
  it('wraps the +30 side past 360', () => {
    const [plus30] = getAnalogous({ h: 350, s: 50, l: 50 });
    expect(plus30.h).toBe(20);
  });

  it('wraps the -30 side below 0', () => {
    const [, minus30] = getAnalogous({ h: 10, s: 50, l: 50 });
    expect(minus30.h).toBe(340);
  });
});

describe('getColorMood boundary behavior', () => {
  it('s < 20 is neutral; s === 20 exactly is NOT neutral (strict <)', () => {
    expect(getColorMood({ h: 100, s: 19, l: 50 })).toBe('neutral');
    expect(getColorMood({ h: 100, s: 20, l: 50 })).not.toBe('neutral');
  });

  it('l < 30 is dark; l === 30 exactly is NOT dark (strict <)', () => {
    expect(getColorMood({ h: 100, s: 50, l: 29 })).toBe('dark');
    expect(getColorMood({ h: 100, s: 50, l: 30 })).not.toBe('dark');
  });

  it('vibrant requires s > 70 AND l > 50 strictly; s === 70 falls through to cool/warm', () => {
    expect(getColorMood({ h: 100, s: 71, l: 51 })).toBe('vibrant');
    expect(getColorMood({ h: 100, s: 70, l: 51 })).not.toBe('vibrant');
  });

  it('warm is h < 60 or h > 300; h === 60 and h === 300 exactly fall through to cool', () => {
    expect(getColorMood({ h: 59, s: 50, l: 50 })).toBe('warm');
    expect(getColorMood({ h: 301, s: 50, l: 50 })).toBe('warm');
    expect(getColorMood({ h: 60, s: 50, l: 50 })).toBe('cool');
    expect(getColorMood({ h: 300, s: 50, l: 50 })).toBe('cool');
  });
});

describe('frequencyToHue (sound -> color mapping)', () => {
  // Real min/max used by the code: BASE_FREQUENCY * 0.25 = 108 Hz and
  // BASE_FREQUENCY * 4 = 1728 Hz (two octaves below/above 432 Hz A4).
  const minFreq = BASE_FREQUENCY * 0.25;
  const maxFreq = BASE_FREQUENCY * 4;

  it('maps the minimum frequency (108 Hz) to hueStart', () => {
    expect(frequencyToHue(minFreq, 0, 270)).toBeCloseTo(0, 10);
  });

  it('maps the maximum frequency (1728 Hz) to hueEnd', () => {
    expect(frequencyToHue(maxFreq, 0, 270)).toBeCloseTo(270, 10);
  });

  it('clamps frequencies below the minimum to hueStart', () => {
    expect(frequencyToHue(20, 0, 270)).toBeCloseTo(frequencyToHue(minFreq, 0, 270), 10);
  });

  it('clamps frequencies above the maximum to hueEnd', () => {
    expect(frequencyToHue(5000, 0, 270)).toBeCloseTo(frequencyToHue(maxFreq, 0, 270), 10);
  });

  it('supports a reversed arc when hueStart > hueEnd', () => {
    expect(frequencyToHue(minFreq, 270, 0)).toBeCloseTo(270, 10);
    expect(frequencyToHue(maxFreq, 270, 0)).toBeCloseTo(0, 10);
  });

  it('110 Hz and 880 Hz (spec values) fall strictly inside the code\'s real 108-1728 Hz window, so neither gets clamped', () => {
    const hue110 = frequencyToHue(110, 0, 270);
    const hue880 = frequencyToHue(880, 0, 270);
    expect(hue110).toBeGreaterThan(0);
    expect(hue110).toBeLessThan(270);
    expect(hue880).toBeGreaterThan(0);
    expect(hue880).toBeLessThan(270);
  });
});

describe('audioToColor', () => {
  it('maps intensity 0 -> 1 to saturation 40 -> 100', () => {
    expect(audioToColor(432, 0, 0).s).toBe(40);
    expect(audioToColor(432, 0, 1).s).toBe(100);
  });

  it('maps amplitude 0 -> 1 to lightness 35 -> 85', () => {
    expect(audioToColor(432, 0, 0).l).toBe(35);
    expect(audioToColor(432, 1, 0).l).toBe(85);
  });
});
