// SØNA Touch 01 - XY Pad Component with Multitouch Support and Trail

import React, { useRef, useCallback, useState } from 'react';
import { GRID_3x3 } from '../../utils/constants';
import { GridMode } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';
import { TrailCanvas } from './TrailCanvas';
import { audioEngine } from '../../audio/AudioEngine';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

interface XYPadProps {
  gridMode: GridMode;
  color: HSLColor;
  trailDuration: number;
  glowSize: number;
  getVoiceColor?: (touchId: number) => { h: number; s: number; l: number } | null;
  onTouchStart: (id: number, x: number, y: number) => void;
  onTouchMove: (id: number, x: number, y: number) => void;
  onTouchEnd: (id: number) => void;
  onInteractionStart: () => void;
  isFullscreen?: boolean;
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
  trailDuration,
  glowSize,
  getVoiceColor,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onInteractionStart,
  isFullscreen = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchPoints, setTouchPoints] = useState<Map<number, TouchPoint>>(new Map());
  const [isActive, setIsActive] = useState(false);
  const hasInteracted = useRef(false);
  const activePointers = useRef<Set<number>>(new Set());

  // Gesture color state with movement speed tracking
  const [gestureColor, setGestureColor] = useState<GestureColorState>({
    hue: 0,
    saturation: 40,
    lightness: 70,
  });
  const gestureColorRef = useRef<GestureColorState>({
    hue: 0,
    saturation: 40,
    lightness: 70,
  });
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Update gesture color — uses audio-derived color when available (GSI mapping),
  // falls back to position-based color when audio engine hasn't produced a color yet
  const updateGestureColor = useCallback(
    (x: number, y: number, pointerId?: number) => {
      const prevPos = lastPositionRef.current;

      // Calculate movement speed (distance from previous position)
      let speed = 0;
      if (prevPos) {
        const dx = x - prevPos.x;
        const dy = y - prevPos.y;
        speed = Math.sqrt(dx * dx + dy * dy);
      }
      lastPositionRef.current = { x, y };

      // Try to get audio-derived color (GSI: frequency→hue, amplitude→lightness)
      let hue: number;
      let lightness: number;
      let saturation: number;

      const audioColor =
        pointerId !== undefined && getVoiceColor ? getVoiceColor(pointerId) : null;

      if (audioColor) {
        // GSI unified mapping: color derived from what the audio is actually doing
        hue = audioColor.h;
        lightness = audioColor.l;
        saturation = audioColor.s;
      } else {
        // Fallback: position-based (used before audio is active)
        const normalizedSpeed = clamp(speed * 10, 0, 1);
        hue = x * 360;
        lightness = clamp(40 + y * 60, 40, 100);
        saturation = clamp(40 + normalizedSpeed * 60, 40, 100);
      }

      setGestureColor((prev) => {
        const next = {
          hue,
          lightness,
          // Smooth saturation transitions
          saturation: prev.saturation * 0.7 + saturation * 0.3,
        };
        gestureColorRef.current = next;
        return next;
      });
    },
    [getVoiceColor]
  );

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
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isValidInput(e)) {
        return;
      }

      // iPhone/Safari: must run directly in the real pointer gesture
      audioEngine.initialize();

      e.preventDefault();
      e.stopPropagation();

      const id = e.pointerId;

      if (activePointers.current.has(id)) {
        return;
      }

      if (!hasInteracted.current) {
        hasInteracted.current = true;
      }

      // Call onInteractionStart on every pointerdown to help keep audio context alive
      onInteractionStart();

      const { x, y } = getNormalizedCoords(e.clientX, e.clientY);

      activePointers.current.add(id);

      setTouchPoints((prev) => {
        const next = new Map(prev);
        next.set(id, { id, x, y });
        return next;
      });

      updateGestureColor(x, y, id);

      // Record trail point with current live color
      if ((window as any).__sonaTrailAdd) {
        const c = gestureColorRef.current;
        (window as any).__sonaTrailAdd(x, y, c.hue, c.saturation, c.lightness);
      }

      setIsActive(true);
      onTouchStart(id, x, y);

      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch (err) {
        // Pointer capture may fail in some cases
      }
    },
    [getNormalizedCoords, onTouchStart, onInteractionStart, isValidInput, updateGestureColor]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const id = e.pointerId;

      // Only process if this pointer is tracked
      if (!activePointers.current.has(id)) return;

      e.preventDefault();

      const { x, y } = getNormalizedCoords(e.clientX, e.clientY);

      setTouchPoints((prev) => {
        const next = new Map(prev);
        next.set(id, { id, x, y });
        return next;
      });

      // Update gesture color from audio state (GSI mapping)
      updateGestureColor(x, y, id);

      // Record trail point with current live color
      if ((window as any).__sonaTrailAdd) {
        const c = gestureColorRef.current;
        (window as any).__sonaTrailAdd(x, y, c.hue, c.saturation, c.lightness);
      }

      onTouchMove(id, x, y);
    },
    [getNormalizedCoords, onTouchMove, updateGestureColor]
  );

  // Handle pointer up/end
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const id = e.pointerId;

      // Only process if this pointer was tracked
      if (!activePointers.current.has(id)) return;

      e.preventDefault();

      // Remove from local tracking
      activePointers.current.delete(id);

      setTouchPoints((prev) => {
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
    },
    [onTouchEnd]
  );

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
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 w-px bg-white/10"
          style={{ left: `${pos}%` }}
        />
      );

      // Horizontal lines
      lines.push(
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 h-px bg-white/10"
          style={{ top: `${pos}%` }}
        />
      );
    }

    return lines;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden touch-none select-none rounded-[28px] ${
        isFullscreen ? 'rounded-none' : ''
      }`}
      style={{
        background: `
          radial-gradient(circle at ${gestureColor.hue / 3.6}% ${gestureColor.lightness}%,
            hsla(${gestureColor.hue}, ${gestureColor.saturation}%, ${gestureColor.lightness}%, 0.12) 0%,
            transparent 50%
          ),
          linear-gradient(135deg,
            rgba(17, 24, 39, 0.98) 0%,
            rgba(10, 15, 28, 0.95) 100%
          )
        `,
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      <TrailCanvas
        duration={trailDuration}
        glowSize={glowSize}
        isActive={isActive}
      />

      {renderGrid()}

      {touchPoints.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-white/30 text-2xl md:text-4xl font-light tracking-wide">
            Touch to play
          </div>
        </div>
      )}

      {Array.from(touchPoints.values()).map((point) => {
        const voiceColor = getVoiceColor?.(point.id);
        const hue = voiceColor?.h ?? gestureColor.hue;
        const saturation = voiceColor?.s ?? gestureColor.saturation;
        const lightness = voiceColor?.l ?? gestureColor.lightness;

        return (
          <div
            key={point.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: `${glowSize}px`,
              height: `${glowSize}px`,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle,
                hsla(${hue}, ${saturation}%, ${lightness}%, 0.95) 0%,
                hsla(${hue}, ${saturation}%, ${lightness}%, 0.45) 35%,
                hsla(${hue}, ${saturation}%, ${lightness}%, 0.12) 70%,
                transparent 100%
              )`,
              boxShadow: `
                0 0 ${glowSize * 0.4}px hsla(${hue}, ${saturation}%, ${lightness}%, 0.45),
                0 0 ${glowSize * 0.9}px hsla(${hue}, ${saturation}%, ${lightness}%, 0.22)
              `,
            }}
          />
        );
      })}
    </div>
  );
};
