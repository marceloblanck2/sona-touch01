// SØNA Touch 01 - Trail Canvas
// Renders gesture trails with configurable decay time
// Each trail point stores position, color, and timestamp
// Canvas renders all points with opacity based on age vs trailDuration

import React, { useRef, useEffect, useCallback } from 'react';
import { HSLColor } from '../../utils/colorUtils';

interface TrailPoint {
  x: number;       // 0-1 normalized
  y: number;       // 0-1 normalized
  hue: number;
  saturation: number;
  lightness: number;
  timestamp: number;
  size: number;     // base size of the glow
}

interface TrailCanvasProps {
  trailDuration: number;  // seconds — how long trails persist
  color: HSLColor;        // fallback color
}

// Circular buffer for trail points — avoids GC pressure
const MAX_TRAIL_POINTS = 2000;

class TrailBuffer {
  private points: TrailPoint[] = new Array(MAX_TRAIL_POINTS);
  private head = 0;
  private count = 0;

  push(point: TrailPoint): void {
    this.points[this.head] = point;
    this.head = (this.head + 1) % MAX_TRAIL_POINTS;
    if (this.count < MAX_TRAIL_POINTS) this.count++;
  }

  forEach(fn: (point: TrailPoint, index: number) => void): void {
    const start = this.count < MAX_TRAIL_POINTS ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % MAX_TRAIL_POINTS;
      fn(this.points[idx], i);
    }
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }
}

// Singleton buffer shared across renders
const trailBuffer = new TrailBuffer();

export const TrailCanvas: React.FC<TrailCanvasProps> = ({
  trailDuration,
  color,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Add a point to the trail (called from parent via ref)
  const addTrailPoint = useCallback((
    x: number, y: number,
    hue: number, saturation: number, lightness: number
  ) => {
    trailBuffer.push({
      x, y,
      hue, saturation, lightness,
      timestamp: performance.now(),
      size: 30 + Math.random() * 10, // slight variation for organic feel
    });
  }, []);

  // Expose addTrailPoint via a global ref so XYPad can call it
  useEffect(() => {
    (window as any).__sonaTrailAdd = addTrailPoint;
    return () => {
      delete (window as any).__sonaTrailAdd;
    };
  }, [addTrailPoint]);

  // Clear trails when duration changes to 0
  useEffect(() => {
    if (trailDuration === 0) {
      trailBuffer.clear();
    }
  }, [trailDuration]);

  // Animation loop — renders trail with decay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Resize canvas if needed
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      // Clear
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (trailDuration <= 0) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const now = performance.now();
      const durationMs = trailDuration * 1000;

      // Draw each trail point
      trailBuffer.forEach((point) => {
        const age = now - point.timestamp;
        if (age > durationMs) return; // expired

        // Opacity: 1 at birth → 0 at death, with easing
        const life = 1 - age / durationMs;
        const easedLife = life * life; // quadratic ease-out for natural fade

        // Size grows slightly as it fades (like smoke dissipating)
        const size = point.size * (1 + (1 - life) * 0.5);

        const px = point.x * rect.width;
        const py = point.y * rect.height;

        // Draw glow
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, size);
        gradient.addColorStop(0, `hsla(${point.hue}, ${point.saturation}%, ${point.lightness}%, ${easedLife * 0.6})`);
        gradient.addColorStop(0.4, `hsla(${point.hue}, ${point.saturation}%, ${point.lightness}%, ${easedLife * 0.3})`);
        gradient.addColorStop(1, `hsla(${point.hue}, ${point.saturation}%, ${point.lightness}%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [trailDuration]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
