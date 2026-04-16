// SØNA Touch 01 - Trail Duration Control
// Slider to adjust how long gesture trails persist on the pad

import React from 'react';
import { Brush, BrushIcon } from 'lucide-react';
import { HSLColor } from '../../utils/colorUtils';
import { Slider } from '../ui/slider';

interface TrailControlProps {
  duration: number;     // 0-10 seconds
  onChange: (duration: number) => void;
  color: HSLColor;
}

export const TrailControl: React.FC<TrailControlProps> = ({
  duration,
  onChange,
  color,
}) => {
  const isOff = duration === 0;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(isOff ? 3 : 0)}
        className="p-1.5 rounded transition-colors"
        style={{
          color: isOff
            ? 'hsl(220 10% 45%)'
            : `hsl(${color.h} ${color.s}% ${color.l}%)`,
        }}
      >
        <Brush size={18} />
      </button>

      <div className="flex-1">
        <Slider
          value={[duration * 10]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => onChange(v / 10)}
          className="cursor-pointer"
          style={{
            '--slider-track-bg': 'hsl(220 15% 18%)',
            '--slider-range-bg': `hsl(${color.h} ${color.s}% ${color.l}%)`,
            '--slider-thumb-bg': `hsl(${color.h} ${color.s}% ${color.l}%)`,
          } as React.CSSProperties}
        />
      </div>

      <span className="text-xs font-mono text-muted-foreground w-8 text-right">
        {duration === 0 ? 'Off' : `${duration.toFixed(1)}s`}
      </span>
    </div>
  );
};
