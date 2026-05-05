// SØNA Pad v2 - Control Panel Component

import React from 'react';
import { MappingSelector } from './MappingSelector';
import { ModeToggle } from './ModeToggle';
import { ColorPicker } from './ColorPicker';
import { MappingOption, GridMode } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';
import { TonalAxis, ExpressionMode } from '../../audio/AudioEngine';

interface ControlPanelProps {
  mappingX: MappingOption;
  mappingY: MappingOption;
  tonalAxis: TonalAxis;
  expressionMode: ExpressionMode;
  mode: GridMode;
  color: HSLColor;
  volume: number;
  trailDuration: number;
  glowSize: number;
  onMappingXChange: (value: MappingOption) => void;
  onMappingYChange: (value: MappingOption) => void;
  onTonalAxisChange: (axis: TonalAxis) => void;
  onExpressionModeChange: (mode: ExpressionMode) => void;
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
    <div className="grid grid-cols-[72px_32px_52px_32px] items-center gap-2 justify-start">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground text-left">
        {label}
      </div>

      <button
        type="button"
        onClick={onMinus}
        className="h-8 w-8 rounded-md border text-sm leading-none active:scale-95 transition"
        style={{
          borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`,
          color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
          background: `hsl(${color.h} ${color.s}% ${color.l}% / 0.05)`,
        }}
        aria-label={`Decrease ${label}`}
      >
        –
      </button>

      <div className="text-sm text-center text-foreground/90">
        {value}
      </div>

      <button
        type="button"
        onClick={onPlus}
        className="h-8 w-8 rounded-md border text-sm leading-none active:scale-95 transition"
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

interface PillButtonProps {
  active: boolean;
  label: string;
  color: HSLColor;
  onClick: () => void;
}

const PillButton: React.FC<PillButtonProps> = ({
  active,
  label,
  color,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-md border text-[11px] uppercase tracking-[0.12em] transition active:scale-95"
      style={{
        borderColor: active
          ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.65)`
          : `hsl(${color.h} ${color.s}% ${color.l}% / 0.18)`,
        color: active
          ? `hsl(${color.h} ${color.s}% ${color.l}%)`
          : `hsl(${color.h} ${color.s}% ${color.l}% / 0.62)`,
        background: active
          ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.14)`
          : `hsl(${color.h} ${color.s}% ${color.l}% / 0.04)`,
      }}
    >
      {label}
    </button>
  );
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  mappingX,
  mappingY,
  tonalAxis,
  expressionMode,
  mode,
  color,
  volume,
  trailDuration,
  glowSize,
  onMappingXChange,
  onMappingYChange,
  onTonalAxisChange,
  onExpressionModeChange,
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
          Tonal Control
        </label>

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Tonal Axis
          </div>

          <div className="flex flex-wrap gap-2">
            <PillButton
              active={tonalAxis === 'x'}
              label="X"
              color={color}
              onClick={() => onTonalAxisChange('x')}
            />

            <PillButton
              active={tonalAxis === 'y'}
              label="Y"
              color={color}
              onClick={() => onTonalAxisChange('y')}
            />
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Expression
          </div>

          <div className="flex flex-wrap gap-2">
            <PillButton
              active={expressionMode === 'pan'}
              label="Pan"
              color={color}
              onClick={() => onExpressionModeChange('pan')}
            />

            <PillButton
              active={expressionMode === 'intensity'}
              label="Intensity"
              color={color}
              onClick={() => onExpressionModeChange('intensity')}
            />

            <PillButton
              active={expressionMode === 'delay'}
              label="Delay"
              color={color}
              onClick={() => onExpressionModeChange('delay')}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/30">
        <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Free Mapping
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

      <div className="space-y-2 pt-1">
        <InlineStepper
          label="Volume"
          value={`${Math.round(volume * 100)}%`}
          color={color}
          onMinus={() => onVolumeChange(clamp(volume - 0.08, 0, 1))}
          onPlus={() => onVolumeChange(clamp(volume + 0.08, 0, 1))}
        />

        <InlineStepper
          label="Trail"
          value={`${trailDuration.toFixed(1)}s`}
          color={color}
          onMinus={() => onTrailDurationChange(clamp(trailDuration - 0.35, 0.5, 8))}
          onPlus={() => onTrailDurationChange(clamp(trailDuration + 0.35, 0.5, 8))}
        />

        <InlineStepper
          label="Size"
          value={`${Math.round(glowSize * 100)}%`}
          color={color}
          onMinus={() => onGlowSizeChange(clamp(glowSize - 0.15, 0.3, 3))}
          onPlus={() => onGlowSizeChange(clamp(glowSize + 0.15, 0.3, 3))}
        />
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
