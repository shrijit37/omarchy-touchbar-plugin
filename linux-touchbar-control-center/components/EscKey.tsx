import React from 'react';
import { Box, Text, Button, KEY } from 'react-drm';
import { keys } from '@/lib/services/keyInjector';
import { SELECTED_THEME } from '@/lib/theme';

/**
 * On-screen Esc key for wide Touch Bars that have no physical Esc.
 * Injects KEY.ESC through the shared KeyInjector, like the Fn-key row.
 */
export function EscKey({ width, height: _height }: { width: number; height: number }) {
  // height is accepted (callers pass it) but the key fills its parent's full
  // height via flex, so it isn't read here.
  return (
    <Box style={{ width, backgroundColor: SELECTED_THEME.background }}>
      <Button
        color={SELECTED_THEME.surface}
        activeColor={SELECTED_THEME.surfaceVariant}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderTopLeftRadius:     10,
          borderBottomLeftRadius:  10,
          borderTopRightRadius:    10,
          borderBottomRightRadius: 10,
        }}
        onClick={() => keys.pressKey(KEY.ESC)}
      >
        <Text  fontSize={22} style={{ fontWeight: '700', color: SELECTED_THEME.textPrimary }}>esc</Text>
      </Button>
    </Box>
  );
}
