// SØNA Pad v2 - Color Picker for Synesthetic Sound

import React, { useState, useCallback } from 'react';
import { HSLColor, hslToHex, hexToHSL } from '../../utils/colorUtils';
import { PHI } from '../../utils/constants';

interface ColorPickerProps {
  color: HSLColor;
  onChange: (color: HSLColor) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hexColor = hslToHex(color);

  const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      onChange(hexToHSL(newHex));
    }
  }, [onChange]);

  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...color, h: parseInt(e.target.value) });
  }, [color, onChange]);

  const handleSaturationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...color, s: parseInt(e.target.value) });
  }, [color, onChange]);

  const handleLightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...color, l: parseInt(e.target.value) });
  }, [color, onChange]);

  // Quick color presets based on Golden Ratio divisions
  const presets = [
    { h: 0, s: 75, l: 55 },      // Red
    { h: 38, s: 75, l: 55 },     // Gold
    { h: 60, s: 75, l: 55 },     // Yellow
    { h: 120, s: 60, l: 45 },    // Green
    { h: 180, s: 70, l: 45 },    // Cyan
    { h: 210, s: 70, l: 50 },    // Blue
    { h: 270, s: 60, l: 50 },    // Purple
    { h: 320, s: 70, l: 55 },    // Magenta
  ];

  return (
    <div className="space-y-3">
      {/* Color preview and toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative w-12 h-12 rounded-lg overflow-hidden transition-transform duration-200 hover:scale-105"
          style={{
            background: `hsl(${color.h} ${color.s}% ${color.l}%)`,
            boxShadow: `0 0 20px hsl(${color.h} ${color.s}% ${color.l}% / 0.4)`,
            border: '2px solid hsl(220 15% 25%)',
          }}
        >
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
            }}
          />
        </button>
        
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">Synesthetic Color</p>
          <input
            type="text"
            value={hexColor.toUpperCase()}
            onChange={handleHexChange}
            className="w-24 bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground"
            style={{ 
              borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.3)`,
            }}
          />
        </div>
      </div>

      {/* Color presets */}
      <div className="flex gap-2">
        {presets.map((preset, i) => (
          <button
            key={i}
            onClick={() => onChange(preset)}
            className="w-6 h-6 rounded-full transition-transform duration-200 hover:scale-110"
            style={{
              background: `hsl(${preset.h} ${preset.s}% ${preset.l}%)`,
              boxShadow: color.h === preset.h 
                ? `0 0 10px hsl(${preset.h} ${preset.s}% ${preset.l}% / 0.6)`
                : 'none',
              border: color.h === preset.h 
                ? '2px solid hsl(0 0% 100% / 0.5)'
                : '1px solid hsl(220 15% 25%)',
            }}
          />
        ))}
      </div>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="space-y-3 pt-2 animate-fade-in">
          {/* Hue slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Hue</span>
              <span>{color.h}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={color.h}
              onChange={handleHueChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, 
                  hsl(0, ${color.s}%, ${color.l}%), 
                  hsl(60, ${color.s}%, ${color.l}%), 
                  hsl(120, ${color.s}%, ${color.l}%), 
                  hsl(180, ${color.s}%, ${color.l}%), 
                  hsl(240, ${color.s}%, ${color.l}%), 
                  hsl(300, ${color.s}%, ${color.l}%), 
                  hsl(360, ${color.s}%, ${color.l}%)
                )`,
              }}
            />
          </div>

          {/* Saturation slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Saturation</span>
              <span>{color.s}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={color.s}
              onChange={handleSaturationChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, 
                  hsl(${color.h}, 0%, ${color.l}%), 
                  hsl(${color.h}, 100%, ${color.l}%)
                )`,
              }}
            />
          </div>

          {/* Lightness slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Brightness</span>
              <span>{color.l}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={color.l}
              onChange={handleLightnessChange}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, 
                  hsl(${color.h}, ${color.s}%, 10%), 
                  hsl(${color.h}, ${color.s}%, 50%),
                  hsl(${color.h}, ${color.s}%, 90%)
                )`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
