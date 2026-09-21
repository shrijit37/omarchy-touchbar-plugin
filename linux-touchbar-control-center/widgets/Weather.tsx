import React from 'react';
import { Box, Text } from 'react-drm';
import { WiDaySunny, WiCloud, WiFog, WiRain, WiSnow, WiThunderstorm, WiNa } from 'react-icons/wi';
import { useWeather } from '@/lib/hooks/useWeather';
import { STATUS } from '@/lib/statusColors';
import { SELECTED_THEME } from '@/lib/theme';

// WMO weather codes (what Open-Meteo's `current.weather_code` returns),
// collapsed down to the handful of icons worth distinguishing on a bar this
// small — see https://open-meteo.com/en/docs for the full table. Each
// condition gets its own accent color so the icon reads at a glance instead
// of everything blending into one flat gray. The hues that collide with the
// theme's slots (storm → info, clear → warning) use the traffic-light values
// so the one status language stays consistent; the rest are kept distinct.
function conditionFor(code: number): { Icon: typeof WiDaySunny; color: string } {
  if (code === 0) return { Icon: WiDaySunny, color: STATUS.warn };
  if (code <= 3) return { Icon: WiCloud, color: STATUS.idle };
  if (code === 45 || code === 48) return { Icon: WiFog, color: '#cbd5e1' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: WiRain, color: '#60a5fa' };
  if (code >= 71 && code <= 77) return { Icon: WiSnow, color: '#e0f2fe' };
  if (code >= 95) return { Icon: WiThunderstorm, color: SELECTED_THEME.info };
  return { Icon: WiNa, color: STATUS.idle };
}

export function Weather() {
  const weather = useWeather();
  const { Icon, color } = conditionFor(weather?.code ?? -1);

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Box style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Icon style={{ width: 22, height: 22 }} fill={color} stroke="none" />
      </Box>
      <Text style={{ color: STATUS.normal, fontSize: 15, fontWeight: '600' }}>
        {weather ? `${Math.round(weather.tempC)}°` : '--°'}
      </Text>
    </Box>
  );
}
