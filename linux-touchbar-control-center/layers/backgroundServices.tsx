import React, { useState, useEffect } from 'react';
import { execFile } from 'child_process';
import { Box, Text } from 'react-drm';
import { BackButton } from '@/components/BackButton';
import { SELECTED_THEME, withAlpha } from '@/lib/theme';
import { STATUS } from '@/lib/statusColors';

interface Service {
  name:  string;
  state: 'active' | 'inactive' | 'failed' | 'unknown';
}

function parseServices(out: string): Service[] {
  return out
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 16)
    .map(line => {
      const p    = line.split(/\s+/);
      const name = (p[0] ?? '').replace(/\.service$/, '');
      const sub  = p[3] ?? '';
      const state: Service['state'] =
        sub === 'running' ? 'active'  :
        sub === 'failed'  ? 'failed'  :
        sub === 'dead'    ? 'inactive': 'unknown';
      return { name, state };
    });
}

function fetchServices(cb: (list: Service[]) => void) {
  execFile('systemctl', ['list-units', '--type=service', '--no-pager', '--no-legend', '--plain', '--all'],
    (e, o) => { if (!e) cb(parseServices(o)); });
}

// Themed palette: success/error slots for the dots, text tiers for labels,
// surface/border/divider for the chip boxes — a second, off-theme toolkit
// used to live here (was #22c55e/#334155/#ef4444/#0b1120/#1e293b, all of
// which duplicated SELECTED_THEME's own slots). The failed-state glow keeps
// the theme's error color as its translucent halo.
const DOT_COLOR = { active: STATUS.ok, inactive: SELECTED_THEME.divider, failed: STATUS.danger, unknown: SELECTED_THEME.divider } as const;
const TEXT_COLOR = { active: STATUS.idle, inactive: SELECTED_THEME.divider, failed: STATUS.danger, unknown: SELECTED_THEME.divider } as const;
const BG_COLOR   = { active: withAlpha(SELECTED_THEME.background, 0.55), inactive: withAlpha(SELECTED_THEME.background, 0.55), failed: withAlpha(SELECTED_THEME.error, 0.12), unknown: withAlpha(SELECTED_THEME.background, 0.55) } as const;
const BD_COLOR   = { active: SELECTED_THEME.divider, inactive: withAlpha(SELECTED_THEME.divider, 0.55), failed: withAlpha(SELECTED_THEME.error, 0.55), unknown: withAlpha(SELECTED_THEME.divider, 0.55) } as const;

export function BackgroundServices({ width, height }: { width: number; height: number }) {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    fetchServices(setServices);
    const id = setInterval(() => fetchServices(setServices), 5000);
    return () => clearInterval(id);
  }, []);

  const active   = services.filter(s => s.state === 'active').length;
  const failed   = services.filter(s => s.state === 'failed').length;
  const inactive = services.filter(s => s.state === 'inactive').length;

  return (
    <Box style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}>

      <BackButton />

      {/* Header label */}
      <Text color={SELECTED_THEME.divider} fontSize={10} fontFamily="monospace" style={{ fontWeight: '700' }}>SVCS</Text>

      {/* Stats */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: withAlpha(SELECTED_THEME.background, 0.55),
        borderColor: SELECTED_THEME.divider, borderWidth: 1, borderRadius: 6,
        paddingHorizontal: 10, paddingVertical: 3,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS.ok,
            shadowColor: STATUS.ok, shadowRadius: 3, shadowOpacity: 0.6 }} />
          <Text color={STATUS.ok} fontSize={12} fontFamily="monospace" style={{ fontWeight: '600' }}>{active}</Text>
        </Box>

        <Box style={{ width: 1, backgroundColor: SELECTED_THEME.divider, alignSelf: 'stretch' }} />

        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS.danger,
            shadowColor: STATUS.danger, shadowRadius: failed > 0 ? 4 : 0, shadowOpacity: failed > 0 ? 0.8 : 0 }} />
          <Text color={failed > 0 ? STATUS.danger : SELECTED_THEME.divider} fontSize={12} fontFamily="monospace" style={{ fontWeight: '600' }}>{failed}</Text>
        </Box>

        <Box style={{ width: 1, backgroundColor: SELECTED_THEME.divider, alignSelf: 'stretch' }} />

        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SELECTED_THEME.divider }} />
          <Text color={SELECTED_THEME.divider} fontSize={12} fontFamily="monospace">{inactive}</Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box style={{ width: 1, backgroundColor: SELECTED_THEME.divider, alignSelf: 'stretch', marginVertical: 6 }} />

      {/* Service chips */}
      <Box style={{ flex: 1, flexDirection: 'row', gap: 5, overflow: 'hidden' }}>
        {services.map(svc => (
          <Box
            key={svc.name}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: BG_COLOR[svc.state],
              borderColor: BD_COLOR[svc.state], borderWidth: 1, borderRadius: 5,
              paddingHorizontal: 7, paddingVertical: 2,
              shadowColor:   svc.state === 'failed' ? STATUS.danger : 'transparent',
              shadowRadius:  svc.state === 'failed' ? 4 : 0,
              shadowOpacity: svc.state === 'failed' ? 0.4 : 0,
            }}
          >
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: DOT_COLOR[svc.state] }} />
            <Text color={TEXT_COLOR[svc.state]} fontSize={11} fontFamily="monospace">{svc.name}</Text>
          </Box>
        ))}
      </Box>

    </Box>
  );
}
