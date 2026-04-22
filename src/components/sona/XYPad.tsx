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
  onAdjustGlow?: (delta: number) => void;
  onAdjustTrail?: (delta: number) => void;
  onAdjustVolume?: (delta: number) => void;
}

interface GestureColorState {
  hue: number;
  saturation: number;
  lightness: number;
}

interface PendingMove {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hasMoved: boolean;
}

interface TouchVisualState {
  bornAt: number;
  lastMoveAt: number;
  lastSpeed: number;
  color: GestureColorState;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  if (inMax === inMin) return outMin;
  const normalized = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + normalized * (outMax - outMin);
};

const MAX_TRAIL_STEPS_PER_FRAME = 9;
const GLOW_ATTACK_BOOST = 1.8;
const GLOW_ATTACK_DURATION_MS = 320;
const GLOW_MOVE_BOOST_MAX = 1.0;
const GLOW_MOVE_SPEED_SCALE = 4.2;
const GLOW_IDLE_SHRINK_AFTER_MS = 70;
const GLOW_IDLE_SHRINK_DURATION_MS = 260;

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
  const [, setAnimationTick] = useState(0);
  const hasInteracted = useRef(false);
  const activePointers = useRef<Set<number>>(new Set());

  const pendingMoves = useRef<Map<number, PendingMove>>(new Map());
  const rafId = useRef<number | null>(null);
  const animationRafId = useRef<number | null>(null);
  const touchVisualsRef = useRef<Map<number, TouchVisualState>>(new Map());

  const [gestureColor, setGestureColor] = useState<GestureColorState>({
    hue: 220,
    saturation: 50,
    lightness: 58,
  });

  const gestureColorRef = useRef<GestureColorState>({
    hue: 220,
    saturation: 50,
    lightness: 58,
  });

  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

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

  useEffect(() => {
    if (touchPoints.size === 0) {
      if (animationRafId.current !== null) {
        cancelAnimationFrame(animationRafId.current);
        animationRafId.current = null;
      }
      return;
    }

    const tick = () => {
      setAnimationTick(prev => prev + 1);
      animationRafId.current = requestAnimationFrame(tick);
    };

    animationRafId.current = requestAnimationFrame(tick);

    return () => {
      if (animationRafId.current !== null) {
        cancelAnimationFrame(animationRafId.current);
        animationRafId.current = null;
      }
    };
  }, [touchPoints.size]);

  const getFallbackVisualColor = useCallback((x: number, y: number, speed: number): GestureColorState => {
    const normalizedSpeed = clamp(speed * 8, 0, 1);

    const hue = mapRange(x, 0, 1, 0, 280);
    const saturation = clamp(mapRange(y, 1, 0, 78, 96) + normalizedSpeed * 4, 70, 98);
    const lightness = clamp(mapRange(y, 1, 0, 14, 78) + normalizedSpeed * 3, 10, 82);

    return { hue, saturation, lightness };
  }, []);

  const getVisualColorForPointer = useCallback((pointerId: number, x: number, y: number, speed: number) => {
    return getFallbackVisualColor(x, y, speed);
  }, [getFallbackVisualColor]);

  const updateGestureColor = useCallback((x: number, y: number, pointerId?: number) => {
    const prevPos = lastPositionRef.current;

    let speed = 0;
    if (prevPos) {
      const dx = x - prevPos.x;
      const dy = y - prevPos.y;
      speed = Math.sqrt(dx * dx + dy * dy);
    }
    lastPositionRef.current = { x, y };

    const baseColor =
      pointerId !== undefined
        ? getVisualColorForPointer(pointerId, x, y, speed)
        : getFallbackVisualColor(x, y, speed);

    const next = {
      hue: baseColor.hue,
      lightness: gestureColorRef.current.lightness * 0.72 + baseColor.lightness * 0.28,
      saturation: gestureColorRef.current.saturation * 0.72 + baseColor.saturation * 0.28,
    };

    gestureColorRef.current = next;
    setGestureColor(next);
  }, [getFallbackVisualColor, getVisualColorForPointer]);

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

  const flushPendingMoves = useCallback(() => {
    rafId.current = null;

    if (pendingMoves.current.size === 0) return;

    const updates: Array<{
      id: number;
      x: number;
      y: number;
      prevX: number;
      prevY: number;
      speed: number;
      color: GestureColorState;
    }> = [];
    let latestColorPointer: number | null = null;
    let latestX = 0;
    let latestY = 0;

    pendingMoves.current.forEach((move, id) => {
      if (move.hasMoved) {
        const dx = move.x - move.prevX;
        const dy = move.y - move.prevY;
        const speed = Math.sqrt(dx * dx + dy * dy);
        const colorForPoint = getVisualColorForPointer(id, move.x, move.y, speed);

        updates.push({
          id,
          x: move.x,
          y: move.y,
          prevX: move.prevX,
          prevY: move.prevY,
          speed,
          color: colorForPoint,
        });

        latestColorPointer = id;
        latestX = move.x;
        latestY = move.y;
        move.prevX = move.x;
        move.prevY = move.y;
        move.hasMoved = false;
      }
    });

    if (updates.length === 0) return;

    setTouchPoints(prev => {
      const next = new Map(prev);
      updates.forEach(({ id, x, y }) => {
        next.set(id, { id, x, y });
      });
      return next;
    });

    updates.forEach(({ id, speed, color }) => {
      const visual = touchVisualsRef.current.get(id);
      if (visual) {
        visual.lastMoveAt = performance.now();
        visual.lastSpeed = speed;
        visual.color = color;
      }
    });

    if (latestColorPointer !== null) {
      updateGestureColor(latestX, latestY, latestColorPointer);
    }

    const trailAdd = (window as any).__sonaTrailAdd;

    updates.forEach(({ id, x, y, prevX, prevY, color }) => {
      if (trailAdd) {
        const dx = x - prevX;
        const dy = y - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.min(MAX_TRAIL_STEPS_PER_FRAME, Math.max(1, Math.ceil(dist * 30)));

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const ix = prevX + dx * t;
          const iy = prevY + dy * t;
          trailAdd(ix, iy, color.hue, color.saturation, color.lightness);
        }
      }

      onTouchMove(id, x, y);
    });
  }, [getVisualColorForPointer, onTouchMove, updateGestureColor]);

  const scheduleFlush = useCallback(() => {
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(flushPendingMoves);
    }
  }, [flushPendingMoves]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (animationRafId.current !== null) {
        cancelAnimationFrame(animationRafId.current);
        animationRafId.current = null;
      }
      pendingMoves.current.clear();
      touchVisualsRef.current.clear();
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isValidInput(e)) return;

    ensureAudioReady();

    e.preventDefault();
    e.stopPropagation();

    const id = e.pointerId;
    if (activePointers.current.has(id)) return;

    if (!hasInteracted.current) {
      hasInteracted.current = true;
    }

    onInteractionStart();

    const { x, y } = getNormalizedCoords(e.clientX, e.clientY);
    const now = performance.now();
    const initialColor = getVisualColorForPointer(id, x, y, 0);

    activePointers.current.add(id);
    pendingMoves.current.set(id, { x, y, prevX: x, prevY: y, hasMoved: false });
    touchVisualsRef.current.set(id, {
      bornAt: now,
      lastMoveAt: now,
      lastSpeed: 0,
      color: initialColor,
    });

    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });

    updateGestureColor(x, y, id);

    if ((window as any).__sonaTrailAdd) {
      (window as any).__sonaTrailAdd(
        x,
        y,
        initialColor.hue,
        initialColor.saturation,
        initialColor.lightness
      );
    }

    setIsActive(true);
    onTouchStart(id, x, y);

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  }, [
    ensureAudioReady,
    getNormalizedCoords,
    getVisualColorForPointer,
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

    const existing = pendingMoves.current.get(id);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.hasMoved = true;
    } else {
      pendingMoves.current.set(id, { x, y, prevX: x, prevY: y, hasMoved: true });
    }

    scheduleFlush();
  }, [getNormalizedCoords, scheduleFlush]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const id = e.pointerId;
    if (!activePointers.current.has(id)) return;

    e.preventDefault();

    activePointers.current.delete(id);
    pendingMoves.current.delete(id);
    touchVisualsRef.current.delete(id);

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
    } catch (err) {}
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
    const now = performance.now();

    return Array.from(touchPoints.values()).map(point => {
      const visual = touchVisualsRef.current.get(point.id);
      const pointColor = visual?.color ?? gestureColorRef.current;
      const ageMs = visual ? now - visual.bornAt : 0;
      const timeSinceMoveMs = visual ? now - visual.lastMoveAt : 0;
      const lastSpeed = visual?.lastSpeed ?? 0;

      const attackBoost = clamp(1 - ageMs / GLOW_ATTACK_DURATION_MS, 0, 1) * GLOW_ATTACK_BOOST;
      const movementBoost = Math.min(lastSpeed * GLOW_MOVE_SPEED_SCALE, GLOW_MOVE_BOOST_MAX);
      const idleShrink =
        timeSinceMoveMs <= GLOW_IDLE_SHRINK_AFTER_MS
          ? 0
          : clamp(
              (timeSinceMoveMs - GLOW_IDLE_SHRINK_AFTER_MS) / GLOW_IDLE_SHRINK_DURATION_MS,
              0,
              0.42
            );

      const freqBias = mapRange(point.x, 0, 1, 1.12, 0.88);
      const scale = Math.max(0.66, 1 + attackBoost + movementBoost - idleShrink);
      const size = glowSize * 62 * scale * freqBias;
      const coreSize = size * 0.34;
      const glowAlpha = clamp(0.30 + attackBoost * 0.34 + movementBoost * 0.28, 0.28, 0.84);
      const shadowAlpha = clamp(0.32 + attackBoost * 0.38 + movementBoost * 0.32, 0.30, 0.96);

      return (
        <div
          key={point.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            width: size,
            height: size,
            transform: 'translate(-50%, -50%)',
            borderRadius: '999px',
            background: `radial-gradient(circle,
              hsl(${pointColor.hue} ${pointColor.saturation}% ${clamp(pointColor.lightness + 14, 35, 88)}%) 0%,
              hsl(${pointColor.hue} ${pointColor.saturation}% ${pointColor.lightness}% / ${glowAlpha}) 34%,
              hsl(${pointColor.hue} ${pointColor.saturation}% ${clamp(pointColor.lightness - 4, 24, 72)}% / ${glowAlpha * 0.7}) 58%,
              transparent 100%)`,
            boxShadow: `
              0 0 ${size * 0.55}px hsl(${pointColor.hue} ${pointColor.saturation}% ${pointColor.lightness}% / ${shadowAlpha}),
              0 0 ${size * 1.1}px hsl(${pointColor.hue} ${pointColor.saturation}% ${pointColor.lightness}% / ${shadowAlpha * 0.35})
            `,
            willChange: 'transform, width, height, box-shadow',
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              left: '50%',
              top: '50%',
              width: coreSize,
              height: coreSize,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle,
                hsl(${pointColor.hue} ${pointColor.saturation}% ${clamp(pointColor.lightness + 20, 40, 94)}%) 0%,
                hsl(${pointColor.hue} ${pointColor.saturation}% ${clamp(pointColor.lightness + 8, 34, 84)}% / 0.85) 55%,
                transparent 100%)`,
              filter: 'blur(1px)',
            }}
          />
        </div>
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
          radial-gradient(circle at 50% 50%, hsl(${bgHue} ${bgSat}% ${bgLight}% / 0.30) 0%, transparent 60%),
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
          <div className="text-center select-none opacity-[0.15]">
            <div
              className="text-4xl sm:text-5xl font-light tracking-[0.35em]"
              style={{ opacity: 0.95, color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
            >
              SØM
            </div>

            <div
              className="mt-2 text-[10px] sm:text-[11px] tracking-[0.35em] uppercase"
              style={{ opacity: 0.7, color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
            >
              imagem sonora
            </div>

            <div
              className="mt-2 text-[10px] sm:text-xs tracking-[0.28em] uppercase"
              style={{ opacity: 0.78, color: `hsl(${bgHue} ${bgSat}% ${bgLight}%)` }}
            >
              Marcelo Blanck
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
