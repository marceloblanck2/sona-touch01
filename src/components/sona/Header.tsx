// SØNA Touch 01 - Header Component

import React from 'react';
import { HSLColor } from '../../utils/colorUtils';
import { VoiceIndicator } from './VoiceIndicator';
import { StopButton } from './StopButton';

interface HeaderProps {
  activeVoices: number;
  color: HSLColor;
  isInitialized: boolean;
  onStop: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeVoices,
  color,
  isInitialized,
  onStop,
}) => {
  return (
    <header className="flex items-center justify-between py-4 bg-transparent">
      <div className="flex flex-col bg-transparent">
        <h1 
          className="text-2xl font-semibold tracking-tight"
          style={{
            background: `linear-gradient(135deg, hsl(${color.h} ${color.s}% ${color.l}%), hsl(${(color.h + 30) % 360} ${color.s}% ${color.l + 10}%))`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          SØNA Touch 01
        </h1>
        <span 
          className="text-[10px] text-muted-foreground tracking-wide mt-0.5"
          style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
        >
          Prototype Build — Touch-Based Sensory Instrument
        </span>
        <span 
          className="text-[10px] text-muted-foreground tracking-wide"
          style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
        >
          Designed and Engineered by Marcelo Blanck
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

        {/* Stop Button */}
        <StopButton 
          onStop={onStop} 
          color={color} 
          activeVoices={activeVoices}
        />

        {/* Voice Indicator */}
        <VoiceIndicator activeVoices={activeVoices} color={color} />
      </div>
    </header>
  );
};
