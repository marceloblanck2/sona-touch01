// SØM Touch - Compact Controls for Fullscreen Mode
// Minimal sliders for live performance — volume, trail, size

import React from 'react';
import { HSLColor } from '../../utils/colorUtils';
import { Slider } from '../ui/slider';
import { ModeToggle } from './ModeToggle';
import { GridMode, MappingOption, MAPPING_OPTIONS } from '../../utils/constants';
import { Volume2, Brush, Circle, Minimize2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface FullscreenControlsProps {
  color: HSLColor;
  gridMode: GridMode;
  volume: number;
  trailDuration: number;
  glowSize: number;
  mappingX: MappingOption;
  mappingY: MappingOption;
  onModeChange: (mode: GridMode) => void;
  onVolumeChange: (v: number) => void;
  onTrailChange: (d: number) => void;
  onSizeChange: (s: number) => void;
  onMappingXChange: (v: MappingOption) => void;
  onMappingYChange: (v: MappingOption) => void;
  onExit: () => void;
  isLandscape: boolean;
}

export const FullscreenControls: React.FC<FullscreenControlsProps> = ({
  color,
  gridMode,
  volume,
  trailDuration,
  glowSize,
  mappingX,
  mappingY,
  onModeChange,
  onVolumeChange,
  onTrailChange,
  onSizeChange,
  onMappingXChange,
  onMappingYChange,
  onExit,
  isLandscape,
}) => {
  const accentColor = `hsl(${color.h} ${color.s}% ${color.l}%)`;
  const sliderStyle = {
    '--slider-track-bg': 'hsl(220 15% 15%)',
    '--slider-range-bg': accentColor,
    '--slider-thumb-bg': accentColor,
  } as React.CSSProperties;

  const CompactSlider = ({ icon, value, min, max, step, onChange, label }: {
    icon: React.ReactNode; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; label: string;
  }) => (
    <div className={`flex items-center gap-2 ${isLandscape ? '' : 'flex-1 min-w-[140px]'}`}>
      <span className="text-muted-foreground" style={{ color: accentColor }}>{icon}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="cursor-pointer flex-1"
        style={sliderStyle}
      />
      <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{label}</span>
    </div>
  );

  const CompactMapping = ({ axis, value, onChange }: {
    axis: string; value: MappingOption; onChange: (v: MappingOption) => void;
  }) => (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] font-medium" style={{ color: accentColor }}>{axis}→</span>
      <Select value={value} onValueChange={(v) => onChange(v as MappingOption)}>
        <SelectTrigger 
          className="h-7 w-[100px] bg-background/30 border-border/30 text-foreground text-[10px] px-2"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {MAPPING_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Portrait: horizontal bar at bottom
  // Landscape: vertical bar on the left
  return (
    <div className={`flex ${isLandscape ? 'flex-col h-full w-48 p-3' : 'flex-row flex-wrap items-center w-full p-3'} gap-3 bg-background/40 backdrop-blur-sm`}
      style={{ borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.15)` }}
    >
      {/* Mode buttons */}
      <div className={`flex gap-1.5 ${isLandscape ? '' : ''}`}>
        <button
          onClick={() => onModeChange('grid')}
          className="px-2.5 py-1.5 rounded text-[10px] font-medium transition-all"
          style={{
            background: gridMode === 'grid' ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)` : 'hsl(220 15% 12%)',
            color: gridMode === 'grid' ? accentColor : 'hsl(220 10% 50%)',
            border: gridMode === 'grid' ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)` : '1px solid hsl(220 15% 18%)',
          }}
        >
          Grid
        </button>
        <button
          onClick={() => onModeChange('flow')}
          className="px-2.5 py-1.5 rounded text-[10px] font-medium transition-all"
          style={{
            background: gridMode === 'flow' ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)` : 'hsl(220 15% 12%)',
            color: gridMode === 'flow' ? accentColor : 'hsl(220 10% 50%)',
            border: gridMode === 'flow' ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)` : '1px solid hsl(220 15% 18%)',
          }}
        >
          Flow
        </button>
      </div>

      {/* Mappings */}
      <div className={`flex ${isLandscape ? 'flex-col' : ''} gap-1.5`}>
        <CompactMapping axis="X" value={mappingX} onChange={onMappingXChange} />
        <CompactMapping axis="Y" value={mappingY} onChange={onMappingYChange} />
      </div>

      {/* Sliders */}
      <div className={`flex ${isLandscape ? 'flex-col flex-1' : 'flex-row flex-1 flex-wrap'} gap-2`}>
        <CompactSlider
          icon={<Volume2 size={14} />}
          value={volume * 100} min={0} max={100} step={1}
          onChange={(v) => onVolumeChange(v / 100)}
          label={`${Math.round(volume * 100)}%`}
        />
        <CompactSlider
          icon={<Brush size={14} />}
          value={trailDuration * 10} min={0} max={100} step={5}
          onChange={(v) => onTrailChange(v / 10)}
          label={trailDuration === 0 ? 'Off' : `${trailDuration.toFixed(1)}s`}
        />
        <CompactSlider
          icon={<Circle size={14} />}
          value={glowSize * 100} min={20} max={300} step={10}
          onChange={(v) => onSizeChange(v / 100)}
          label={`${Math.round(glowSize * 100)}%`}
        />
      </div>

      {/* Exit button */}
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-background/30 hover:bg-background/50 transition-colors"
        style={{ color: accentColor }}
      >
        <Minimize2 size={14} />
        <span className="text-[10px] font-medium">Exit</span>
      </button>
    </div>
  );
};
