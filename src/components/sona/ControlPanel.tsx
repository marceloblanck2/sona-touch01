// SØNA Pad v2 - Control Panel Component

import React from 'react';
import { MappingSelector } from './MappingSelector';
import { ModeToggle } from './ModeToggle';
import { ColorPicker } from './ColorPicker';
import { VolumeControl } from './VolumeControl';
import { TrailControl } from './TrailControl';
import { SizeControl } from './SizeControl';
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
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Mode</label>
        <ModeToggle mode={mode} onChange={onModeChange} color={color} />
      </div>

      {/* XY Mapping */}
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

      {/* Color Picker */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Color</label>
        <ColorPicker color={color} onChange={onColorChange} />
      </div>

      {/* Volume */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Volume</label>
        <VolumeControl volume={volume} onChange={onVolumeChange} color={color} />
      </div>

      {/* Trail Duration */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Trail</label>
        <TrailControl duration={trailDuration} onChange={onTrailDurationChange} color={color} />
      </div>

      {/* Glow & Trail Size */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Size</label>
        <SizeControl size={glowSize} onChange={onGlowSizeChange} color={color} />
      </div>
    </div>
  );
};
