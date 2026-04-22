// SØNA Pad v2 - Control Panel Component

import React from 'react';
import { MappingSelector } from './MappingSelector';
import { ModeToggle } from './ModeToggle';
import { ColorPicker } from './ColorPicker';
import { MappingOption, GridMode } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';

interface ControlPanelProps {
  mappingX: MappingOption;
  mappingY: MappingOption;
  mode: GridMode;
  color: HSLColor;
  volume: number;
  trailDuration: number;
  glowSize: number;
  onMappingXChange: (value: MappingOption) => void;
  onMappingYChange: (value: MappingOption) => void;
  onModeChange: (mode: GridMode) => void;
  onColorChange: (color: HSLColor) => void;
  onVolumeChange: (volume: number) => void;
  onTrailDurationChange: (duration: number) => void;
  onGlowSizeChange: (size: number) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

interface InlineStepperProps {
  label: string;
  value: string;
  color: HSLColor;
  onMinus: () => void;
  onPlus: () => void;
}

const InlineStepper: React.FC<InlineStepperProps> = ({
  label,
  value,
  color,
  onMinus,
  onPlus,
}) => {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-[54px] text-right text-[10px] tracking-[0.18em] text-muted-foreground">
        {label}
      </div>

      <button
        type="button"
        onClick={onMinus}
        className="h-7 w-7 rounded-md border text-sm leading-none active:scale-95 transition"
        style={{
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`,
          color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
          background: `hsl(${color.h} ${color.s}% ${color.l}% / 0.05)`,
        }}
        aria-label={`Decrease ${label}`}
      >
        –
      </button>

      <div className="w-12 text-xs text-left text-foreground/90">
        {value}
      </div>

      <button
        type="button"
        onClick={onPlus}
        className="h-7 w-7 rounded-md border text-sm leading-none active:scale-95 transition"
        style={{
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`,
          color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
          background: `hsl(${color.h} ${color.s}% ${color.l}% / 0.05)`,
        }}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  mappingX,
  mappingY,
  mode,
  color,
  volume,
  trailDuration,
  glowSize,
  onMappingXChange,
  onMappingYChange,
  onModeChange,
  onColorChange,
  onVolumeChange,
  onTrailDurationChange,
  onGlowSizeChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Mode
        </label>
        <ModeToggle mode={mode} onChange={onModeChange} color={color} />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Mapping
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 items-center">
          <div>
            <MappingSelector
              axis="X"
              value={mappingX}
              onChange={onMappingXChange}
              color={color}
            />
          </div>

          <InlineStepper
            label="VOLUME"
            value={`${Math.round(volume * 100)}%`}
            color={color}
            onMinus={() => onVolumeChange(clamp(volume - 0.08, 0, 1))}
            onPlus={() => onVolumeChange(clamp(volume + 0.08, 0, 1))}
          />

          <div>
            <MappingSelector
              axis="Y"
              value={mappingY}
              onChange={onMappingYChange}
              color={color}
            />
          </div>

          <div className="space-y-2">
            <InlineStepper
              label="TRAIL"
              value={`${trailDuration.toFixed(1)}s`}
              color={color}
              onMinus={() => onTrailDurationChange(clamp(trailDuration - 0.35, 0.5, 8))}
              onPlus={() => onTrailDurationChange(clamp(trailDuration + 0.35, 0.5, 8))}
            />

            <InlineStepper
              label="SIZE"
              value={`${Math.round(glowSize * 100)}%`}
              color={color}
              onMinus={() => onGlowSizeChange(clamp(glowSize - 0.15, 0.3, 3))}
              onPlus={() => onGlowSizeChange(clamp(glowSize + 0.15, 0.3, 3))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Color
        </label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>
    </div>
  );
};
