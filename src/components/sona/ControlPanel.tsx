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

export const ControlPanel: React.FC<ControlPanelProps> = ({
  mappingX,
  mappingY,
  mode,
  color,
  onMappingXChange,
  onMappingYChange,
  onModeChange,
  onColorChange,
}) => {
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
          Mode
        </label>
        <ModeToggle mode={mode} onChange={onModeChange} color={color} />
      </div>

      <div className="space-y-3">
        <label className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
          Mapping
        </label>

        <div className="space-y-3">
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
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
          Color
        </label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>

      <div
        className="rounded-2xl border px-4 py-4"
        style={{
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.10)`,
          background: `linear-gradient(
            180deg,
            hsl(${color.h} ${color.s}% ${color.l}% / 0.05) 0%,
            transparent 100%
          )`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Pad Controls
        </div>

        <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
          <p>Glow, trail e volume agora são ajustados pelos botões no próprio pad.</p>
          <p>No touch isso fica mais rápido e mais preciso do que sliders.</p>
        </div>
      </div>
    </div>
  );
};
