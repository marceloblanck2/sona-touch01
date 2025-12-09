// SØNA Pad v2 - Main Application Component

import React, { useCallback } from 'react';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { Header } from './Header';
import { XYPad } from './XYPad';
import { Waveform } from './Waveform';
import { ControlPanel } from './ControlPanel';
import { PresetPanel } from './PresetPanel';
import { VoiceIndicator } from './VoiceIndicator';
import { Preset } from '../../presets/PresetManager';
import { MappingOption, GridMode } from '../../utils/constants';

export const SonaPad: React.FC = () => {
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
  } = useAudioEngine();

  const handleLoadPreset = useCallback((preset: Preset) => {
    applySettings({
      mappingX: preset.mappingX,
      mappingY: preset.mappingY,
      mode: preset.mode,
      color: preset.color,
    });
  }, [applySettings]);

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
        <Header 
          activeVoices={activeVoices} 
          color={color} 
          isInitialized={isInitialized}
          onStop={stopAllSound}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Main XY Pad Area */}
          <div className="lg:col-span-8 space-y-4">
            {/* XY Pad */}
            <div 
              className="sona-panel p-4"
              style={{
                borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.15)`,
              }}
            >
              <XYPad
                gridMode={gridMode}
                color={color}
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
                onMappingXChange={(v) => updateMapping('x', v)}
                onMappingYChange={(v) => updateMapping('y', v)}
                onModeChange={updateGridMode}
                onColorChange={updateColor}
                onVolumeChange={updateVolume}
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
