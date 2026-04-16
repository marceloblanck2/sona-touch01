// SØNA Touch 01 - On-screen debug overlay for mobile debugging

import React, { useEffect, useState } from 'react';

export const DebugOverlay: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (prefix: string, args: any[]) => {
      const message = args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' ');
      setLogs(prev => [...prev.slice(-14), `${prefix} ${message}`]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('LOG', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('WARN', args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('ERR', args);
    };

    // Log initial state
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    console.log('AudioContext available:', !!AudioCtx);
    console.log('User agent:', navigator.userAgent.substring(0, 60));

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        maxHeight: '40vh',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '8px',
        zIndex: 9999,
        pointerEvents: 'none',
        borderBottom: '1px solid #0f0',
      }}
    >
      <div style={{ color: '#ff0', marginBottom: '4px', fontWeight: 'bold' }}>DEBUG CONSOLE</div>
      {logs.map((log, i) => (
        <div key={i} style={{ marginBottom: '2px', wordBreak: 'break-all' }}>
          {log}
        </div>
      ))}
    </div>
  );
};
