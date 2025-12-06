// SØNA Pad v2 - Preset System with AI-assisted Naming

import { MappingOption, GridMode, COLOR_MOODS } from '../utils/constants';
import { HSLColor, getColorMood } from '../utils/colorUtils';

export interface Preset {
  id: string;
  name: string;
  description: string;
  mappingX: MappingOption;
  mappingY: MappingOption;
  mode: GridMode;
  color: HSLColor;
  modulationIntensity: number;
  createdAt: number;
  isDefault?: boolean;
}

// AI-assisted preset naming (heuristic-based)
export function generatePresetName(color: HSLColor, mappingX: MappingOption, mappingY: MappingOption): string {
  const mood = getColorMood(color);
  const moodWords = COLOR_MOODS[mood];
  const randomMoodWord = moodWords[Math.floor(Math.random() * moodWords.length)];
  
  // Mapping-based suffixes
  const mappingSuffixes: Record<MappingOption, string[]> = {
    none: ['Silence', 'Void', 'Still'],
    frequency: ['Wave', 'Tone', 'Pitch'],
    filter: ['Sweep', 'Morph', 'Phase'],
    harmonics: ['Spectrum', 'Texture', 'Grain'],
    amplitude: ['Pulse', 'Breath', 'Swell'],
    pan: ['Space', 'Field', 'Drift'],
  };
  
  const xSuffixes = mappingSuffixes[mappingX];
  const ySuffixes = mappingSuffixes[mappingY];
  
  const suffix = xSuffixes[Math.floor(Math.random() * xSuffixes.length)];
  
  return `${randomMoodWord} ${suffix}`;
}

// Generate description based on preset settings
export function generatePresetDescription(preset: Omit<Preset, 'id' | 'name' | 'description' | 'createdAt'>): string {
  const modeDesc = preset.mode === 'grid' ? 'structured zones' : 'fluid gestures';
  const xDesc = preset.mappingX !== 'none' ? preset.mappingX : 'static';
  const yDesc = preset.mappingY !== 'none' ? preset.mappingY : 'static';
  
  return `X→${xDesc}, Y→${yDesc}, ${modeDesc}`;
}

// Default presets
export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'default-1',
    name: 'Solar Wave',
    description: 'X→frequency, Y→filter, structured zones',
    mappingX: 'frequency',
    mappingY: 'filter',
    mode: 'grid',
    color: { h: 38, s: 75, l: 55 },
    modulationIntensity: 0.5,
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
    createdAt: Date.now(),
    isDefault: true,
  },
];

// Preset Manager Class
export class PresetManager {
  private presets: Map<string, Preset> = new Map();
  private storageKey = 'sona-pad-presets';

  constructor() {
    this.loadFromStorage();
    
    // Add default presets if none exist
    if (this.presets.size === 0) {
      DEFAULT_PRESETS.forEach(p => this.presets.set(p.id, p));
      this.saveToStorage();
    }
  }

  // Get all presets
  getAllPresets(): Preset[] {
    return Array.from(this.presets.values()).sort((a, b) => {
      // Defaults first, then by creation date
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.createdAt - a.createdAt;
    });
  }

  // Get a preset by ID
  getPreset(id: string): Preset | undefined {
    return this.presets.get(id);
  }

  // Create a new preset
  createPreset(settings: Omit<Preset, 'id' | 'name' | 'description' | 'createdAt'>): Preset {
    const name = generatePresetName(settings.color, settings.mappingX, settings.mappingY);
    const description = generatePresetDescription(settings);
    
    const preset: Preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      ...settings,
      createdAt: Date.now(),
    };
    
    this.presets.set(preset.id, preset);
    this.saveToStorage();
    
    return preset;
  }

  // Update an existing preset
  updatePreset(id: string, updates: Partial<Omit<Preset, 'id' | 'isDefault'>>): Preset | null {
    const preset = this.presets.get(id);
    if (!preset || preset.isDefault) return null;
    
    const updated = { ...preset, ...updates };
    this.presets.set(id, updated);
    this.saveToStorage();
    
    return updated;
  }

  // Delete a preset
  deletePreset(id: string): boolean {
    const preset = this.presets.get(id);
    if (!preset || preset.isDefault) return false;
    
    this.presets.delete(id);
    this.saveToStorage();
    
    return true;
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      const data = Array.from(this.presets.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save presets:', e);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const entries = JSON.parse(data) as [string, Preset][];
        this.presets = new Map(entries);
      }
    } catch (e) {
      console.warn('Failed to load presets:', e);
    }
  }
}

// Singleton instance
export const presetManager = new PresetManager();
