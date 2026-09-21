import React from 'react';
import { Box, Text } from 'omarchy-touchbar';
import { MdMemory } from 'react-icons/md';
import { useCpuUsage } from '@/lib/hooks/useCpuUsage';
import { STATUS } from '@/lib/statusColors';

function colorFor(pct: number): string {
  if (pct >= 85) return STATUS.danger;
  if (pct >= 60) return STATUS.warn;
  return STATUS.normal;
}

export function Cpu() {
  const pct = useCpuUsage();
  const color = pct === null ? STATUS.idle : colorFor(pct);

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <MdMemory style={{ width: 18, height: 18 }} fill={color} stroke="none" />
      </Box>
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
        {pct === null ? '--%' : `${pct}%`}
      </Text>
    </Box>
  );
}
