import React from 'react';
import { Box, Button } from 'react-drm';
import { MdCancel } from 'react-icons/md';
import { useLayers } from '@/layers';
import type { LayoutChildren, LayerConfig } from '@/lib/routes/loadRoutes';
import { DEFAULT_CHILD_NAME } from '@/lib/routes/loadRoutes';
import { SELECTED_THEME } from '@/lib/theme';

// The games branch host – holds the menu (this folder's own page.tsx, named
// DEFAULT_CHILD_NAME) plus the game pages (dino/pong/piano). Game buttons
// navigate *within* this branch via the scoped useLayers().go, and this
// layout's BackButton returns to the menu the same way — the global router
// would be a self-navigation no-op from inside this host. "Home" out of the
// games branch entirely lives on the menu page's own BackButton.
export const layerConfig: LayerConfig = { leaving: { outAnim: 'slide-right' } };

const BACK_W = 60;

export default function GamesLayout({ width, height, children, current }: {
  width:    number;
  height:   number;
  children: LayoutChildren;
  path:     string;
  current:  string;
}) {
  const { go } = useLayers();
  const isMenu = !current || current === DEFAULT_CHILD_NAME;

  return (
    <Box style={{ flex: 1, flexDirection: 'row' }}>
      {!isMenu && (
        <Button
          width={BACK_W} height={height}
          color={SELECTED_THEME.background} activeColor={SELECTED_THEME.background}
          style={{ alignItems: 'center', justifyContent: 'center' }}
          onClick={() => go(DEFAULT_CHILD_NAME, 'slide-right')}
        >
          <MdCancel style={{ width: 32, height: 32 }} fill={SELECTED_THEME.textPrimary} stroke="none" />
        </Button>
      )}
      <Box x={isMenu ? 0 : BACK_W} y={0} width={isMenu ? width : width - BACK_W} height={height}>
        {children(isMenu ? width : width - BACK_W, height)}
      </Box>
    </Box>
  );
}