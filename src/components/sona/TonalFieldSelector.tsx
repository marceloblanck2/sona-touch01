// SØNA Touch 01 — Tonal Field Selector
// Seleciona o campo perceptual tonal ativo.
// "O preset não escolhe uma escala. O preset define como o espaço se comporta."

import React from 'react';
import { TonalField, MUSICAL_PRESETS } from '../../audio/scales/MUSICAL_PRESETS';
import { HSLColor } from '../../utils/colorUtils';

interface TonalFieldSelectorProps {
  currentField: TonalField | null;
  onSelect: (field: TonalField | null) => void;
  accentColor: HSLColor;
}

// Small dot indicator per preset
const FIELD_COLORS: Record<string, string> = {
  'tonal-free':       'hsl(220 40% 55%)',
  'tonal-a-minor':    'hsl(240 55% 50%)',
  'tonal-c-major':    'hsl(55 70% 60%)',
  'tonal-d-harmonic': 'hsl(0 60% 42%)',
};

export const TonalFieldSelector: React.FC<TonalFieldSelectorProps> = ({
  currentField,
  onSelect,
  accentColor,
}) => {
  const handleSelect = (preset: TonalField) => {
    // If already selected, deactivate (back to free chromatic)
    if (currentField?.id === preset.id && preset.id === 'tonal-free') {
      onSelect(null);
    } else {
      onSelect(preset);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Campo Tonal</h3>
        {currentField && currentField.id !== 'tonal-free' && (
          <span
            className="text-[10px] tracking-wider uppercase"
            style={{ color: `hsl(${accentColor.h} ${accentColor.s}% ${accentColor.l}%)` }}
          >
            {currentField.emotionalCharacter}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MUSICAL_PRESETS.map((preset) => {
          const isActive = currentField?.id === preset.id;
          const dotColor = FIELD_COLORS[preset.id] ?? 'hsl(220 40% 55%)';

          return (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset)}
              className="relative px-3 py-2.5 rounded-lg text-left transition-all duration-200"
              style={{
                background: isActive
                  ? `${dotColor.replace('hsl(', 'hsl(').replace(')', ' / 0.12)')}`
                  : 'hsl(220 15% 12%)',
                border: isActive
                  ? `1px solid ${dotColor.replace(')', ' / 0.45)')}`
                  : '1px solid hsl(220 15% 18%)',
                boxShadow: isActive
                  ? `0 0 14px ${dotColor.replace(')', ' / 0.18)')}`
                  : 'none',
              }}
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0"
                  style={{
                    background: dotColor,
                    boxShadow: isActive ? `0 0 6px ${dotColor}` : 'none',
                    opacity: isActive ? 1 : 0.5,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-tight truncate">
                    {preset.name.split('—')[0].trim()}
                  </p>
                  {preset.name.includes('—') && (
                    <p
                      className="text-[10px] mt-0.5 truncate"
                      style={{
                        color: isActive
                          ? dotColor
                          : 'hsl(220 15% 50%)',
                      }}
                    >
                      {preset.name.split('—')[1].trim()}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        Gesto lento → notas definidas · Gesto rápido → glissando
      </p>
    </div>
  );
};
