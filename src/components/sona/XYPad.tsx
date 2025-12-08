// SØNA Touch 01 - XY Pad Component with Multitouch Support

import React, { useRef, useCallback, useState } from 'react';
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

interface GestureColorState {
  hue: number;
  saturation: number;
  lightness: number;
}

// Clamp value between min and max
const clamp = (value: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, value));

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
  const activePointers = useRef<Set<number>>(new Set());
  
  // Gesture color state with movement speed tracking
  const [gestureColor, setGestureColor] = useState<GestureColorState>({ hue: 0, saturation: 40, lightness: 70 });
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  
  // Update gesture color based on position and movement speed
  const updateGestureColor = useCallback((x: number, y: number) => {
    const prevPos = lastPositionRef.current;
    
    // Calculate movement speed (distance from previous position)
    let speed = 0;
    if (prevPos) {
      const dx = x - prevPos.x;
      const dy = y - prevPos.y;
      speed = Math.sqrt(dx * dx + dy * dy);
    }
    lastPositionRef.current = { x, y };
    
    // Normalize speed (0-1 range, capped at ~0.1 movement per frame for max)
    const normalizedSpeed = clamp(speed * 10, 0, 1);
    
    // Calculate HSL values from gesture
    const hue = x * 360;
    const lightness = clamp(40 + y * 60, 40, 100);
    const saturation = clamp(40 + normalizedSpeed * 60, 40, 100);
    
    setGestureColor(prev => ({
      hue,
      lightness,
      // Smooth saturation transitions
      saturation: prev.saturation * 0.7 + saturation * 0.3,
    }));
  }, []);

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
    
    // Update gesture color from position
    updateGestureColor(x, y);
    
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
    
    // Update gesture color from position and movement
    updateGestureColor(x, y);
    
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
        lastPositionRef.current = null;
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

  // Render touch points with gesture-driven vivid color
  const renderTouchPoints = () => {
    return Array.from(touchPoints.values()).map(point => {
      const size = 60 + Math.sin(Date.now() / 500) * 10;
      
      return (
        <div
          key={point.id}
          className="absolute rounded-full pointer-events-none animate-pulse-glow"
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            width: size,
            height: size,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, hsl(${gestureColor.hue} ${gestureColor.saturation}% ${gestureColor.lightness}%) 0%, hsl(${gestureColor.hue} ${gestureColor.saturation}% ${gestureColor.lightness}% / 0.4) 60%, transparent 100%)`,
            boxShadow: `0 0 20px hsl(${gestureColor.hue} ${gestureColor.saturation}% ${gestureColor.lightness}% / 0.6)`,
          }}
        />
      );
    });
  };

  // Background color: soft gesture color when active, base color otherwise
  const bgHue = isActive ? gestureColor.hue : color.h;
  const bgSat = isActive ? gestureColor.saturation : color.s;
  const bgLight = isActive ? gestureColor.lightness : color.l;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-lg overflow-hidden touch-none select-none cursor-crosshair"
      style={{
        background: `
          radial-gradient(circle at 50% 50%, hsl(${bgHue} ${bgSat}% ${bgLight}% / 0.3) 0%, transparent 60%),
          linear-gradient(135deg, hsl(220 20% 8%) 0%, hsl(220 18% 12%) 100%)
        `,
        boxShadow: isActive 
          ? `inset 0 0 80px hsl(${gestureColor.hue} ${gestureColor.saturation}% ${gestureColor.lightness}% / 0.25), 0 0 50px hsl(${gestureColor.hue} ${gestureColor.saturation}% ${gestureColor.lightness}% / 0.2)` 
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
      
      {/* Grid overlay */}
      {renderGrid()}
      
      {/* Touch points */}
      {renderTouchPoints()}
      
      {/* Center crosshair - uses gesture-modulated color */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="w-px h-8 opacity-20"
          style={{ background: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="h-px w-8 opacity-20"
          style={{ background: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
        />
      </div>
      
      {/* Mode indicator */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <span 
          className="font-mono text-xs uppercase tracking-wider opacity-40"
          style={{ color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
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