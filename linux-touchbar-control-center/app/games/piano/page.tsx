import React from 'react';
import { Box } from 'react-drm';
import { Piano } from '@/others/piano';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };

export default function PianoPage({ width, height }: { width: number; height: number }) {
  return (
    <Box style={{ flex: 1 }}>
      <Piano width={width} height={height} />
    </Box>
  );
}