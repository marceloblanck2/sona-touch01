// SØNA Pad v2 - XY Pad Component with Multitouch Support

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { PHI, GRID_3x3 } from '../../utils/constants';
import { GridMode } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

interface XYPadProps {
  gridMode: GridMode;
  color: HSLColor;
  onTouchStart: (id: number, x: number, y: number) => void;
  onTouchMove: (id: number, x: number, y: number) => void;
  onTouchEnd: (id: number) => void;
  onInteractionStart: () => void;
}

export const XYPad: React.FC<XYPadProps> = ({
  gridMode,
  color,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onInteractionStart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchPoints, setTouchPoints] = useState<Map<number, TouchPoint>>(new Map());
  const [isActive, setIsActive] = useState(false);
  const hasInteracted = useRef(false);

  // Get normalized coordinates from event
  const getNormalizedCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    
    return { x, y };
  }, []);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      onInteractionStart();
    }
    
    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);
    const id = e.pointerId;
    
    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });
    
    setIsActive(true);
    onTouchStart(id, x, y);
    
    // Capture pointer for tracking outside element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [getNormalizedCoords, onTouchStart, onInteractionStart]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;
    
    if (!touchPoints.has(id)) return;
    
    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);
    
    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });
    
    onTouchMove(id, x, y);
  }, [getNormalizedCoords, onTouchMove, touchPoints]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;
    
    setTouchPoints(prev => {
      const next = new Map(prev);
      next.delete(id);
      if (next.size === 0) setIsActive(false);
      return next;
    });
    
    onTouchEnd(id);
  }, [onTouchEnd]);

  // Render grid lines
  const renderGrid = () => {
    if (gridMode !== 'grid') return null;

    const lines = [];
    const gridSize = GRID_3x3;
    
    // Golden ratio based spacing
    for (let i = 1; i < gridSize; i++) {
      const pos = (i / gridSize) * 100;
      
      // Vertical lines
      lines.push(
        <line
          key={`v-${i}`}
          x1={`${pos}%`}
          y1="0"
          x2={`${pos}%`}
          y2="100%"
          className="sona-grid-line"
          style={{ opacity: 0.3 }}
        />
      );
      
      // Horizontal lines
      lines.push(
        <line
          key={`h-${i}`}
          x1="0"
          y1={`${pos}%`}
          x2="100%"
          y2={`${pos}%`}
          className="sona-grid-line"
          style={{ opacity: 0.3 }}
        />
      );
    }

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {lines}
      </svg>
    );
  };

  // Render touch points
  const renderTouchPoints = () => {
    return Array.from(touchPoints.values()).map(point => {
      const size = 60 + Math.sin(Date.now() / 500) * 10;
      
      return (
        <div
          key={point.id}
          className="touch-point animate-pulse-glow"
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            width: size,
            height: size,
            '--synth-hue': color.h,
          } as React.CSSProperties}
        />
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-lg overflow-hidden touch-none select-none cursor-crosshair"
      style={{
        background: `
          radial-gradient(circle at 50% 50%, hsl(${color.h} ${color.s}% ${color.l}% / 0.1) 0%, transparent 50%),
          linear-gradient(135deg, hsl(220 20% 8%) 0%, hsl(220 18% 12%) 100%)
        `,
        boxShadow: isActive 
          ? `inset 0 0 60px hsl(${color.h} ${color.s}% ${color.l}% / 0.2), 0 0 40px hsl(${color.h} ${color.s}% ${color.l}% / 0.15)` 
          : 'inset 0 2px 10px hsl(220 30% 3% / 0.5)',
        transition: 'box-shadow 0.3s ease',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Grid overlay */}
      {renderGrid()}
      
      {/* Touch points */}
      {renderTouchPoints()}
      
      {/* Center crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="w-px h-8 opacity-20"
          style={{ background: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="h-px w-8 opacity-20"
          style={{ background: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
        />
      </div>
      
      {/* Mode indicator */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <span 
          className="font-mono text-xs uppercase tracking-wider opacity-40"
          style={{ color: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
        >
          {gridMode}
        </span>
      </div>
      
      {/* Instruction overlay (shown when not active) */}
      {touchPoints.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted-foreground text-sm opacity-50 font-light tracking-wide">
            Touch to play
          </p>
        </div>
      )}
    </div>
  );
};
