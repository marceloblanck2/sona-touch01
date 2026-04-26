// SØNA Touch 01 - Audio Engine React Hook

import { useState, useCallback, useEffect, useRef } from 'react';
import { audioEngine, AudioMappings } from '../audio/AudioEngine';
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
  const [gridMode, setGridMode] = useState<GridMode>('grid');
  const [color, setColor] = useState<HSLColor>({ h: 38, s: 75, l: 55 });
  const [masterVolume, setMasterVolume] = useState(0.5);
  const [waveformData, setWaveformData] = useState<Float32Array>(new Float32Array(0));
  const [tonalField, setTonalFieldState] = useState<TonalField | null>(null);

  // RAF unificado — antes eram dois loops (voiceCount + waveform) rodando a 60fps
  // simultaneamente. Agora um único loop atualiza ambos, reduzindo pressão no main thread.
  const unifiedRafRef = useRef<number | null>(null);
  const activeTouches = useRef<Set<number>>(new Set());
  const audioUnlockNeeded = useRef(true);
  const pendingTouch = useRef<{ id: number; x: number; y: number } | null>(null);

  // Rastreia dedos que iniciaram mas ainda não tiveram createVoice resolvido.
  // Evita race condition: se o usuário move o dedo antes do createVoice async
  // completar, o updateVoice tentaria atualizar uma voz que ainda não existe.
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
  }, []);

  const stopAllSound = useCallback(() => {
    activeTouches.current.clear();
    pendingVoiceCreations.current.clear();
    audioEngine.stopAllSound();
    setActiveVoices(0);
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

    // Se o createVoice ainda não resolveu, ignora o move (voz não existe ainda).
    // Sem isso, updateVoice chamado com touchId inexistente gera warning no AudioEngine.
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

  // Loop RAF unificado — atualiza voiceCount e waveform no mesmo frame.
  // Antes: dois RAFs independentes rodando a 60fps cada = dois scheduled callbacks por frame.
  useEffect(() => {
    if (!isInitialized || !isPlaying) return;

    let lastVoiceCount = activeVoices;

    const tick = () => {
      // Voice count — só atualiza estado se mudou (evita re-render desnecessário).
      const count = audioEngine.getActiveVoiceCount();
      if (count !== lastVoiceCount) {
        lastVoiceCount = count;
        setActiveVoices(count);
      }

      // Waveform — sempre atualiza (visualização contínua).
      const data = audioEngine.getWaveformData();
      setWaveformData(data);

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

  return {
    isInitialized,
    isPlaying,
    activeVoices,
    mappings,
    gridMode,
    color,
    masterVolume,
    waveformData,
    initialize,
    updateMapping,
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
  };
}
