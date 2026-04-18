// SØM Touch - Main Application Component

import React, { useCallback, useState, useEffect } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { Header } from './Header';
import { XYPad } from './XYPad';
import { Waveform } from './Waveform';
import { ControlPanel } from './ControlPanel';
import { FullscreenControls } from './FullscreenControls';
import { PresetPanel } from './PresetPanel';
import { VoiceIndicator } from './VoiceIndicator';
import { Preset } from '../../presets/PresetManager';
import { MappingOption, GridMode } from '../../utils/constants';
import { Maximize2, Minimize2 } from 'lucide-react';
import { DebugOverlay } from '../DebugOverlay';

export const SonaPad: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trailDuration, setTrailDuration] = useState(3); // default 3 seconds
  const [glowSize, setGlowSize] = useState(1.0); // 1.0 = 100% default size
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect orientation for responsive fullscreen layout
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
    getAverageColor,
  } = useAudioEngine();

  const handleLoadPreset = useCallback((preset: Preset) => {
    applySettings({
      mappingX: preset.mappingX,
      mappingY: preset.mappingY,
      mode: preset.mode,
      color: preset.color,
    });
  }, [applySettings]);

  // Fullscreen Mode — responsive layout
  if (isFullscreen) {
    const fullscreenBg = `
      radial-gradient(ellipse at 50% 50%, hsl(${color.h} ${color.s}% ${color.l}% / 0.08) 0%, transparent 60%),
      hsl(220 20% 6%)
    `;

    return (
      <div 
        className={`fixed inset-0 z-50 flex ${isLandscape ? 'flex-row' : 'flex-col'}`}
        style={{
          background: fullscreenBg,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <DebugOverlay />
        {/* Landscape: controls on the LEFT */}
        {isLandscape && (
          <FullscreenControls
            color={color}
            gridMode={gridMode}
            volume={masterVolume}
            trailDuration={trailDuration}
            glowSize={glowSize}
            mappingX={mappings.x}
            mappingY={mappings.y}
            onModeChange={updateGridMode}
            onVolumeChange={updateVolume}
            onTrailChange={setTrailDuration}
            onSizeChange={setGlowSize}
            onMappingXChange={(v) => updateMapping('x', v)}
            onMappingYChange={(v) => updateMapping('y', v)}
            onExit={() => setIsFullscreen(false)}
            isLandscape={true}
          />
        )}
        
        {/* XY Pad — takes remaining space */}
        <div className="flex-1 p-1">
          <div className="h-full w-full">
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
            />
          </div>
        </div>

        {/* Portrait: controls on the BOTTOM */}
        {!isLandscape && (
          <FullscreenControls
            color={color}
            gridMode={gridMode}
            volume={masterVolume}
            trailDuration={trailDuration}
            glowSize={glowSize}
            mappingX={mappings.x}
            mappingY={mappings.y}
            onModeChange={updateGridMode}
            onVolumeChange={updateVolume}
            onTrailChange={setTrailDuration}
            onSizeChange={setGlowSize}
            onMappingXChange={(v) => updateMapping('x', v)}
            onMappingYChange={(v) => updateMapping('y', v)}
            onExit={() => setIsFullscreen(false)}
            isLandscape={false}
          />
        )}
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
          {/* Main XY Pad Area */}
          <div className="lg:col-span-8 space-y-4">
            {/* XY Pad with Fullscreen Toggle */}
            <div 
              className="sona-panel p-4 relative"
              style={{
                borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.15)`,
              }}
            >
              {/* Fullscreen Toggle Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(true);
                }}
                className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/40 hover:bg-background/60 transition-colors backdrop-blur-sm touch-manipulation"
                style={{ color: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
                title="Enter Focus Mode"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Focus</span>
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
              />
            </div>

            {/* Waveform and Voice Count */}
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

          {/* Control Panel */}
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

        {/* Footer */}
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
