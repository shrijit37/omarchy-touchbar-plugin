import React from 'react';
import { Box, Text } from 'omarchy-touchbar';
import { WiDaySunny, WiCloud, WiFog, WiRain, WiSnow, WiThunderstorm, WiNa } from 'react-icons/wi';
import { useWeather } from '@/lib/hooks/useWeather';
import { STATUS, WEATHER_ACCENTS } from '@/lib/statusColors';

// WMO weather codes (what Open-Meteo's `current.weather_code` returns),
// collapsed down to the handful of icons worth distinguishing on a bar this
// small — see https://open-meteo.com/en/docs for the full table. Each
// condition resolves to the named WEATHER_ACCENTS accent (documented in
// lib/statusColors.ts) so the whole map lives in one place; the hues that
// collide with the theme's slots (storm → info, clear → warning) reuse the
// status values so the one status language stays consistent.
function conditionFor(code: number): { Icon: typeof WiDaySunny; color: string } {
  if (code === 0) return { Icon: WiDaySunny, color: WEATHER_ACCENTS.clear };
  if (code <= 3) return { Icon: WiCloud, color: WEATHER_ACCENTS.cloud };
  if (code === 45 || code === 48) return { Icon: WiFog, color: WEATHER_ACCENTS.fog };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: WiRain, color: WEATHER_ACCENTS.rain };
  if (code >= 71 && code <= 77) return { Icon: WiSnow, color: WEATHER_ACCENTS.snow };
  if (code >= 95) return { Icon: WiThunderstorm, color: WEATHER_ACCENTS.storm };
  return { Icon: WiNa, color: STATUS.idle };
}

export function Weather() {
  const weather = useWeather();
  const { Icon, color } = conditionFor(weather?.code ?? -1);

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Icon style={{ width: 22, height: 22 }} fill={color} stroke="none" />
      </Box>
      <Text style={{ color, fontSize: 15, fontWeight: '600' }}>
        {weather ? `${Math.round(weather.tempC)}°` : '--°'}
      </Text>
    </Box>
  );
}
