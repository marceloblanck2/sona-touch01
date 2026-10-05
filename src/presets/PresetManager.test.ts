import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresetManager, DEFAULT_PRESETS, Preset } from './PresetManager';

const STORAGE_KEY = 'sona-pad-presets-v2';

function customPresetSettings(): Omit<Preset, 'id' | 'name' | 'description' | 'createdAt'> {
  return {
    mappingX: 'frequency',
    mappingY: 'filter',
    mode: 'flow',
    color: { h: 10, s: 80, l: 50 }, // vibrant/warm -> deterministic mood
    modulationIntensity: 0.5,
    behavior: { glowSize: 1, trailDuration: 2, motionResponse: 0.5 },
  };
}

describe('PresetManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds all DEFAULT_PRESETS into storage when storage is empty', () => {
    const manager = new PresetManager();
    const all = manager.getAllPresets();
    expect(all).toHaveLength(DEFAULT_PRESETS.length);
    expect(all.every((p) => p.isDefault)).toBe(true);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(DEFAULT_PRESETS.length);
  });

  it('does not duplicate defaults when storage already has all of them', () => {
    new PresetManager(); // seeds storage
    const second = new PresetManager(); // loads existing storage
    expect(second.getAllPresets()).toHaveLength(DEFAULT_PRESETS.length);
  });

  it('backfills a missing default without touching existing custom presets', () => {
    const manager = new PresetManager();
    const custom = manager.createPreset(customPresetSettings());

    // Simulate a stored snapshot missing one default preset.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as [string, Preset][];
    const withoutOneDefault = stored.filter(([id]) => id !== 'default-1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutOneDefault));

    const reloaded = new PresetManager();
    const all = reloaded.getAllPresets();
    expect(all.some((p) => p.id === 'default-1')).toBe(true);
    expect(all.some((p) => p.id === custom.id)).toBe(true);
  });

  it('falls back to defaults when storage contains corrupted JSON, without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => new PresetManager()).not.toThrow();
    const manager = new PresetManager();
    expect(manager.getAllPresets()).toHaveLength(DEFAULT_PRESETS.length);
  });

  it('getAllPresets sorts defaults before custom presets, then by createdAt', () => {
    const manager = new PresetManager();
    const custom = manager.createPreset(customPresetSettings());
    const all = manager.getAllPresets();

    const lastDefaultIndex = all.map((p) => p.isDefault).lastIndexOf(true);
    const customIndex = all.findIndex((p) => p.id === custom.id);
    expect(customIndex).toBeGreaterThan(lastDefaultIndex);
  });

  it('getPreset returns a normalized preset for an existing id, undefined otherwise', () => {
    const manager = new PresetManager();
    expect(manager.getPreset('default-0')).toBeDefined();
    expect(manager.getPreset('does-not-exist')).toBeUndefined();
  });

  it('createPreset generates a prefixed id, a name/description, merges default behavior, and persists', () => {
    const manager = new PresetManager();
    const preset = manager.createPreset(customPresetSettings());

    expect(preset.id.startsWith('preset-')).toBe(true);
    expect(preset.name.length).toBeGreaterThan(0);
    expect(preset.description).toContain('frequency');
    expect(preset.behavior).toEqual(customPresetSettings().behavior);

    expect(manager.getPreset(preset.id)).toBeDefined();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as [string, Preset][];
    expect(stored.some(([id]) => id === preset.id)).toBe(true);
  });

  it('createPreset fills in missing behavior fields with DEFAULT_BEHAVIOR', () => {
    const manager = new PresetManager();
    const settings = customPresetSettings();
    // @ts-expect-error intentionally omitting behavior to test the merge fallback
    delete settings.behavior;
    const preset = manager.createPreset(settings);
    expect(preset.behavior).toEqual({ glowSize: 0.75, trailDuration: 3, motionResponse: 0.7 });
  });

  it('updatePreset returns null for a default preset (defaults are immutable)', () => {
    const manager = new PresetManager();
    expect(manager.updatePreset('default-0', { modulationIntensity: 0.1 })).toBeNull();
  });

  it('updatePreset returns null for a non-existent id', () => {
    const manager = new PresetManager();
    expect(manager.updatePreset('nope', { modulationIntensity: 0.1 })).toBeNull();
  });

  it('updatePreset merges partial behavior updates into a custom preset and persists', () => {
    const manager = new PresetManager();
    const preset = manager.createPreset(customPresetSettings());

    const updated = manager.updatePreset(preset.id, { behavior: { glowSize: 2 } as any });
    expect(updated?.behavior.glowSize).toBe(2);
    expect(updated?.behavior.trailDuration).toBe(preset.behavior.trailDuration); // untouched field preserved

    expect(manager.getPreset(preset.id)?.behavior.glowSize).toBe(2);
  });

  it('deletePreset returns false for a default preset and leaves it intact', () => {
    const manager = new PresetManager();
    expect(manager.deletePreset('default-0')).toBe(false);
    expect(manager.getPreset('default-0')).toBeDefined();
  });

  it('deletePreset returns false for a non-existent id', () => {
    const manager = new PresetManager();
    expect(manager.deletePreset('nope')).toBe(false);
  });

  it('deletePreset removes a custom preset and persists the removal', () => {
    const manager = new PresetManager();
    const preset = manager.createPreset(customPresetSettings());

    expect(manager.deletePreset(preset.id)).toBe(true);
    expect(manager.getPreset(preset.id)).toBeUndefined();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as [string, Preset][];
    expect(stored.some(([id]) => id === preset.id)).toBe(false);
  });

  it('does not throw when localStorage.setItem fails (e.g. quota exceeded)', () => {
    const manager = new PresetManager();
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota exceeded');
      });

    expect(() => manager.createPreset(customPresetSettings())).not.toThrow();

    setItemSpy.mockRestore();
  });
});
