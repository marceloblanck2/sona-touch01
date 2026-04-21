import React from 'react';
import { HSLColor } from '../../utils/colorUtils';
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

const VOLUME_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const TRAIL_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7];
const SIZE_STEPS = [
  0.15, 0.3, 0.45, 0.6, 0.75,
  1, 1.15, 1.3, 1.45, 1.6,
  1.75, 1.9, 2.05, 2.2, 2.35,
  2.5, 2.65, 2.8, 3,
];

const getClosestStepIndex = (value: number, steps: number[]) => {
  let closestIndex = 0;
  let minDiff = Infinity;

  steps.forEach((step, index) => {
    const diff = Math.abs(step - value);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = index;
    }
  });

  return closestIndex;
};

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

  const stopAll = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const renderStepControl = ({
    icon,
    label,
    value,
    steps,
    onChange,
    formatValue,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    steps: number[];
    onChange: (v: number) => void;
    formatValue: (v: number) => string;
  }) => {
    const index = getClosestStepIndex(value, steps);
    const canDecrease = index > 0;
    const canIncrease = index < steps.length - 1;

    return (
      <div
        className={`flex items-center gap-2 ${isLandscape ? '' : 'w-full'}`}
        onPointerDown={stopAll}
      >
        <span className="shrink-0" style={{ color: accentColor }}>
          {icon}
        </span>

        <span className="w-10 text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>

        <button
          type="button"
          onPointerDown={(e) => {
            stopAll(e);
            if (canDecrease) onChange(steps[index - 1]);
          }}
          className="h-8 w-8 rounded-md border text-sm shrink-0"
          style={{
            color: canDecrease ? accentColor : 'hsl(220 10% 40%)',
            borderColor: canDecrease
              ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.35)`
              : 'hsl(220 15% 18%)',
            background: 'hsl(220 15% 12%)',
          }}
        >
          −
        </button>

        <div
          className="flex-1 min-w-[52px] text-center text-[11px] font-mono"
          style={{ color: accentColor }}
        >
          {formatValue(steps[index])}
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            stopAll(e);
            if (canIncrease) onChange(steps[index + 1]);
          }}
          className="h-8 w-8 rounded-md border text-sm shrink-0"
          style={{
            color: canIncrease ? accentColor : 'hsl(220 10% 40%)',
            borderColor: canIncrease
              ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.35)`
              : 'hsl(220 15% 18%)',
            background: 'hsl(220 15% 12%)',
          }}
        >
          +
        </button>
      </div>
    );
  };

  const renderMappingSelect = (
    axis: 'X' | 'Y',
    value: MappingOption,
    onChange: (v: MappingOption) => void
  ) => (
    <div className="flex items-center gap-2 w-full" onPointerDown={stopAll}>
      <span
        className="w-7 font-mono text-[11px] font-medium shrink-0"
        style={{ color: accentColor }}
      >
        {axis}→
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MappingOption)}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-8 min-w-0 flex-1 rounded-md border px-2 text-[12px] bg-transparent"
        style={{
          color: accentColor,
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`,
          background: 'hsl(220 15% 12%)',
        }}
      >
        {MAPPING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ color: '#111' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className="relative h-full w-full overflow-y-auto overflow-x-hidden flex flex-col gap-2 bg-background/40 backdrop-blur-sm p-2 pt-10"
      style={{
        borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.15)`,
        WebkitOverflowScrolling: 'touch',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onPointerDown={(e) => {
          stopAll(e);
          onExit();
        }}
        className={`absolute top-2 z-30 flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] ${
          isLandscape ? 'left-2' : 'right-2'
        }`}
        style={{
          color: accentColor,
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`,
          background: 'hsl(220 15% 12% / 0.9)',
        }}
      >
        <Minimize2 size={13} />
        <span>Exit</span>
      </button>

      <div className={`flex gap-2 ${isLandscape ? 'pr-0' : 'pr-16'}`} onPointerDown={stopAll}>
        <button
          type="button"
          onPointerDown={(e) => {
            stopAll(e);
            onModeChange('grid');
          }}
          className="h-8 px-3 rounded-md text-[11px] font-medium transition-all"
          style={{
            background:
              gridMode === 'grid'
                ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`
                : 'hsl(220 15% 12%)',
            color: gridMode === 'grid' ? accentColor : 'hsl(220 10% 60%)',
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
          onPointerDown={(e) => {
            stopAll(e);
            onModeChange('flow');
          }}
          className="h-8 px-3 rounded-md text-[11px] font-medium transition-all"
          style={{
            background:
              gridMode === 'flow'
                ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`
                : 'hsl(220 15% 12%)',
            color: gridMode === 'flow' ? accentColor : 'hsl(220 10% 60%)',
            border:
              gridMode === 'flow'
                ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)`
                : '1px solid hsl(220 15% 18%)',
          }}
        >
          Flow
        </button>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {renderMappingSelect('X', mappingX, onMappingXChange)}
        {renderMappingSelect('Y', mappingY, onMappingYChange)}
      </div>

      <div className="flex flex-col gap-2 w-full pb-6">
        {renderStepControl({
          icon: <Volume2 size={15} />,
          label: 'Vol',
          value: volume,
          steps: VOLUME_STEPS,
          onChange: onVolumeChange,
          formatValue: (v) => `${Math.round(v * 100)}%`,
        })}

        {renderStepControl({
          icon: <Brush size={15} />,
          label: 'Trail',
          value: trailDuration,
          steps: TRAIL_STEPS,
          onChange: onTrailChange,
          formatValue: (v) => (v === 0 ? 'Off' : `${v.toFixed(v % 1 === 0 ? 0 : 1)}s`),
        })}

        {renderStepControl({
          icon: <Circle size={15} />,
          label: 'Size',
          value: glowSize,
          steps: SIZE_STEPS,
          onChange: onSizeChange,
          formatValue: (v) => `${Math.round(v * 100)}%`,
        })}
      </div>
    </div>
  );
};
