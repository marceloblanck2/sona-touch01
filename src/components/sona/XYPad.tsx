import React, { useRef, useCallback, useState, useEffect } from 'react';
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
  const lastTrailPointRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const ensureAudioReady = useCallback(() => {
    try {
      if (audioEngine.isSuspended()) {
        audioEngine.forceRecreateContext();
      } else {
        audioEngine.initialize();
      }

      audioEngine.forceSilentUnlock();
      audioEngine.resume();
    } catch (err) {
      console.warn('Audio unlock failed:', err);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const unlock = () => {
      ensureAudioReady();
    };

    el.addEventListener('touchstart', unlock, { passive: true });
    el.addEventListener('touchend', unlock, { passive: true });
    el.addEventListener('pointerup', unlock);

    return () => {
      el.removeEventListener('touchstart', unlock);
      el.removeEventListener('touchend', unlock);
      el.removeEventListener('pointerup', unlock);
    };
  }, [ensureAudioReady]);

  const updateGestureColor = useCallback((x: number, y: number, pointerId?: number) => {
    const prevPos = lastPositionRef.current;

    let speed = 0;
    if (prevPos) {
      const dx = x - prevPos.x;
      const dy = y - prevPos.y;
      speed = Math.sqrt(dx * dx + dy * dy);
    }
    lastPositionRef.current = { x, y };

    let hue: number;
    let lightness: number;
    let saturation: number;

    const audioColor =
      pointerId !== undefined && getVoiceColor ? getVoiceColor(pointerId) : null;

    if (audioColor) {
      hue = audioColor.h;
      lightness = audioColor.l;
      saturation = audioColor.s;
    } else {
      const normalizedSpeed = clamp(speed * 10, 0, 1);
      hue = x * 360;
      lightness = clamp(40 + y * 60, 40, 100);
      saturation = clamp(40 + normalizedSpeed * 60, 40, 100);
    }

    setGestureColor(prev => {
      const next = {
        hue,
        lightness,
        saturation: prev.saturation * 0.7 + saturation * 0.3,
      };
      gestureColorRef.current = next;
      return next;
    });
  }, [getVoiceColor]);

  const getNormalizedCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return { x, y };
  }, []);

  const isValidInput = useCallback((e: React.PointerEvent): boolean => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return false;
    }
    return true;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isValidInput(e)) {
      return;
    }

    ensureAudioReady();

    e.preventDefault();
    e.stopPropagation();

    const id = e.pointerId;

    if (activePointers.current.has(id)) {
      return;
    }

    if (!hasInteracted.current) {
      hasInteracted.current = true;
    }

    onInteractionStart();

    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);

    activePointers.current.add(id);

    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });

    lastTrailPointRef.current.set(id, { x, y });
    updateGestureColor(x, y, id);

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
  }, [
    ensureAudioReady,
    getNormalizedCoords,
    onTouchStart,
    onInteractionStart,
    isValidInput,
    updateGestureColor,
  ]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;

    if (!activePointers.current.has(id)) return;

    e.preventDefault();

    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);

    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });

    updateGestureColor(x, y, id);

    const prevTrail = lastTrailPointRef.current.get(id);

    if (prevTrail && (window as any).__sonaTrailAdd) {
      const dx = x - prevTrail.x;
      const dy = y - prevTrail.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const steps = Math.max(1, Math.ceil(dist * 60));
      const c = gestureColorRef.current;

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ix = prevTrail.x + dx * t;
        const iy = prevTrail.y + dy * t;
        (window as any).__sonaTrailAdd(ix, iy, c.hue, c.saturation, c.lightness);
      }
    } else if ((window as any).__sonaTrailAdd) {
      const c = gestureColorRef.current;
      (window as any).__sonaTrailAdd(x, y, c.hue, c.saturation, c.lightness);
    }

    lastTrailPointRef.current.set(id, { x, y });

    onTouchMove(id, x, y);
  }, [getNormalizedCoords, onTouchMove, updateGestureColor]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;

    if (!activePointers.current.has(id)) return;

    e.preventDefault();

    activePointers.current.delete(id);
    lastTrailPointRef.current.delete(id);

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

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // May fail if already released
    }
  }, [onTouchEnd]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const renderGrid = () => {
    if (gridMode !== 'grid') return null;

    const lines = [];
    const gridSize = GRID_3x3;

    for (let i = 1; i < gridSize; i++) {
      const pos = (i / gridSize) * 100;

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

  const renderTouchPoints = () => {
    return Array.from(touchPoints.values()).map(point => {
      const baseSize = 40 + Math.sin(Date.now() / 500) * 8;
      const size = baseSize * glowSize;

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

  const bgHue = isActive ? gestureColor.hue : color.h;
  const bgSat = isActive ? gestureColor.saturation : color.s;
  const bgLight = isActive ? gestureColor.lightness : color.l;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden touch-none select-none cursor-crosshair ${
        isFullscreen ? 'h-full rounded-none' : 'aspect-square rounded-lg'
      }`}
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
      {renderGrid()}

      <TrailCanvas trailDuration={trailDuration} glowSize={glowSize} color={color} />

      {renderTouchPoints()}

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

      <div className="absolute top-3 right-3 pointer-events-none">
        <span
          className="font-mono text-xs uppercase tracking-wider opacity-40"
          style={{ color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
        >
          {gridMode}
        </span>
      </div>

      {touchPoints.size === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-20 select-none">
            <div
              className="text-4xl sm:text-5xl font-light tracking-[0.35em]"
              style={{ color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
            >
              SØM
            </div>

            <div
              className="mt-3 text-[11px] sm:text-xs tracking-[0.28em] uppercase"
              style={{ color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
            >
              Marcelo Blanck
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
