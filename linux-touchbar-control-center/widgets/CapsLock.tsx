import React from 'react';
import { Box, Text } from 'omarchy-touchbar';
import { MdKeyboardCapslock } from 'react-icons/md';
import { useCapsLock } from '@/lib/hooks/useCapsLock';
import { STATUS } from '@/lib/statusColors';

export function CapsLock() {
  const on = useCapsLock();
  const color = on ? STATUS.warn : STATUS.idle;

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <MdKeyboardCapslock style={{ width: 18, height: 18 }} fill={color} stroke="none" />
      </Box>
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{on ? 'ON' : 'OFF'}</Text>
    </Box>
  );
}
