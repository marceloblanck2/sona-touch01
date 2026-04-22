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

interface CompactStepperProps {
  label: string;
  value: string;
  color: HSLColor;
  onMinus: () => void;
  onPlus: () => void;
}

const CompactStepper: React.FC<CompactStepperProps> = ({
  label,
  value,
  color,
  onMinus,
  onPlus,
}) => {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-10 text-[10px] tracking-[0.18em] text-muted-foreground text-left">
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

        <MappingSelector
          axis="X"
          value={mappingX}
          onChange={onMappingXChange}
          color={color}
        />

        <MappingSelector
          axis="Y"
          value={mappingY}
          onChange={onMappingYChange}
          color={color}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Color
        </label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>

      <div className="pt-2 border-t border-white/5 space-y-1">
        <CompactStepper
          label="VOL"
          value={`${Math.round(volume * 100)}%`}
          color={color}
          onMinus={() => onVolumeChange(clamp(volume - 0.08, 0, 1))}
          onPlus={() => onVolumeChange(clamp(volume + 0.08, 0, 1))}
        />

        <CompactStepper
          label="TRL"
          value={`${trailDuration.toFixed(1)}s`}
          color={color}
          onMinus={() => onTrailDurationChange(clamp(trailDuration - 0.35, 0.5, 8))}
          onPlus={() => onTrailDurationChange(clamp(trailDuration + 0.35, 0.5, 8))}
        />

        <CompactStepper
          label="SIZ"
          value={`${Math.round(glowSize * 100)}%`}
          color={color}
          onMinus={() => onGlowSizeChange(clamp(glowSize - 0.15, 0.3, 3))}
          onPlus={() => onGlowSizeChange(clamp(glowSize + 0.15, 0.3, 3))}
        />
      </div>
    </div>
  );
};
