import React from 'react';
import { Box } from 'omarchy-touchbar';
import { PongGame } from '@/others/pong';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };

export default function PongPage({ width, height }: { width: number; height: number }) {
  const gameW = Math.floor(width / 2);
  const left  = Math.floor((width - gameW) / 2);
  return (
    <Box x={left} y={0} width={gameW} height={height}>
      <PongGame width={gameW} height={height} />
    </Box>
  );
}