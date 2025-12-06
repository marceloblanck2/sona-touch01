// SØNA Pad v2 - XY Mapping Selector Component

import React from 'react';
import { MAPPING_OPTIONS, MappingOption } from '../../utils/constants';
import { HSLColor } from '../../utils/colorUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface MappingSelectorProps {
  axis: 'X' | 'Y';
  value: MappingOption;
  onChange: (value: MappingOption) => void;
  color: HSLColor;
}

export const MappingSelector: React.FC<MappingSelectorProps> = ({
  axis,
  value,
  onChange,
  color,
}) => {
  return (
    <div className="flex items-center gap-3">
      <span 
        className="font-mono text-sm font-medium w-8"
        style={{ color: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
      >
        {axis}→
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as MappingOption)}>
        <SelectTrigger 
          className="w-[140px] bg-muted border-border text-foreground text-sm"
          style={{
            borderColor: `hsl(${color.h} ${color.s}% ${color.l}% / 0.3)`,
          }}
        >
          <SelectValue placeholder="Select mapping" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {MAPPING_OPTIONS.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="text-foreground focus:bg-muted focus:text-foreground"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
