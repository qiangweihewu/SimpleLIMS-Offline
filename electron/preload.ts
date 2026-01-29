import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  // Database operations
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
    get: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
    all: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:all', sql, params),
  },

  // Instrument communication
  instrument: {
    listPorts: () => ipcRenderer.invoke('instrument:listPorts'),
    connect: (portPath: string, options: object) => ipcRenderer.invoke('instrument:connect', portPath, options),
    disconnect: (portPath: string) => ipcRenderer.invoke('instrument:disconnect', portPath),
    onData: (callback: (data: unknown) => void) => {
      ipcRenderer.on('instrument:data', (_event, data) => callback(data));
    },
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_event: unknown, status: unknown) => callback(status);
      ipcRenderer.on('instrument:status', listener);
      return () => ipcRenderer.removeListener('instrument:status', listener);
    },
  },

  // File operations
  file: {
    selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
    selectFile: (filters?: object[]) => ipcRenderer.invoke('file:selectFile', filters),
    saveFile: (defaultPath: string, content: string) => ipcRenderer.invoke('file:saveFile', defaultPath, content),
  },

  // Backup/Restore
  backup: {
    create: (targetPath: string) => ipcRenderer.invoke('backup:create', targetPath),
    restore: (sourcePath: string) => ipcRenderer.invoke('backup:restore', sourcePath),
  },

  // License
  license: {
    getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
  },
});
