// SØNA Pad v2 - Global Stop Button

import React from 'react';
import { Square } from 'lucide-react';
import { HSLColor } from '../../utils/colorUtils';

interface StopButtonProps {
  onStop: () => void;
  color: HSLColor;
  activeVoices: number;
}

export const StopButton: React.FC<StopButtonProps> = ({
  onStop,
  color,
  activeVoices,
}) => {
  const hasActiveAudio = activeVoices > 0;

  return (
    <button
      onClick={onStop}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
      style={{
        background: hasActiveAudio 
          ? 'hsl(0 70% 50% / 0.2)' 
          : 'hsl(220 15% 12%)',
        color: hasActiveAudio
          ? 'hsl(0 70% 65%)'
          : 'hsl(220 10% 45%)',
        border: hasActiveAudio
          ? '1px solid hsl(0 70% 50% / 0.4)'
          : '1px solid hsl(220 15% 18%)',
        boxShadow: hasActiveAudio
          ? '0 0 15px hsl(0 70% 50% / 0.2)'
          : 'none',
      }}
      title="Stop all sound"
    >
      <Square size={14} fill={hasActiveAudio ? 'currentColor' : 'none'} />
      <span>Stop</span>
    </button>
  );
};
