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

// Estado pendente por dedo — coalescido em requestAnimationFrame.
// Evita inundar o audio thread com eventos de pointermove (que chegam a 200+/s no Android).
interface PendingMove {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hasMoved: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// Limita a quantidade de pontos de trail interpolados por frame.
// Valor anterior (dist * 60) podia gerar 30+ pontos por evento em movimentos rápidos.
const MAX_TRAIL_STEPS_PER_FRAME = 8;

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

  // Estado visual dos pontos — atualizado via RAF, não a cada pointermove.
  const [touchPoints, setTouchPoints] = useState<Map<number, TouchPoint>>(new Map());
  const [isActive, setIsActive] = useState(false);
  const hasInteracted = useRef(false);
  const activePointers = useRef<Set<number>>(new Set());

  // Posição mais recente de cada dedo — gravada imediatamente no evento,
  // lida no próximo frame. Quebra o acoplamento evento -> render/áudio.
  const pendingMoves = useRef<Map<number, PendingMove>>(new Map());
  const rafId = useRef<number | null>(null);

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
      hue = 30 + x * 300;
      lightness = clamp(40 + y * 60, 40, 100);
      saturation = clamp(40 + normalizedSpeed * 60, 40, 100);
    }

    const next = {
      hue,
      lightness,
      saturation: gestureColorRef.current.saturation * 0.7 + saturation * 0.3,
    };
    gestureColorRef.current = next;
    setGestureColor(next);
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

  // Consumidor único dos eventos de movimento — roda uma vez por frame.
  // Processa a posição mais recente de cada dedo e descarta as intermediárias.
  const flushPendingMoves = useCallback(() => {
    rafId.current = null;

    if (pendingMoves.current.size === 0) return;

    const updates: Array<{ id: number; x: number; y: number; prevX: number; prevY: number }> = [];
    let latestColorPointer: number | null = null;
    let latestX = 0;
    let latestY = 0;

    pendingMoves.current.forEach((move, id) => {
      if (move.hasMoved) {
        updates.push({ id, x: move.x, y: move.y, prevX: move.prevX, prevY: move.prevY });
        latestColorPointer = id;
        latestX = move.x;
        latestY = move.y;
        move.prevX = move.x;
        move.prevY = move.y;
        move.hasMoved = false;
      }
    });

    if (updates.length === 0) return;

    // Atualiza posições visuais (um único setState para todos os dedos).
    setTouchPoints(prev => {
      const next = new Map(prev);
      updates.forEach(({ id, x, y }) => {
        next.set(id, { id, x, y });
      });
      return next;
    });

    // Cor da UI segue o dedo mais recente.
    if (latestColorPointer !== null) {
      updateGestureColor(latestX, latestY, latestColorPointer);
    }

    // Trails e callback de áudio — um por dedo, no máximo uma vez por frame.
    const trailAdd = (window as any).__sonaTrailAdd;
    const c = gestureColorRef.current;

    updates.forEach(({ id, x, y, prevX, prevY }) => {
      if (trailAdd) {
        const dx = x - prevX;
        const dy = y - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Limite duro de pontos de trail por frame por dedo.
        const steps = Math.min(MAX_TRAIL_STEPS_PER_FRAME, Math.max(1, Math.ceil(dist * 30)));

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const ix = prevX + dx * t;
          const iy = prevY + dy * t;
          trailAdd(ix, iy, c.hue, c.saturation, c.lightness);
        }
      }

      onTouchMove(id, x, y);
    });
  }, [onTouchMove, updateGestureColor]);

  const scheduleFlush = useCallback(() => {
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(flushPendingMoves);
    }
  }, [flushPendingMoves]);

  // Cleanup do RAF ao desmontar.
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      pendingMoves.current.clear();
    };
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
    pendingMoves.current.set(id, { x, y, prevX: x, prevY: y, hasMoved: false });

    setTouchPoints(prev => {
      const next = new Map(prev);
      next.set(id, { id, x, y });
      return next;
    });

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

  // Handler de movimento — grava a posição mais recente e retorna.
  // NÃO chama onTouchMove, NÃO atualiza trail, NÃO faz setState aqui.
  // O trabalho pesado é feito em flushPendingMoves no próximo RAF.
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
