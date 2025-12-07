// SØNA Touch 01 - XY Pad Component with Multitouch Support

import React, { useRef, useCallback, useState, useMemo } from 'react';
import { GRID_3x3 } from '../../utils/constants';
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

// Calculate gesture-modulated color from base color and position
const getGestureColor = (baseColor: HSLColor, x: number, y: number): HSLColor => {
  // X position shifts hue: -15 to +15 degrees around base
  const hueShift = (x - 0.5) * 30;
  const newHue = (baseColor.h + hueShift + 360) % 360;
  
  // Y position changes lightness: bottom = darker, top = brighter
  // Map Y (0 = top, 1 = bottom) to lightness adjustment
  const lightnessShift = (0.5 - y) * 20; // -10 to +10
  const newLightness = Math.max(20, Math.min(80, baseColor.l + lightnessShift));
  
  return {
    h: newHue,
    s: baseColor.s,
    l: newLightness,
  };
};

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
  const [gesturePosition, setGesturePosition] = useState<{ x: number; y: number } | null>(null);
  const hasInteracted = useRef(false);
  const activePointers = useRef<Set<number>>(new Set());

  // Calculate the gesture-modulated color based on current touch position
  const gestureColor = useMemo(() => {
    if (!gesturePosition) return color;
    return getGestureColor(color, gesturePosition.x, gesturePosition.y);
  }, [color, gesturePosition]);

  // Get normalized coordinates from event
  const getNormalizedCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    
    return { x, y };
  }, []);

  // Check if this is a valid primary input (left click or touch)
  const isValidInput = useCallback((e: React.PointerEvent): boolean => {
    // Only accept primary button (left click) or touch/pen
    // button === 0 is primary button, button === -1 is no button (touch)
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return false;
    }
    return true;
  }, []);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Prevent non-primary inputs (right-click, etc.)
    if (!isValidInput(e)) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const id = e.pointerId;
    
    // Prevent duplicate handling of same pointer
    if (activePointers.current.has(id)) {
      return;
    }
    
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      onInteractionStart();
    }
    
    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);
    
    // Track this pointer locally
    activePointers.current.add(id);
    
    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });
    
    // Update gesture position for color modulation
    setGesturePosition({ x, y });
    
    setIsActive(true);
    onTouchStart(id, x, y);
    
    // Capture pointer for tracking outside element
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {
      // Pointer capture may fail in some cases, continue anyway
    }
  }, [getNormalizedCoords, onTouchStart, onInteractionStart, isValidInput]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;
    
    // Only process if this pointer is tracked
    if (!activePointers.current.has(id)) return;
    
    e.preventDefault();
    
    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);
    
    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });
    
    // Update gesture position for color modulation
    setGesturePosition({ x, y });
    
    onTouchMove(id, x, y);
  }, [getNormalizedCoords, onTouchMove]);

  // Handle pointer up/end
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;
    
    // Only process if this pointer was tracked
    if (!activePointers.current.has(id)) return;
    
    e.preventDefault();
    
    // Remove from local tracking
    activePointers.current.delete(id);
    
    setTouchPoints(prev => {
      const next = new Map(prev);
      next.delete(id);
      if (next.size === 0) {
        setIsActive(false);
        setGesturePosition(null); // Clear gesture position when no touches
      }
      return next;
    });
    
    onTouchEnd(id);
    
    // Release pointer capture
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // May fail if already released
    }
  }, [onTouchEnd]);

  // Handle context menu (prevent right-click menu)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

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

  // Active display color: gesture-modulated when active, base color otherwise
  const displayColor = isActive ? gestureColor : color;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-lg overflow-hidden touch-none select-none cursor-crosshair"
      style={{
        background: `
          radial-gradient(circle at 50% 50%, hsl(${displayColor.h} ${displayColor.s}% ${displayColor.l}% / 0.15) 0%, transparent 60%),
          linear-gradient(135deg, hsl(220 20% 8%) 0%, hsl(220 18% 12%) 100%)
        `,
        boxShadow: isActive 
          ? `inset 0 0 80px hsl(${gestureColor.h} ${gestureColor.s}% ${gestureColor.l}% / 0.25), 0 0 50px hsl(${gestureColor.h} ${gestureColor.s}% ${gestureColor.l}% / 0.2)` 
          : 'inset 0 2px 10px hsl(220 30% 3% / 0.5)',
        transition: isActive ? 'none' : 'box-shadow 0.3s ease, background 0.3s ease',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {/* Gesture color overlay - visible during interaction */}
      {isActive && gesturePosition && (
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-100"
          style={{
            background: `radial-gradient(circle at ${gesturePosition.x * 100}% ${gesturePosition.y * 100}%, hsl(${gestureColor.h} ${gestureColor.s}% ${gestureColor.l}% / 0.3) 0%, transparent 40%)`,
          }}
        />
      )}
      
      {/* Grid overlay */}
      {renderGrid()}
      
      {/* Touch points */}
      {renderTouchPoints()}
      
      {/* Center crosshair - uses gesture-modulated color */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="w-px h-8 opacity-20"
          style={{ background: `hsl(${displayColor.h} ${displayColor.s}% ${displayColor.l}%)` }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="h-px w-8 opacity-20"
          style={{ background: `hsl(${displayColor.h} ${displayColor.s}% ${displayColor.l}%)` }}
        />
      </div>
      
      {/* Mode indicator */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <span 
          className="font-mono text-xs uppercase tracking-wider opacity-40"
          style={{ color: `hsl(${displayColor.h} ${displayColor.s}% ${displayColor.l}%)` }}
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