// SØNA Pad v2 - Grid/Flow Mode Toggle Component

import React from 'react';
import { GridMode } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';
import { Grid3X3, Waves } from 'lucide-react';

interface ModeToggleProps {
  mode: GridMode;
  onChange: (mode: GridMode) => void;
  color: HSLColor;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  mode,
  onChange,
  color,
}) => {
  return (
    <div className="space-y-3">
      {/* Grid Mode */}
      <div className="space-y-1.5">
        <button
          onClick={() => onChange('grid')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: mode === 'grid' 
              ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.2)` 
              : 'hsl(220 15% 12%)',
            color: mode === 'grid'
              ? `hsl(${color.h} ${color.s}% ${color.l}%)`
              : 'hsl(220 10% 55%)',
            border: mode === 'grid'
              ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)`
              : '1px solid hsl(220 15% 18%)',
            boxShadow: mode === 'grid'
              ? `0 0 20px hsl(${color.h} ${color.s}% ${color.l}% / 0.2)`
              : 'none',
          }}
        >
          <Grid3X3 size={18} />
          <span>Grid</span>
        </button>
        <p 
          className="text-xs px-2 leading-relaxed"
          style={{ color: 'hsl(220 10% 50%)' }}
        >
          Divided into regions. Each area has its own sonic character.
        </p>
      </div>

      {/* Flow Mode */}
      <div className="space-y-1.5">
        <button
          onClick={() => onChange('flow')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: mode === 'flow' 
              ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.2)` 
              : 'hsl(220 15% 12%)',
            color: mode === 'flow'
              ? `hsl(${color.h} ${color.s}% ${color.l}%)`
              : 'hsl(220 10% 55%)',
            border: mode === 'flow'
              ? `1px solid hsl(${color.h} ${color.s}% ${color.l}% / 0.4)`
              : '1px solid hsl(220 15% 18%)',
            boxShadow: mode === 'flow'
              ? `0 0 20px hsl(${color.h} ${color.s}% ${color.l}% / 0.2)`
              : 'none',
          }}
        >
          <Waves size={18} />
          <span>Flow</span>
        </button>
        <p 
          className="text-xs px-2 leading-relaxed"
          style={{ color: 'hsl(220 10% 50%)' }}
        >
          Fluid and expressive. The sound reacts to movement.
        </p>
      </div>
    </div>
  );
};
