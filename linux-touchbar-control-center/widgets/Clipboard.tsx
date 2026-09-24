import React, { useEffect, useState } from 'react';
import { Box, Text } from 'omarchy-touchbar';
import { FaClipboard } from 'react-icons/fa';
import { execFile } from 'child_process';
import { SELECTED_THEME } from '@/lib/theme';
import { STATUS } from '@/lib/statusColors';

const POLL_MS = 2_000;
const MAX_LEN = 30;

function readClipboard(): Promise<string> {
  return new Promise<string>((resolve) => {
    // The daemon is an unprivileged user service inside the user's own graphical
    // session, so no runuser/SUDO_USER hop is needed (and none is reachable —
    // the unit has no User=). Kept as `npx clipboardy` rather than a static
    // import: clipboardy 5 is ESM-only ("type": "module") and this package
    // compiles to CommonJS, so require() would fail on the supported Node 20.
    execFile('npx', ['clipboardy'], { timeout: 3000 }, (err, stdout) => {
      resolve(err ? '' : stdout.trim());
    });
  });
}

export function Clipboard() {
  const [text, setText] = useState('');

  useEffect(() => {
    let active = true;
    const poll = () => {
      readClipboard().then(t => { if (active) setText(t); });
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, []);

  const display = text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '...' : text;

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <FaClipboard style={{ width: 14, height: 14 }} fill={SELECTED_THEME.textSecondary} stroke="none" />
      </Box>
      <Text style={{ color: STATUS.normal, fontSize: 13 }}>
        {display || 'Empty'}
      </Text>
    </Box>
  );
}
