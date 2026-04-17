// SØM Touch - Glow & Trail Size Control

import React from 'react';
import { Circle } from 'lucide-react';
import { HSLColor } from '../../utils/colorUtils';
import { Slider } from '../ui/slider';

interface SizeControlProps {
  size: number;        // 0.2 to 3.0 multiplier
  onChange: (size: number) => void;
  color: HSLColor;
}

export const SizeControl: React.FC<SizeControlProps> = ({
  size,
  onChange,
  color,
}) => {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(1.0)}
        className="p-1.5 rounded transition-colors"
        style={{
          color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
        }}
      >
        <Circle size={18} />
      </button>

      <div className="flex-1">
        <Slider
          value={[size * 100]}
          min={20}
          max={300}
          step={10}
          onValueChange={([v]) => onChange(v / 100)}
          className="cursor-pointer"
          style={{
            '--slider-track-bg': 'hsl(220 15% 18%)',
            '--slider-range-bg': `hsl(${color.h} ${color.s}% ${color.l}%)`,
            '--slider-thumb-bg': `hsl(${color.h} ${color.s}% ${color.l}%)`,
          } as React.CSSProperties}
        />
      </div>

      <span className="text-xs font-mono text-muted-foreground w-10 text-right">
        {Math.round(size * 100)}%
      </span>
    </div>
  );
};
