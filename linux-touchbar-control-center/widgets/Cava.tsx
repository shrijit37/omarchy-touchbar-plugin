import React from 'react';
import { Box } from 'omarchy-touchbar';
import { useCavaBars } from '@/lib/hooks/useCavaBars';
import { CAVA } from '@/config.blueprint';
import { SELECTED_THEME } from '@/lib/theme';

const GAP = 2;

const CAVA_BARS = CAVA.bars;

export function Cava({width}:{width:number}) {
  const {
    barsRef , bars,isActive,BAR_COLORS
  } = useCavaBars();
  return (
    // Fixed height, not auto — bar heights change every frame, and letting
    // the container re-size with them would make the whole widget jitter
    // vertically as it re-centers inside DraggableWidget's Button each frame.
    <Box style={{ alignItems: 'flex-end',width, paddingHorizontal: 8}}>
          <Box ref={barsRef} style={{ alignItems: 'flex-end', gap: GAP }}>
            {bars.map((h: any, i: number ) => (
              <Box key={i} style={{width:((width - 2*(CAVA_BARS -1) - 16)/CAVA_BARS) , height: h, backgroundColor: isActive ? BAR_COLORS[i] : SELECTED_THEME.divider }} />
            ))}
          </Box>
        </Box>
  );
}