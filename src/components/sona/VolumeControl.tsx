// SØNA Pad v2 - Volume Control Component

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { HSLColor } from '../../utils/colorUtils';
import { Slider } from '../ui/slider';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
  color: HSLColor;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  onChange,
  color,
}) => {
  const isMuted = volume === 0;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(isMuted ? 0.5 : 0)}
        className="p-1.5 rounded transition-colors"
        style={{
          color: isMuted 
            ? 'hsl(220 10% 45%)'
            : `hsl(${color.h} ${color.s}% ${color.l}%)`,
        }}
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      
      <div className="flex-1">
        <Slider
          value={[volume * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => onChange(v / 100)}
          className="cursor-pointer"
          style={{
            '--slider-track-bg': 'hsl(220 15% 18%)',
            '--slider-range-bg': `hsl(${color.h} ${color.s}% ${color.l}%)`,
            '--slider-thumb-bg': `hsl(${color.h} ${color.s}% ${color.l}%)`,
          } as React.CSSProperties}
        />
      </div>
      
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
};
