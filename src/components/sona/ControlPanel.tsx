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

interface StepperControlProps {
  label: string;
  valueText: string;
  color: HSLColor;
  onMinus: () => void;
  onPlus: () => void;
}

const StepperControl: React.FC<StepperControlProps> = ({
  label,
  valueText,
  color,
  onMinus,
  onPlus,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </label>

      <div
        className="flex items-center gap-3 rounded-xl border px-3 py-3"
        style={{
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.22)`,
          background: 'hsl(220 18% 10% / 0.72)',
          boxShadow: `inset 0 1px 0 hsl(${color.h} ${color.s}% ${color.l}% / 0.04)`,
        }}
      >
        <button
          type="button"
          onClick={onMinus}
          className="h-10 w-10 shrink-0 rounded-lg border text-lg transition active:scale-95"
          style={{
            color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
            borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.28)`,
            background: `hsl(${color.h} ${color.s}% ${color.l}% / 0.06)`,
          }}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground/90">{valueText}</div>
        </div>

        <button
          type="button"
          onClick={onPlus}
          className="h-10 w-10 shrink-0 rounded-lg border text-lg transition active:scale-95"
          style={{
            color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
            borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.28)`,
            background: `hsl(${color.h} ${color.s}% ${color.l}% / 0.06)`,
          }}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
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
  const volumePct = `${Math.round(volume * 100)}%`;
  const trailText = `${trailDuration.toFixed(1)}s`;
  const glowText = `${Math.round(glowSize * 100)}%`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Mode</label>
        <ModeToggle mode={mode} onChange={onModeChange} color={color} />
      </div>

      <div className="space-y-3">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Mapping</label>
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

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Color</label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>

      <StepperControl
        label="Volume"
        valueText={volumePct}
        color={color}
        onMinus={() => onVolumeChange(clamp(volume - 0.08, 0, 1))}
        onPlus={() => onVolumeChange(clamp(volume + 0.08, 0, 1))}
      />

      <StepperControl
        label="Trail"
        valueText={trailText}
        color={color}
        onMinus={() => onTrailDurationChange(clamp(trailDuration - 0.35, 0.5, 8))}
        onPlus={() => onTrailDurationChange(clamp(trailDuration + 0.35, 0.5, 8))}
      />

      <StepperControl
        label="Size"
        valueText={glowText}
        color={color}
        onMinus={() => onGlowSizeChange(clamp(glowSize - 0.15, 0.3, 3))}
        onPlus={() => onGlowSizeChange(clamp(glowSize + 0.15, 0.3, 3))}
      />
    </div>
  );
};
