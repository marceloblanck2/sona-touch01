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
    <div 
      className="flex rounded-lg p-1 gap-1"
      style={{ 
        background: 'hsl(220 15% 12%)',
        border: '1px solid hsl(220 15% 18%)',
      }}
    >
      <button
        onClick={() => onChange('grid')}
        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200"
        style={{
          background: mode === 'grid' 
            ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.2)` 
            : 'transparent',
          color: mode === 'grid'
            ? `hsl(${color.h} ${color.s}% ${color.l}%)`
            : 'hsl(220 10% 55%)',
          boxShadow: mode === 'grid'
            ? `0 0 20px hsl(${color.h} ${color.s}% ${color.l}% / 0.2)`
            : 'none',
        }}
      >
        <Grid3X3 size={16} />
        <span>Grid</span>
      </button>
      
      <button
        onClick={() => onChange('flow')}
        className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200"
        style={{
          background: mode === 'flow' 
            ? `hsl(${color.h} ${color.s}% ${color.l}% / 0.2)` 
            : 'transparent',
          color: mode === 'flow'
            ? `hsl(${color.h} ${color.s}% ${color.l}%)`
            : 'hsl(220 10% 55%)',
          boxShadow: mode === 'flow'
            ? `0 0 20px hsl(${color.h} ${color.s}% ${color.l}% / 0.2)`
            : 'none',
        }}
      >
        <Waves size={16} />
        <span>Flow</span>
      </button>
    </div>
  );
};
