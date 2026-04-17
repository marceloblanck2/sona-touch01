// SØNA Touch 01 - Audio Engine React Hook

import { useState, useCallback, useEffect, useRef } from 'react';
import { audioEngine, AudioMappings } from '../audio/AudioEngine';
import { VoiceManager } from '../audio/VoiceManager';
import { LoopManager } from '../audio/LoopManager';
import { SynestheticParams, HSLColor, colorToAudioParams, applySynthColor } from '../utils/colorUtils';
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
  const animationRef = useRef<number>();
  const voiceCountRef = useRef<number>();
  const activeTouches = useRef<Set<number>>(new Set());
  const audioUnlockNeeded = useRef(true);
  const pendingTouch = useRef<{ id: number; x: number; y: number } | null>(null);

  // Ensure AudioContext is running - call on any user gesture (non-blocking for iOS)
  const ensureAudioUnlocked = useCallback(() => {
    if (!audioUnlockNeeded.current) return;
    
    try {
      // Fire resume without awaiting — iOS hangs on await resume()
      audioEngine.ensureResumed();
      audioUnlockNeeded.current = false;
    } catch (e) {
      console.warn('Audio unlock failed:', e);
    }
  }, []);

  // Initialize audio engine — non-blocking resume for iOS compatibility
  const initialize = useCallback(async () => {
    if (!isInitialized) {
      // initialize() now handles resume non-blockingly inside
      await audioEngine.initialize();
      audioUnlockNeeded.current = false;

      setIsInitialized(true);
      setIsPlaying(true);

      // Apply initial color
      const params = colorToAudioParams(color);
      audioEngine.setSynestheticParams(params);
      applySynthColor(color);

      // Replay the pending touch that triggered initialization
      if (pendingTouch.current) {
        const { id, x, y } = pendingTouch.current;
        pendingTouch.current = null;
        activeTouches.current.add(id);
        await audioEngine.createVoice(id, x, y);
        setActiveVoices(audioEngine.getActiveVoiceCount());
      }
    } else {
      ensureAudioUnlocked();
    }
  }, [isInitialized, color, ensureAudioUnlocked]);

  // Update mappings
  const updateMapping = useCallback((axis: 'x' | 'y', value: MappingOption) => {
    const newMappings = { ...mappings, [axis]: value };
    setMappings(newMappings);
    audioEngine.setMappings(newMappings);
  }, [mappings]);

  // Update grid mode - resets audio
  const updateGridMode = useCallback((mode: GridMode) => {
    // Clear local touch tracking
    activeTouches.current.clear();
    // AudioEngine.setGridMode handles the audio reset
    audioEngine.setGridMode(mode);
    setGridMode(mode);
    setActiveVoices(0);
  }, []);

  // Update color
  const updateColor = useCallback((newColor: HSLColor) => {
    setColor(newColor);
    const params = colorToAudioParams(newColor);
    audioEngine.setSynestheticParams(params);
    applySynthColor(newColor);
  }, []);

  // Update volume
  const updateVolume = useCallback((volume: number) => {
    setMasterVolume(volume);
    audioEngine.setMasterVolume(volume);
  }, []);

  // Stop all sound - guaranteed silence
  const stopAllSound = useCallback(() => {
    // Clear local touch tracking
    activeTouches.current.clear();
    // Stop all audio
    audioEngine.stopAllSound();
    setActiveVoices(0);
  }, []);

  // Touch handlers with duplicate prevention and audio unlock
  const handleTouchStart = useCallback(async (touchId: number, x: number, y: number) => {
    // If not initialized yet, store this touch to be replayed after init completes
    if (!isInitialized) {
      pendingTouch.current = { id: touchId, x, y };
      return;
    }

    // Prevent duplicate voice creation for same touch
    if (activeTouches.current.has(touchId)) {
      return;
    }

    // Ensure audio is unlocked on first gesture after page visibility change
    if (audioUnlockNeeded.current) {
      await ensureAudioUnlocked();
    }

    activeTouches.current.add(touchId);
    audioEngine.createVoice(touchId, x, y);
    setActiveVoices(audioEngine.getActiveVoiceCount());
  }, [isInitialized, ensureAudioUnlocked]);

  const handleTouchMove = useCallback((touchId: number, x: number, y: number) => {
    if (!isInitialized) return;
    // Only update if touch is tracked
    if (!activeTouches.current.has(touchId)) return;
    audioEngine.updateVoice(touchId, x, y);
  }, [isInitialized]);

  const handleTouchEnd = useCallback((touchId: number) => {
    if (!isInitialized) return;
    
    // Only release if touch was tracked
    if (!activeTouches.current.has(touchId)) return;
    
    activeTouches.current.delete(touchId);
    audioEngine.releaseVoice(touchId);
    
    // Update voice count after release
    setActiveVoices(audioEngine.getActiveVoiceCount());
  }, [isInitialized]);

  // Poll voice count for real-time updates
  useEffect(() => {
    if (!isInitialized) return;

    const updateVoiceCount = () => {
      const count = audioEngine.getActiveVoiceCount();
      if (count !== activeVoices) {
        setActiveVoices(count);
      }
      voiceCountRef.current = requestAnimationFrame(updateVoiceCount);
    };

    voiceCountRef.current = requestAnimationFrame(updateVoiceCount);

    return () => {
      if (voiceCountRef.current) {
        cancelAnimationFrame(voiceCountRef.current);
      }
    };
  }, [isInitialized, activeVoices]);

  // Waveform animation loop
  useEffect(() => {
    if (!isInitialized || !isPlaying) return;

    const updateWaveform = () => {
      const data = audioEngine.getWaveformData();
      setWaveformData(data);
      animationRef.current = requestAnimationFrame(updateWaveform);
    };

    animationRef.current = requestAnimationFrame(updateWaveform);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isInitialized, isPlaying]);

  // Visibility handling - mark audio unlock needed when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInitialized) {
        // Mark that we need to unlock audio on next gesture
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  // Apply preset settings - resets audio first
  const applySettings = useCallback((settings: {
    mappingX: MappingOption;
    mappingY: MappingOption;
    mode: GridMode;
    color: HSLColor;
  }) => {
    // Step 1: Stop all sound and clear all loops
    audioEngine.resetAudioState();
    setActiveVoices(0);
    
    // Step 2: Apply new settings after audio is reset
    const newMappings = { x: settings.mappingX, y: settings.mappingY };
    setMappings(newMappings);
    audioEngine.setMappings(newMappings);
    
    // Note: Don't call setGridMode here as it would reset audio again
    // Just update the internal mode without the reset
    setGridMode(settings.mode);
    
    setColor(settings.color);
    const params = colorToAudioParams(settings.color);
    audioEngine.setSynestheticParams(params);
    applySynthColor(settings.color);
  }, []);

  // Synesthetic color feedback — derived from audio state (GSI mapping)
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
  };
}
