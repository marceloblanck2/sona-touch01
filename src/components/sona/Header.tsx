// SØNA Pad v2 - Header Component

import React from 'react';
import { HSLColor } from '../../utils/colorUtils';
import { VoiceIndicator } from './VoiceIndicator';

interface HeaderProps {
  activeVoices: number;
  color: HSLColor;
  isInitialized: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeVoices,
  color,
  isInitialized,
}) => {
  return (
    <header className="flex items-center justify-between py-4">
      <div className="flex items-baseline gap-3">
        <h1 
          className="text-2xl font-semibold tracking-tight"
          style={{
            background: `linear-gradient(135deg, hsl(${color.h} ${color.s}% ${color.l}%), hsl(${(color.h + 30) % 360} ${color.s}% ${color.l + 10}%))`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          SØNA
        </h1>
        <span className="text-xs font-mono text-muted-foreground tracking-wider">
          Pad v2
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isInitialized
                ? `hsl(${color.h} ${color.s}% ${color.l}%)`
                : 'hsl(220 10% 40%)',
              boxShadow: isInitialized
                ? `0 0 10px hsl(${color.h} ${color.s}% ${color.l}% / 0.5)`
                : 'none',
            }}
          />
          <span className="text-xs text-muted-foreground">
            {isInitialized ? '432 Hz' : 'Ready'}
          </span>
        </div>

        <VoiceIndicator activeVoices={activeVoices} color={color} />
      </div>
    </header>
  );
};
