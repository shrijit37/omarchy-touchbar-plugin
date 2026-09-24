




import React from 'react';
import path from 'path';
import { Box, Button, KEY, Svg } from 'omarchy-touchbar';
import {
  MdClose,
  MdBrightness4, MdBrightness7,
  MdMicOff,
  MdSearch,
  MdSkipPrevious, MdPlayArrow, MdSkipNext,
  MdVolumeOff, MdVolumeDown, MdVolumeUp,
  MdApps,
  MdArrowRight,
  MdArrowForward,
  MdArrowBackIos,
  MdOutlineArrowForward,
  MdOutlineSubdirectoryArrowLeft,
  MdOutlineArrowOutward,
} from 'react-icons/md';
import { keys } from '@/lib/services/keyInjector';
import { SELECTED_THEME } from '@/lib/theme';
import type { LayerConfig } from '@/lib/routes/loadRoutes';
import { HiMiniPlayPause } from 'react-icons/hi2';
import { FaArrowRight } from 'react-icons/fa6';
import { IoIosArrowRoundForward } from 'react-icons/io';

export const layerConfig: LayerConfig = {
  leaving:  { outAnim: 'fade' },
  entering: { inAnim:  'fade' },
};

// app/media/page.tsx sits two levels under its own root in both trees
// (linux-touchbar-control-center/app/media in dev, dist/app/media once
// built, with assets/ copied alongside dist/ at build time) — same relative
// depth either way, so one formula covers both instead of a dev/built branch.
const KBD_ILLUM_DOWN_ICON = path.join(__dirname, '..', '..', 'assets', 'kbd_illum_down.svg');
const KBD_ILLUM_UP_ICON   = path.join(__dirname, '..', '..', 'assets', 'kbd_illum_up.svg');

// ── Actions ────────────────────────────────────────────────────────────────────

type Action =
  | 'BrightnessDown' | 'BrightnessUp'
  | 'IllumDown' | 'IllumUp'
  | 'Mute' | 'VolumeDown' | 'VolumeUp'
  | 'PreviousSong' | 'PlayPause' | 'NextSong'
  | 'Unknown';

function run(action: Action) {
  switch (action) {
    case 'BrightnessDown':   return keys.pressKey(KEY.BRIGHTNESSDOWN);
    case 'BrightnessUp':     return keys.pressKey(KEY.BRIGHTNESSUP);
    case 'IllumDown':        return keys.pressKey(KEY.KBDILLUMDOWN);
    case 'IllumUp':          return keys.pressKey(KEY.KBDILLUMUP);
    case 'VolumeDown':       return keys.pressKey(KEY.VOLUMEDOWN);
    case 'VolumeUp':         return keys.pressKey(KEY.VOLUMEUP);
    case 'NextSong':         return keys.pressKey(KEY.NEXTSONG);
    case 'PlayPause':         return keys.pressKey(KEY.PLAYPAUSE);
    case 'PreviousSong':         return keys.pressKey(KEY.PREVIOUSSONG);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

const ICON_SIZE = 30;

function ToolBtn({ onClick, children }: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
    width={110}
      color={SELECTED_THEME.surface}
      activeColor={SELECTED_THEME.surfaceVariant}
      style={{  alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderColor: SELECTED_THEME.border, borderWidth: SELECTED_THEME.borderWidth }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export default function LockScreen({ width, height }: { width: number; height: number }) {
  return (
    <Box style={{ flex: 1,gap: 10 }}>


<Box style={{flexGrow:1 , gap:24}}>

      <Box style={{gap:4 }} >

      <ToolBtn onClick={() => run('BrightnessDown')}>
        <MdBrightness4 style={{ width: ICON_SIZE, height: ICON_SIZE }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </ToolBtn>

      <ToolBtn onClick={() => run('BrightnessUp')}>
        <MdBrightness7 style={{ width: ICON_SIZE, height: ICON_SIZE }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </ToolBtn>
</Box>
  
    

      <Box style={{gap:4 }}   >

      <ToolBtn onClick={() => run('IllumDown')}>
        <Svg src={KBD_ILLUM_DOWN_ICON} width={ICON_SIZE} height={ICON_SIZE} />
      </ToolBtn>

      <ToolBtn onClick={() => run('IllumUp')}>
        <Svg src={KBD_ILLUM_UP_ICON} width={ICON_SIZE} height={ICON_SIZE} />
      </ToolBtn>
</Box>


      <Box style={{gap:4 }} >

      <ToolBtn onClick={() => run('Mute')}>
        <MdVolumeOff style={{ width: ICON_SIZE, height: ICON_SIZE }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </ToolBtn>

      <ToolBtn onClick={() => run('VolumeDown')}>
        <MdVolumeDown style={{ width: ICON_SIZE, height: ICON_SIZE }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </ToolBtn>

      <ToolBtn onClick={() => run('VolumeUp')}>
        <MdVolumeUp style={{ width: ICON_SIZE, height: ICON_SIZE }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </ToolBtn>
</Box>
      <Box style={{gap:4}} >



      <ToolBtn onClick={() => run('PlayPause')}>
        
        <HiMiniPlayPause style={{ width: ICON_SIZE, height: ICON_SIZE }} fill={SELECTED_THEME.textPrimary} stroke="none" />
      </ToolBtn>

</Box>
</Box>

    </Box>
  );
}
