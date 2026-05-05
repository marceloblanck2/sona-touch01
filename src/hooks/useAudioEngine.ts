// SØNA Touch 01 - Audio Engine React Hook
// ResolvedState exposed per-touch for visual consumers.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  audioEngine,
  AudioMappings,
  ResolvedState,
  TonalAxis,
  ExpressionMode,
} from '../audio/AudioEngine';
import { TonalField } from '../audio/scales/MUSICAL_PRESETS';
import { HSLColor, colorToAudioParams, applySynthColor } from '../utils/colorUtils';
import { MappingOption, GridMode } from '../utils/constants';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  active: boolean;
}
 
export function useAudioEngine() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeVoices, setActiveVoices] = useState(0);
  const [mappings, setMappings] = useState<AudioMappings>({ x: 'frequency', y: 'filter' });
  const [tonalAxis, setTonalAxisState] = useState<TonalAxis>('y');
  const [expressionMode, setExpressionModeState] = useState<ExpressionMode>('pan');
  const [gridMode, setGridMode] = useState<GridMode>('grid');
  const [color, setColor] = useState<HSLColor>({ h: 38, s: 75, l: 55 });
  const [masterVolume, setMasterVolume] = useState(0.5);
  const [waveformData, setWaveformData] = useState<Float32Array>(new Float32Array(0));
  const [tonalField, setTonalFieldState] = useState<TonalField | null>(null);
  const [hueRange, setHueRange] = useState<[number, number]>([0, 270]);
  const [noteMarkers, setNoteMarkers] = useState<Array<{ position: number; role: string; weight: number }>>([]);

  const [resolvedStates, setResolvedStates] = useState<Map<number, ResolvedState>>(new Map());

  useEffect(() => {
    console.log('[DEBUG] imported audioEngine:', audioEngine);

    (window as any).audioEngine = audioEngine;
    (globalThis as any).audioEngine = audioEngine;

    console.log('[DEBUG] window.audioEngine:', (window as any).audioEngine);
  }, []);

  const unifiedRafRef = useRef<number | null>(null);
  const activeTouches = useRef<Set<number>>(new Set());
  const audioUnlockNeeded = useRef(true);
  const pendingTouch = useRef<{ id: number; x: number; y: number } | null>(null);
  const pendingVoiceCreations = useRef<Set<number>>(new Set());

  const ensureAudioUnlocked = useCallback(() => {
    if (!audioUnlockNeeded.current) return;
    try {
      audioEngine.ensureResumed();
      audioUnlockNeeded.current = false;
    } catch (e) {
      console.warn('[useAudioEngine] audio unlock failed:', e);
    }
  }, []);

  const initialize = useCallback(() => {
    try {
      if (!isInitialized) {
        audioEngine.initialize();
        audioUnlockNeeded.current = false;

        setIsInitialized(true);
        setIsPlaying(true);

        const params = colorToAudioParams(color);
        audioEngine.setSynestheticParams(params);
        applySynthColor(color);

        if (pendingTouch.current) {
          const { id, x, y } = pendingTouch.current;
          pendingTouch.current = null;
          activeTouches.current.add(id);
          pendingVoiceCreations.current.add(id);

          audioEngine.createVoice(id, x, y)
            .then(() => {
              pendingVoiceCreations.current.delete(id);
              setActiveVoices(audioEngine.getActiveVoiceCount());
            })
            .catch((e) => {
              console.warn('[initialize] replay touch failed:', e);
              activeTouches.current.delete(id);
              pendingVoiceCreations.current.delete(id);
            });
        }
      } else {
        ensureAudioUnlocked();
      }
    } catch (e) {
      console.warn('[initialize] error:', e);
    }
  }, [isInitialized, color, ensureAudioUnlocked]);

  const updateMapping = useCallback((axis: 'x' | 'y', value: MappingOption) => {
    const newMappings = { ...mappings, [axis]: value };
    setMappings(newMappings);
    audioEngine.setMappings(newMappings);
  }, [mappings]);

  const updateTonalAxis = useCallback((axis: TonalAxis) => {
    setTonalAxisState(axis);
    audioEngine.setTonalAxis(axis);
    setResolvedStates(audioEngine.getAllResolvedStates());
  }, []);

  const updateExpressionMode = useCallback((mode: ExpressionMode) => {
    setExpressionModeState(mode);
    audioEngine.setExpressionMode(mode);
  }, []);

  const updateGridMode = useCallback((mode: GridMode) => {
    activeTouches.current.clear();
    pendingVoiceCreations.current.clear();
    audioEngine.setGridMode(mode);
    setGridMode(mode);
    setActiveVoices(0);
  }, []);

  const updateColor = useCallback((newColor: HSLColor) => {
    setColor(newColor);
    const params = colorToAudioParams(newColor);
    audioEngine.setSynestheticParams(params);
    applySynthColor(newColor);
  }, []);

  const updateVolume = useCallback((volume: number) => {
    setMasterVolume(volume);
    audioEngine.setMasterVolume(volume);
  }, []);

  const updateTonalField = useCallback((field: TonalField | null) => {
    setTonalFieldState(field);
    audioEngine.setTonalField(field);
    const range = field ? [field.hueStart, field.hueEnd] : [0, 270];
    setHueRange(range as [number, number]);
    setResolvedStates(new Map());

    requestAnimationFrame(() => {
      setNoteMarkers(audioEngine.getNoteMarkers());
    });
  }, []);

  const stopAllSound = useCallback(() => {
    activeTouches.current.clear();
    pendingVoiceCreations.current.clear();
    audioEngine.stopAllSound();
    setActiveVoices(0);
    setResolvedStates(new Map());
  }, []);

  const handleTouchStart = useCallback((touchId: number, x: number, y: number) => {
    (window as any).__lastPointerDown = performance.now();

    try {
      if (!isInitialized) {
        pendingTouch.current = { id: touchId, x, y };
        initialize();
        return;
      }

      if (activeTouches.current.has(touchId)) {
        return;
      }

      if (audioUnlockNeeded.current) {
        ensureAudioUnlocked();
      }

      activeTouches.current.add(touchId);
      pendingVoiceCreations.current.add(touchId);

      audioEngine.createVoice(touchId, x, y)
        .then(() => {
          pendingVoiceCreations.current.delete(touchId);
          setActiveVoices(audioEngine.getActiveVoiceCount());
        })
        .catch((e) => {
          console.warn('[handleTouchStart] createVoice error:', e);
          activeTouches.current.delete(touchId);
          pendingVoiceCreations.current.delete(touchId);
        });
    } catch (e) {
      console.warn('[handleTouchStart] error:', e);
    }
  }, [isInitialized, initialize, ensureAudioUnlocked]);

  const handleTouchMove = useCallback((touchId: number, x: number, y: number) => {
    if (!isInitialized) return;
    if (!activeTouches.current.has(touchId)) return;
    if (pendingVoiceCreations.current.has(touchId)) return;

    audioEngine.updateVoice(touchId, x, y);
  }, [isInitialized]);

  const handleTouchEnd = useCallback((touchId: number) => {
    if (!isInitialized) return;

    if (pendingTouch.current?.id === touchId) {
      pendingTouch.current = null;
    }

    if (!activeTouches.current.has(touchId)) return;

    activeTouches.current.delete(touchId);
    pendingVoiceCreations.current.delete(touchId);

    audioEngine.releaseVoice(touchId);
    setActiveVoices(audioEngine.getActiveVoiceCount());
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized || !isPlaying) return;

    let lastVoiceCount = activeVoices;

    const tick = () => {
      const count = audioEngine.getActiveVoiceCount();
      if (count !== lastVoiceCount) {
        lastVoiceCount = count;
        setActiveVoices(count);
      }

      const data = audioEngine.getWaveformData();
      setWaveformData(data);

      audioEngine.refreshResolvedStates();
      const states = audioEngine.getAllResolvedStates();
      setResolvedStates(states);

      unifiedRafRef.current = requestAnimationFrame(tick);
    };

    unifiedRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (unifiedRafRef.current !== null) {
        cancelAnimationFrame(unifiedRafRef.current);
        unifiedRafRef.current = null;
      }
    };
  }, [isInitialized, isPlaying]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInitialized) {
        if (audioEngine.isSuspended()) {
          audioUnlockNeeded.current = true;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized]);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  const applySettings = useCallback((settings: {
    mappingX: MappingOption;
    mappingY: MappingOption;
    mode: GridMode;
    color: HSLColor;
  }) => {
    audioEngine.resetAudioState();
    setActiveVoices(0);
    setResolvedStates(new Map());

    const newMappings = { x: settings.mappingX, y: settings.mappingY };
    setMappings(newMappings);
    audioEngine.setMappings(newMappings);

    setGridMode(settings.mode);

    setColor(settings.color);
    const params = colorToAudioParams(settings.color);
    audioEngine.setSynestheticParams(params);
    applySynthColor(settings.color);
  }, []);

  const getVoiceColor = useCallback((touchId: number) => {
    return audioEngine.getVoiceColor(touchId);
  }, []);

  const getAverageColor = useCallback(() => {
    return audioEngine.getAverageColor();
  }, []);

  const getResolvedState = useCallback((touchId: number): ResolvedState | null => {
    return audioEngine.getResolvedState(touchId);
  }, []);

  return {
    isInitialized,
    isPlaying,
    activeVoices,
    mappings,
    tonalAxis,
    expressionMode,
    gridMode,
    color,
    masterVolume,
    waveformData,
    initialize,
    updateMapping,
    updateTonalAxis,
    updateExpressionMode,
    updateGridMode,
    updateColor,
    updateVolume,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    applySettings,
    stopAllSound,
    getVoiceColor,
    getAverageColor,
    tonalField,
    updateTonalField,
    hueRange,
    noteMarkers,
    resolvedStates,
    getResolvedState,
  };
}
