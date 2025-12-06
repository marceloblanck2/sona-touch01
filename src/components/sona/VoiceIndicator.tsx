// SØNA Pad v2 - Voice Count Indicator

import React from 'react';
import { MAX_VOICES } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';

interface VoiceIndicatorProps {
  activeVoices: number;
  color: HSLColor;
  showText?: boolean;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  activeVoices,
  color,
  showText = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      {showText ? (
        <span 
          className="text-xs font-mono"
          style={{ 
            color: activeVoices > 0 
              ? `hsl(${color.h} ${color.s}% ${color.l}%)` 
              : 'hsl(220 10% 50%)'
          }}
        >
          Active Voices: {activeVoices} / {MAX_VOICES}
        </span>
      ) : (
        <>
          <span className="text-xs text-muted-foreground font-mono">VOICES</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_VOICES }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-150"
                style={{
                  background: i < activeVoices
                    ? `hsl(${color.h} ${color.s}% ${color.l}%)`
                    : 'hsl(220 15% 20%)',
                  boxShadow: i < activeVoices
                    ? `0 0 8px hsl(${color.h} ${color.s}% ${color.l}% / 0.5)`
                    : 'none',
                  transform: i < activeVoices ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
