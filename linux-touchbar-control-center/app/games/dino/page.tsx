import React from 'react';
import { Box } from 'omarchy-touchbar';
import { DinoGame } from '@/others/dino';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };

export default function DinoPage({ width, height }: { width: number; height: number }) {
  const gameW = Math.floor(width / 2);
  const left  = Math.floor((width - gameW) / 2);
  return (
    <Box x={left} y={0} width={gameW} height={height}>
      <DinoGame width={gameW} height={height} />
    </Box>
  );
}