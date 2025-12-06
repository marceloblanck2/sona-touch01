import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, style, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    style={style}
    {...props}
  >
    <SliderPrimitive.Track 
      className="relative h-2 w-full grow overflow-hidden rounded-full"
      style={{ background: 'var(--slider-track-bg, hsl(var(--secondary)))' }}
    >
      <SliderPrimitive.Range 
        className="absolute h-full" 
        style={{ background: 'var(--slider-range-bg, hsl(var(--primary)))' }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb 
      className="block h-4 w-4 rounded-full border-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" 
      style={{ 
        background: 'var(--slider-thumb-bg, hsl(var(--primary)))',
        borderColor: 'var(--slider-thumb-bg, hsl(var(--primary)))',
        boxShadow: '0 0 10px var(--slider-thumb-bg, hsl(var(--primary) / 0.5))',
      }}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
