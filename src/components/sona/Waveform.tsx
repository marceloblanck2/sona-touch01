// SØNA Pad v2 - Waveform Visualizer Component

import React, { useRef, useEffect } from 'react';
import { HSLColor } from '../../utils/colorUtils';
import { PHI } from '../../utils/constants';

interface WaveformProps {
  data: Float32Array;
  color: HSLColor;
  height?: number;
}

export const Waveform: React.FC<WaveformProps> = ({
  data,
  color,
  height = 80,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw waveform
    if (data.length === 0) {
      // Draw flat line when no data
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.3)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    const sliceWidth = rect.width / data.length;
    const centerY = rect.height / 2;
    const amplitude = (rect.height / 2) * 0.9;

    // Background glow
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.05)`);
    gradient.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.15)`);
    gradient.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.05)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Main waveform
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let i = 0; i < data.length; i++) {
      const x = i * sliceWidth;
      const y = centerY + data[i] * amplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Create gradient stroke
    const strokeGradient = ctx.createLinearGradient(0, 0, rect.width, 0);
    strokeGradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.4)`);
    strokeGradient.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.8)`);
    strokeGradient.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.4)`);

    ctx.strokeStyle = strokeGradient;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Glow effect
    ctx.shadowColor = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.5)`;
    ctx.shadowBlur = 10;
    ctx.stroke();

  }, [data, color, height]);

  return (
    <div 
      className="w-full rounded-lg overflow-hidden"
      style={{ 
        height,
        background: 'linear-gradient(135deg, hsl(220 20% 8%) 0%, hsl(220 18% 10%) 100%)',
        border: '1px solid hsl(220 15% 18%)',
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
