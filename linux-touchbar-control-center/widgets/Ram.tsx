import React from 'react';
import { Box, Text } from 'omarchy-touchbar';
import { MdStorage } from 'react-icons/md';
import { useMemUsage } from '@/lib/hooks/useMemUsage';
import { STATUS } from '@/lib/statusColors';

function colorFor(pct: number): string {
  if (pct >= 85) return STATUS.danger;
  if (pct >= 60) return STATUS.warn;
  return STATUS.normal;
}

export function Ram() {
  const mem = useMemUsage();
  const color = colorFor(mem.pct);

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <MdStorage style={{ width: 18, height: 18 }} fill={color} stroke="none" />
      </Box>
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{`${mem.pct}%`}</Text>
    </Box>
  );
}
