import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('wizardApi', {
  mode: () => ipcRenderer.invoke('wizard:mode'),
  start: () => ipcRenderer.send('wizard:start'),
  answer: (value: string) => ipcRenderer.send('wizard:answer', value),
  closeConfirmed: () => ipcRenderer.send('wizard:close-confirmed'),
  closeCancelled: () => ipcRenderer.send('wizard:close-cancelled'),
  onEvent: (cb: (event: unknown) => void) => {
    ipcRenderer.on('wizard:event', (_event, data: unknown) => cb(data));
  },
  onProcessExit: (cb: (result: { code: number | null; signal: string | null; interrupted: boolean }) => void) => {
    ipcRenderer.on('wizard:process-exit', (_event, data) => cb(data));
  },
  onAskClose: (cb: () => void) => {
    ipcRenderer.on('wizard:ask-close', () => cb());
  },
});

contextBridge.exposeInMainWorld('windowApi', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
  close: () => ipcRenderer.send('window:close'),
});
