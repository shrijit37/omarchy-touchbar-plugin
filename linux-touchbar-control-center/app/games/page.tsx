import React from 'react';
import { Box, Button, Text } from 'react-drm';
import { MdCancel, MdSportsEsports, MdPiano, MdSportsTennis } from 'react-icons/md';
import { useLayers } from '@/layers';
import { go } from '@/lib/routes/router-registry';
import { SELECTED_THEME } from '@/lib/theme';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

// The games menu (the branch's default child). Each game button steps up one
// tonal rung from the #000000 void (surface fill + hairline) per the bar's
// grammar — the old deep-blue #1a1a2e fields were a vestigial second world.
// Icon/label accents stay on the traffic-light slots, one voice per game.
//
// Two different `go`s: game buttons navigate *within* this branch (scoped
// useLayers().go), while "back to home" must exit the games branch entirely,
// which the global router does — the scoped host only knows dino/piano/pong.
export const layerConfig: LayerConfig = { animation: 'fade' };

const ITEM = {
  color:       SELECTED_THEME.surface,
  activeColor: SELECTED_THEME.surfaceVariant,
  borderColor: SELECTED_THEME.border,
  borderRadius: 10,
};

export default function GamesMenu({ height }: { height: number }) {
  const { go: goInner } = useLayers();

  return (
    <Box style={{ flex: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 8 }}>
      <Button
        width={60} height={height}
        color={SELECTED_THEME.background} activeColor={SELECTED_THEME.background}
        style={{ alignItems: 'center', justifyContent: 'center' }}
        onClick={() => go('splitted', 'slide-right')}
      >
        <MdCancel style={{ width: 32, height: 32 }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </Button>

      <Button
        {...ITEM}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => goInner('dino', 'slide-left')}
      >
        <MdSportsEsports style={{ width: 28, height: 28 }} fill={SELECTED_THEME.success} stroke="none" />
        <Text color={SELECTED_THEME.success} fontSize={16} fontFamily="IosevkaTerm Nerd Font">DINO</Text>
      </Button>

      <Button
        {...ITEM}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => goInner('piano', 'slide-left')}
      >
        <MdPiano style={{ width: 28, height: 28 }} fill={SELECTED_THEME.info} stroke="none" />
        <Text color={SELECTED_THEME.info} fontSize={16} fontFamily="IosevkaTerm Nerd Font">PIANO</Text>
      </Button>

      <Button
        {...ITEM}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => goInner('pong', 'slide-left')}
      >
        <MdSportsTennis style={{ width: 28, height: 28 }} fill={SELECTED_THEME.error} stroke="none" />
        <Text color={SELECTED_THEME.error} fontSize={16} fontFamily="IosevkaTerm Nerd Font">PONG</Text>
      </Button>
    </Box>
  );
}