// SØM Touch - Compact Controls for Fullscreen Mode
// Minimal sliders for live performance — volume, trail, size

import React from 'react';
import { HSLColor } from '../../utils/colorUtils';
import { Slider } from '../ui/slider';
import { GridMode, MappingOption, MAPPING_OPTIONS } from '../../utils/constants';
import { Volume2, Brush, Circle, Minimize2 } from 'lucide-react';

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

  const stopPadCapture = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const CompactSlider = ({
    icon,
    value,
    min,
    max,
    step,
    onChange,
    label,
  }: {
    icon: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    label: string;
  }) => (
    <div
      className={`flex items-center gap-2 ${isLandscape ? '' : 'flex-1 min-w-[140px]'}`}
      onPointerDown={stopPadCapture}
      onTouchStart={stopPadCapture}
    >
      <span className="text-muted-foreground shrink-0" style={{ color: accentColor }}>
        {icon}
      </span>

      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="cursor-pointer flex-1 touch-manipulation"
        style={sliderStyle}
      />

      <span className="text-[10px] font-mono text-muted-foreground w-9 text-right shrink-0">
        {label}
      </span>
    </div>
  );

  const CompactMapping = ({
    axis,
    value,
    onChange,
  }: {
    axis: string;
    value: MappingOption;
    onChange: (v: MappingOption) => void;
  }) => (
    <div
      className="flex items-center gap-1.5"
      onPointerDown={stopPadCapture}
      onTouchStart={stopPadCapture}
    >
      <span
        className="font-mono text-[10px] font-medium shrink-0"
        style={{ color: accentColor }}
      >
        {axis}→
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MappingOption)}
        className="h-8 w-[110px] rounded bg-black/30 border border-white/10 text-[11px] px-2 outline-none touch-manipulation"
        style={{ color: accentColor }}
      >
        {MAPPING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="text-black">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  const handleModePointer = (mode: GridMode) => (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onModeChange(mode);
  };

  const handleExitPointer = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onExit();
  };

  return (
    <div
      className={`relative flex ${
        isLandscape
          ? 'flex-col h-full w-52 p-3 pr-3 pt-16'
          : 'flex-row flex-wrap items-center w-full p-3 pt-14'
      } gap-3 bg-background/40 backdrop-blur-sm pointer-events-auto touch-manipulation`}
      style={{
        borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.15)`,
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={stopPadCapture}
      onTouchStart={stopPadCapture}
    >
      {/* Exit button fixed inside controls */}
      <button
        type="button"
        onPointerDown={handleExitPointer}
        onTouchStart={handleExitPointer}
        className={`absolute z-50 flex items-center gap-1.5 px-3 py-2 rounded bg-background/50 hover:bg-background/70 transition-colors touch-manipulation ${
          isLandscape ? 'top-3 left-3' : 'top-3 right-3'
        }`}
        style={{
          color: accentColor,
          minWidth: 44,
          minHeight: 44,
        }}
      >
        <Minimize2 size={14} />
        <span className="text-[10px] font-medium">Exit</span>
      </button>

      {/* Mode buttons */}
      <div className="flex gap-1.5" onPointerDown={stopPadCapture} onTouchStart={stopPadCapture}>
        <button
          type="button"
          onPointerDown={handleModePointer('grid')}
          onTouchStart={handleModePointer('grid')}
          className="px-3 py-2 rounded text-[11px] font-medium transition-all touch-manipulation"
          style={{
            minWidth: 44,
            minHeight: 44,
            background:
              gridMode === 'grid'
                ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`
                : 'hsl(220 15% 12%)',
            color: gridMode === 'grid' ? accentColor : 'hsl(220 10% 50%)',
            border:
              gridMode === 'grid'
                ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)`
                : '1px solid hsl(220 15% 18%)',
          }}
        >
          Grid
        </button>

        <button
          type="button"
          onPointerDown={handleModePointer('flow')}
          onTouchStart={handleModePointer('flow')}
          className="px-3 py-2 rounded text-[11px] font-medium transition-all touch-manipulation"
          style={{
            minWidth: 44,
            minHeight: 44,
            background:
              gridMode === 'flow'
                ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`
                : 'hsl(220 15% 12%)',
            color: gridMode === 'flow' ? accentColor : 'hsl(220 10% 50%)',
            border:
              gridMode === 'flow'
                ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)`
                : '1px solid hsl(220 15% 18%)',
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
          value={volume * 100}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onVolumeChange(v / 100)}
          label={`${Math.round(volume * 100)}%`}
        />

        <CompactSlider
          icon={<Brush size={14} />}
          value={trailDuration * 10}
          min={0}
          max={100}
          step={5}
          onChange={(v) => onTrailChange(v / 10)}
          label={trailDuration === 0 ? 'Off' : `${trailDuration.toFixed(1)}s`}
        />

        <CompactSlider
          icon={<Circle size={14} />}
          value={glowSize * 100}
          min={20}
          max={300}
          step={10}
          onChange={(v) => onSizeChange(v / 100)}
          label={`${Math.round(glowSize * 100)}%`}
        />
      </div>
    </div>
  );
};
