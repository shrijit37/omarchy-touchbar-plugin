import React from 'react';
import { Button } from 'omarchy-touchbar';
import { MdCancel } from 'react-icons/md';
import { useLayers } from '@/layers';
import type { LayerAnimation, SwitchOptions } from '@/layers';
import { SELECTED_THEME } from '@/lib/theme';

export function BackButton({
  to = 'splitted',
  animation,
  switchOptions,
}: {
  to?: string;
  animation?: LayerAnimation;
  switchOptions?: SwitchOptions;
}) {
  const { go } = useLayers();
  return (
    <Button
      width={60} height={60}
      color={SELECTED_THEME.background} activeColor={SELECTED_THEME.background}
      style={{ alignItems: 'center', justifyContent: 'center' }}
      onClick={() => go(to, switchOptions ?? animation)}
    >
      <MdCancel style={{ width: 32, height: 32 }} fill={SELECTED_THEME.textPrimary} stroke="none" />
    </Button>
  );
}
