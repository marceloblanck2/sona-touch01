// SØNA Pad v2 - Preset Panel Component

import React, { useState, useCallback } from 'react';
import { Preset, presetManager } from '../../presets/PresetManager';
import { MappingOption, GridMode } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '../ui/button';

interface PresetPanelProps {
  currentSettings: {
    mappingX: MappingOption;
    mappingY: MappingOption;
    mode: GridMode;
    color: HSLColor;
  };
  onLoadPreset: (preset: Preset) => void;
  accentColor: HSLColor;
}

export const PresetPanel: React.FC<PresetPanelProps> = ({
  currentSettings,
  onLoadPreset,
  accentColor,
}) => {
  const [presets, setPresets] = useState<Preset[]>(presetManager.getAllPresets());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const handleSavePreset = useCallback(() => {
    const newPreset = presetManager.createPreset({
      mappingX: currentSettings.mappingX,
      mappingY: currentSettings.mappingY,
      mode: currentSettings.mode,
      color: currentSettings.color,
      modulationIntensity: 0.5,
    });
    
    setPresets(presetManager.getAllPresets());
    setSelectedId(newPreset.id);
    setJustSaved(true);
    
    setTimeout(() => setJustSaved(false), 2000);
  }, [currentSettings]);

  const handleLoadPreset = useCallback((preset: Preset) => {
    setSelectedId(preset.id);
    onLoadPreset(preset);
  }, [onLoadPreset]);

  const handleDeletePreset = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (presetManager.deletePreset(id)) {
      setPresets(presetManager.getAllPresets());
      if (selectedId === id) setSelectedId(null);
    }
  }, [selectedId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Presets</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSavePreset}
          className="h-8 px-3 text-xs gap-1.5"
          style={{
            color: justSaved 
              ? `hsl(${accentColor.h} ${accentColor.s}% ${accentColor.l}%)`
              : undefined,
          }}
        >
          {justSaved ? <Check size={14} /> : <Plus size={14} />}
          {justSaved ? 'Saved!' : 'Save Current'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleLoadPreset(preset)}
            className="group relative px-3 py-2.5 rounded-lg text-left transition-all duration-200"
            style={{
              background: selectedId === preset.id
                ? `hsl(${preset.color.h} ${preset.color.s}% ${preset.color.l}% / 0.15)`
                : 'hsl(220 15% 12%)',
              border: selectedId === preset.id
                ? `1px solid hsl(${preset.color.h} ${preset.color.s}% ${preset.color.l}% / 0.4)`
                : '1px solid hsl(220 15% 18%)',
              boxShadow: selectedId === preset.id
                ? `0 0 15px hsl(${preset.color.h} ${preset.color.s}% ${preset.color.l}% / 0.2)`
                : 'none',
            }}
          >
            <div className="flex items-start gap-2">
              <div
                className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
                style={{
                  background: `hsl(${preset.color.h} ${preset.color.s}% ${preset.color.l}%)`,
                  boxShadow: `0 0 8px hsl(${preset.color.h} ${preset.color.s}% ${preset.color.l}% / 0.5)`,
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {preset.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {preset.description}
                </p>
              </div>
            </div>

            {/* Delete button for non-default presets */}
            {!preset.isDefault && (
              <button
                onClick={(e) => handleDeletePreset(preset.id, e)}
                className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'hsl(0 60% 50% / 0.2)',
                  color: 'hsl(0 60% 60%)',
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </button>
        ))}
      </div>

      {presets.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No presets yet. Save your first!
        </p>
      )}
    </div>
  );
};
