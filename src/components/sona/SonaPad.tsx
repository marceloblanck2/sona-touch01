import React, { useCallback, useState, useEffect } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { Header } from './Header';
import { XYPad } from './XYPad';
import { Waveform } from './Waveform';
import { ControlPanel } from './ControlPanel';
import { PresetPanel } from './PresetPanel';
import { VoiceIndicator } from './VoiceIndicator';
import { Preset } from '../../presets/PresetManager';
import { Maximize2, Minimize2 } from 'lucide-react';
import { DebugOverlay } from '../DebugOverlay';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const glowToVolume = (size: number) => {
  const normalized = (size - 0.3) / (3 - 0.3);
  return Math.max(0.15, Math.min(1, 0.2 + normalized * 0.8));
};

export const SonaPad: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trailDuration, setTrailDuration] = useState(3);
  const [glowSize, setGlowSize] = useState(0.75);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const {
    isInitialized,
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
  } = useAudioEngine();

useEffect(() => {
  applySettings({
    mappingX: 'pan',
    mappingY: 'frequency',
    mode: 'flow',
    color: { h: 210, s: 60, l: 55 },
  });

  setGlowSize(0.75);
  setTrailDuration(3);
  updateVolume(glowToVolume(0.75));
}, [applySettings, updateVolume]);
  
  const handleLoadPreset = useCallback((preset: Preset) => {
    applySettings({
      mappingX: preset.mappingX,
      mappingY: preset.mappingY,
      mode: preset.mode,
      color: preset.color,
    });

    if (preset.behavior) {
      setGlowSize(preset.behavior.glowSize);
      setTrailDuration(preset.behavior.trailDuration);
      updateVolume(glowToVolume(preset.behavior.glowSize));
    }
  }, [applySettings, updateVolume]);

  const handleAdjustGlow = useCallback((delta: number) => {
    setGlowSize((prev) => {
      const next = clamp(prev + delta * 0.15, 0.3, 3);
      updateVolume(glowToVolume(next));
      return next;
    });
  }, [updateVolume]);

  const handleAdjustTrail = useCallback((delta: number) => {
    setTrailDuration((prev) => clamp(prev + delta * 0.35, 0.5, 8));
  }, []);

  const handleAdjustVolume = useCallback((delta: number) => {
    const next = clamp(masterVolume + delta * 0.08, 0, 1);
    updateVolume(next);
  }, [masterVolume, updateVolume]);

  if (isFullscreen) {
    const fullscreenBg = `
      radial-gradient(ellipse at 50% 50%, hsl(${color.h} ${color.s}% ${color.l}% / 0.08) 0%, transparent 60%),
      hsl(220 20% 6%)
    `;

    return (
      <div
        className="fixed inset-0 z-50 overflow-hidden"
        style={{
          background: fullscreenBg,
          height: '100svh',
          maxHeight: '100svh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 58px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <DebugOverlay />

        <div className="relative h-full w-full p-1">
          <XYPad
            gridMode={gridMode}
            color={color}
            trailDuration={trailDuration}
            glowSize={glowSize}
            getVoiceColor={getVoiceColor}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onInteractionStart={initialize}
            isFullscreen={true}
            onAdjustGlow={handleAdjustGlow}
            onAdjustTrail={handleAdjustTrail}
            onAdjustVolume={handleAdjustVolume}
          />

          <div
            className={`absolute z-30 flex items-center gap-2 ${
              isLandscape ? 'top-3 left-3' : 'top-3 right-3'
            }`}
          >
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsFullscreen(false);
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-md border text-[11px]"
              style={{
                color: `hsl(${color.h} ${color.s}% ${color.l}%)`,
                borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.25)`,
                background: 'hsl(220 15% 12% / 0.9)',
              }}
              title="Sair do fullscreen"
            >
              <Minimize2 size={14} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full px-4 py-4 md:px-8 md:py-6"
      style={{
        background: `
          radial-gradient(ellipse at 30% 20%, hsl(${color.h} ${color.s}% ${color.l}% / 0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, hsl(${(color.h + 180) % 360} 30% 30% / 0.05) 0%, transparent 50%),
          hsl(220 20% 6%)
        `,
      }}
    >
      <div className="max-w-7xl mx-auto">
        <DebugOverlay />

        <Header
          activeVoices={activeVoices}
          color={color}
          isInitialized={isInitialized}
          onStop={stopAllSound}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-8 space-y-4">
            <div
              className="sona-panel p-4 relative"
              style={{
                borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.15)`,
              }}
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(true);
                }}
                className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/40 hover:bg-background/60 transition-colors backdrop-blur-sm touch-manipulation"
                style={{ color: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
                title="Enter Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Fullscreen</span>
              </button>

              <XYPad
                gridMode={gridMode}
                color={color}
                trailDuration={trailDuration}
                glowSize={glowSize}
                getVoiceColor={getVoiceColor}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onInteractionStart={initialize}
                onAdjustGlow={handleAdjustGlow}
                onAdjustTrail={handleAdjustTrail}
                onAdjustVolume={handleAdjustVolume}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Waveform data={waveformData} color={color} height={80} />
              </div>

              <div
                className="sona-panel px-4 py-3"
                style={{
                  borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.1)`,
                }}
              >
                <VoiceIndicator
                  activeVoices={activeVoices}
                  color={color}
                  showText={true}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div
              className="sona-panel p-5"
              style={{
                borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.1)`,
              }}
            >
              <ControlPanel
                mappingX={mappings.x}
                mappingY={mappings.y}
                mode={gridMode}
                color={color}
                volume={masterVolume}
                trailDuration={trailDuration}
                glowSize={glowSize}
                onMappingXChange={(v) => updateMapping('x', v)}
                onMappingYChange={(v) => updateMapping('y', v)}
                onModeChange={updateGridMode}
                onColorChange={updateColor}
                onVolumeChange={updateVolume}
                onTrailDurationChange={setTrailDuration}
                onGlowSizeChange={setGlowSize}
              />
            </div>

            <div
              className="sona-panel p-5"
              style={{
                borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.1)`,
              }}
            >
              <PresetPanel
                currentSettings={{
                  mappingX: mappings.x,
                  mappingY: mappings.y,
                  mode: gridMode,
                  color,
                }}
                onLoadPreset={handleLoadPreset}
                accentColor={color}
              />
            </div>
          </div>
        </div>

        <footer className="mt-8 pt-4 border-t border-border/50">
          <div className="flex flex-wrap items-center justify-end gap-4 text-xs text-muted-foreground">
            <p className="opacity-60">
              Multitouch • Synesthesia • Gesture • Sound • Color • Emergent Behavior
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
