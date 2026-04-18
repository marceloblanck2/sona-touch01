// SØNA Touch 01 — On-screen debug overlay (activated via ?debug=1)
import React, { useEffect, useState, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { VoiceManager } from '../audio/VoiceManager';

interface Snapshot {
  ctxState: string;
  sampleRate: number;
  voices: number;
  hwConcurrency: number;
  platform: string;
  lastPointerDown: number | null;
  lastOscStart: number | null;
}

const getPlatform = (): string => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  return 'Desktop';
};

export const DebugOverlay: React.FC = () => {
  const enabled = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  const [visible, setVisible] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const errorsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const pushError = (msg: string) => {
      errorsRef.current = [...errorsRef.current, msg].slice(-5);
      setErrors([...errorsRef.current]);
    };

    const onError = (e: ErrorEvent) => {
      pushError(`${e.message} @ ${e.filename?.split('/').pop() ?? '?'}:${e.lineno ?? '?'}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      pushError(`unhandled: ${String(e.reason)}`);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const tick = () => {
      const state = (audioEngine as any).getState?.() ?? {
        ctxState: 'n/a',
        sampleRate: 0,
      };
      setSnap({
        ctxState: state.ctxState,
        sampleRate: state.sampleRate,
        voices: VoiceManager.getActiveVoiceCount(),
        hwConcurrency: navigator.hardwareConcurrency || 0,
        platform: getPlatform(),
        lastPointerDown: (window as any).__lastPointerDown ?? null,
        lastOscStart: (window as any).__lastOscStart ?? null,
      });
    };
    tick();
    const id = window.setInterval(tick, 200);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [enabled]);

  if (!enabled || !visible) return null;

  const fmtTs = (t: number | null) =>
    t == null ? '—' : `${(performance.now() - t).toFixed(0)}ms ago`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        maxWidth: 260,
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 10,
        lineHeight: 1.4,
        padding: 8,
        borderRadius: 6,
        zIndex: 99999,
        pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#ff0', fontWeight: 'bold' }}>DEBUG</span>
        <button
          onClick={() => setVisible(false)}
          style={{
            pointerEvents: 'auto',
            background: 'transparent',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 3,
            fontSize: 10,
            padding: '0 6px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
      {snap && (
        <>
          <div>ctx: {snap.ctxState} @ {snap.sampleRate}Hz</div>
          <div>voices: {snap.voices}</div>
          <div>hw: {snap.hwConcurrency} • {snap.platform}</div>
          <div>pointerDown: {fmtTs(snap.lastPointerDown)}</div>
          <div>oscStart: {fmtTs(snap.lastOscStart)}</div>
        </>
      )}
      <div style={{ marginTop: 6, color: '#f88' }}>
        errors ({errors.length}):
      </div>
      {errors.map((e, i) => (
        <div key={i} style={{ wordBreak: 'break-all', opacity: 0.85 }}>
          • {e}
        </div>
      ))}
    </div>
  );
};
