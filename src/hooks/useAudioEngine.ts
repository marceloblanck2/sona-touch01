// SØNA Pad v2 - Audio Engine React Hook

import { useState, useCallback, useEffect, useRef } from 'react';
import { audioEngine, AudioMappings } from '../audio/AudioEngine';
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

  // Initialize audio engine
  const initialize = useCallback(async () => {
    if (!isInitialized) {
      await audioEngine.initialize();
      setIsInitialized(true);
      setIsPlaying(true);
      
      // Apply initial color
      const params = colorToAudioParams(color);
      audioEngine.setSynestheticParams(params);
      applySynthColor(color);
    }
  }, [isInitialized, color]);

  // Update mappings
  const updateMapping = useCallback((axis: 'x' | 'y', value: MappingOption) => {
    const newMappings = { ...mappings, [axis]: value };
    setMappings(newMappings);
    audioEngine.setMappings(newMappings);
  }, [mappings]);

  // Update grid mode
  const updateGridMode = useCallback((mode: GridMode) => {
    setGridMode(mode);
    audioEngine.setGridMode(mode);
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

  // Touch handlers
  const handleTouchStart = useCallback((touchId: number, x: number, y: number) => {
    if (!isInitialized) return;
    audioEngine.createVoice(touchId, x, y);
    setActiveVoices(audioEngine.getActiveVoiceCount());
  }, [isInitialized]);

  const handleTouchMove = useCallback((touchId: number, x: number, y: number) => {
    if (!isInitialized) return;
    audioEngine.updateVoice(touchId, x, y);
  }, [isInitialized]);

  const handleTouchEnd = useCallback((touchId: number) => {
    if (!isInitialized) return;
    audioEngine.releaseVoice(touchId);
    setTimeout(() => setActiveVoices(audioEngine.getActiveVoiceCount()), 100);
  }, [isInitialized]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  // Apply current settings
  const applySettings = useCallback((settings: {
    mappingX: MappingOption;
    mappingY: MappingOption;
    mode: GridMode;
    color: HSLColor;
  }) => {
    const newMappings = { x: settings.mappingX, y: settings.mappingY };
    setMappings(newMappings);
    audioEngine.setMappings(newMappings);
    
    setGridMode(settings.mode);
    audioEngine.setGridMode(settings.mode);
    
    setColor(settings.color);
    const params = colorToAudioParams(settings.color);
    audioEngine.setSynestheticParams(params);
    applySynthColor(settings.color);
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
  };
}
