// SØNA Pad v2 - Preset System with AI-assisted Naming

import { MappingOption, GridMode, COLOR_MOODS } from '../utils/constants';
import { HSLColor, getColorMood } from '../utils/colorUtils';

export interface PresetBehavior {
  glowSize: number;
  trailDuration: number;
  motionResponse: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  mappingX: MappingOption;
  mappingY: MappingOption;
  mode: GridMode;
  color: HSLColor;
  modulationIntensity: number;
  behavior: PresetBehavior;
  createdAt: number;
  isDefault?: boolean;
}

const DEFAULT_BEHAVIOR: PresetBehavior = {
  glowSize: 0.75,
  trailDuration: 3,
  motionResponse: 0.7,
};

const normalizePreset = (preset: Preset): Preset => {
  return {
    ...preset,
    behavior: {
      ...DEFAULT_BEHAVIOR,
      ...(preset.behavior ?? {}),
    },
  };
};

// AI-assisted preset naming
export function generatePresetName(
  color: HSLColor,
  mappingX: MappingOption,
  mappingY: MappingOption
): string {
  const mood = getColorMood(color);
  const moodWords = COLOR_MOODS[mood];
  const randomMoodWord = moodWords[Math.floor(Math.random() * moodWords.length)];

  const mappingSuffixes: Record<MappingOption, string[]> = {
    none: ['Silence', 'Void', 'Still'],
    frequency: ['Wave', 'Tone', 'Pitch'],
    filter: ['Sweep', 'Morph', 'Phase'],
    harmonics: ['Spectrum', 'Texture', 'Grain'],
    amplitude: ['Pulse', 'Breath', 'Swell'],
    pan: ['Space', 'Field', 'Drift'],
  };

  const xSuffixes = mappingSuffixes[mappingX];
  const suffix = xSuffixes[Math.floor(Math.random() * xSuffixes.length)];

  return `${randomMoodWord} ${suffix}`;
}

export function generatePresetDescription(
  preset: Omit<Preset, 'id' | 'name' | 'description' | 'createdAt'>
): string {
  const modeDesc = preset.mode === 'grid' ? 'structured zones' : 'fluid gestures';
  const xDesc = preset.mappingX !== 'none' ? preset.mappingX : 'static';
  const yDesc = preset.mappingY !== 'none' ? preset.mappingY : 'static';

  return `X→${xDesc}, Y→${yDesc}, ${modeDesc}`;
}

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'default-0',
    name: 'SØM Touch',
    description: 'X→pan, Y→frequency, fluid gestures',
    mappingX: 'pan',
    mappingY: 'frequency',
    mode: 'flow',
    color: { h: 210, s: 60, l: 55 },
    modulationIntensity: 0.6,
    behavior: {
      glowSize: 0.75,
      trailDuration: 3,
      motionResponse: 0.7,
    },
    createdAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'default-1',
    name: 'Solar Wave',
    description: 'X→frequency, Y→filter, structured zones',
    mappingX: 'frequency',
    mappingY: 'filter',
    mode: 'grid',
    color: { h: 38, s: 75, l: 55 },
    modulationIntensity: 0.5,
    behavior: {
      glowSize: 1.15,
      trailDuration: 2,
      motionResponse: 0.5,
    },
    createdAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'default-2',
    name: 'Arctic Drift',
    description: 'X→pan, Y→harmonics, fluid gestures',
    mappingX: 'pan',
    mappingY: 'harmonics',
    mode: 'flow',
    color: { h: 200, s: 60, l: 50 },
    modulationIntensity: 0.7,
    behavior: {
      glowSize: 0.6,
      trailDuration: 5,
      motionResponse: 0.9,
    },
    createdAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'default-3',
    name: 'Deep Pulse',
    description: 'X→filter, Y→amplitude, structured zones',
    mappingX: 'filter',
    mappingY: 'amplitude',
    mode: 'grid',
    color: { h: 280, s: 50, l: 30 },
    modulationIntensity: 0.6,
    behavior: {
      glowSize: 0.95,
      trailDuration: 2.6,
      motionResponse: 0.6,
    },
    createdAt: Date.now(),
    isDefault: true,
  },
  {
    id: 'default-4',
    name: 'Neon Spectrum',
    description: 'X→harmonics, Y→frequency, fluid gestures',
    mappingX: 'harmonics',
    mappingY: 'frequency',
    mode: 'flow',
    color: { h: 320, s: 90, l: 60 },
    modulationIntensity: 0.8,
    behavior: {
      glowSize: 1.25,
      trailDuration: 3.8,
      motionResponse: 1,
    },
    createdAt: Date.now(),
    isDefault: true,
  },
];

export class PresetManager {
  private presets: Map<string, Preset> = new Map();
  private storageKey = 'sona-pad-presets';

  constructor() {
    this.loadFromStorage();

    if (this.presets.size === 0) {
      DEFAULT_PRESETS.forEach((preset) => this.presets.set(preset.id, normalizePreset(preset)));
      this.saveToStorage();
    } else {
      let changed = false;

      DEFAULT_PRESETS.forEach((preset) => {
        if (!this.presets.has(preset.id)) {
          this.presets.set(preset.id, normalizePreset(preset));
          changed = true;
        }
      });

      this.presets.forEach((preset, id) => {
        const normalized = normalizePreset(preset);
        this.presets.set(id, normalized);
      });

      if (changed) {
        this.saveToStorage();
      }
    }
  }

  getAllPresets(): Preset[] {
    return Array.from(this.presets.values()).sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.createdAt - b.createdAt;
    });
  }

  getPreset(id: string): Preset | undefined {
    const preset = this.presets.get(id);
    return preset ? normalizePreset(preset) : undefined;
  }

  createPreset(settings: Omit<Preset, 'id' | 'name' | 'description' | 'createdAt'>): Preset {
    const normalizedSettings = {
      ...settings,
      behavior: {
        ...DEFAULT_BEHAVIOR,
        ...(settings.behavior ?? {}),
      },
    };

    const name = generatePresetName(
      normalizedSettings.color,
      normalizedSettings.mappingX,
      normalizedSettings.mappingY
    );

    const description = generatePresetDescription(normalizedSettings);

    const preset: Preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      ...normalizedSettings,
      createdAt: Date.now(),
    };

    this.presets.set(preset.id, preset);
    this.saveToStorage();

    return preset;
  }

  updatePreset(id: string, updates: Partial<Omit<Preset, 'id' | 'isDefault'>>): Preset | null {
    const preset = this.presets.get(id);
    if (!preset || preset.isDefault) return null;

    const updated = normalizePreset({
      ...preset,
      ...updates,
      behavior: {
        ...preset.behavior,
        ...(updates.behavior ?? {}),
      },
    });

    this.presets.set(id, updated);
    this.saveToStorage();

    return updated;
  }

  deletePreset(id: string): boolean {
    const preset = this.presets.get(id);
    if (!preset || preset.isDefault) return false;

    this.presets.delete(id);
    this.saveToStorage();

    return true;
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.presets.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save presets:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);

      if (data) {
        const entries = JSON.parse(data) as [string, Preset][];
        this.presets = new Map(entries.map(([id, preset]) => [id, normalizePreset(preset)]));
      }
    } catch (e) {
      console.warn('Failed to load presets:', e);
    }
  }
}

export const presetManager = new PresetManager();
