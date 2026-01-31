import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  quit: () => ipcRenderer.invoke('app:quit'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),

  // Database operations
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
    get: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
    all: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:all', sql, params),
  },

  // Worklist operations
  worklist: {
    start: (orderId: number) => ipcRenderer.invoke('worklist:start', orderId),
  },

  // Instrument communication
  instrument: {
    listPorts: () => ipcRenderer.invoke('instrument:listPorts'),
    connect: (portPath: string, options: any) => ipcRenderer.invoke('instrument:connect', portPath, options),
    disconnect: (portPath: string, options?: any) => ipcRenderer.invoke('instrument:disconnect', portPath, options),
    getStatus: (portPath: string, options?: any) => ipcRenderer.invoke('instrument:getStatus', portPath, options),
    getAllStatuses: () => ipcRenderer.invoke('instrument:getAllStatuses'),
    simulate: (portPath: string) => ipcRenderer.invoke('instrument:simulate', portPath),
    onData: (callback: (data: unknown) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('instrument:data', listener);
      return () => ipcRenderer.removeListener('instrument:data', listener);
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
    showSaveDialog: (options?: object) => ipcRenderer.invoke('file:showSaveDialog', options),
    saveFile: (defaultPath: string, content: string) => ipcRenderer.invoke('file:saveFile', defaultPath, content),
  },

  // Backup/Restore
  backup: {
    create: (targetPath: string) => ipcRenderer.invoke('backup:create', targetPath),
    restore: (sourcePath: string) => ipcRenderer.invoke('backup:restore', sourcePath),
    updateSettings: (settings: { enabled: boolean; path: string; interval: string }) => ipcRenderer.invoke('backup:updateSettings', settings),
    getDefaultPath: () => ipcRenderer.invoke('backup:getDefaultPath'),
  },

  // Audit
  audit: {
    getLogs: (params?: any) => ipcRenderer.invoke('audit:getLogs', params || {}),
  },

  // System
  system: {
    checkInit: () => ipcRenderer.invoke('system:checkInit'),
    createFirstAdmin: (data: any) => ipcRenderer.invoke('system:createFirstAdmin', data),
  },

  // License
  license: {
    getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
  },

  // Report/PDF
  report: {
    printToPDF: (options: { filename?: string }) => ipcRenderer.invoke('print-to-pdf', options),
    print: () => ipcRenderer.invoke('print-page'),
  },

  // Driver Management
  driver: {
    getAll: () => ipcRenderer.invoke('driver:getAll'),
    get: (id: string) => ipcRenderer.invoke('driver:get', id),
  },

  // Auth
  auth: {
    login: (creds: any) => ipcRenderer.invoke('auth:login', creds),
  },

  // User Management
  user: {
    getAll: () => ipcRenderer.invoke('user:getAll'),
    create: (data: any) => ipcRenderer.invoke('user:create', data),
    update: (data: any) => ipcRenderer.invoke('user:update', data),
    toggleActive: (id: number, isActive: boolean) => ipcRenderer.invoke('user:toggleActive', { id, isActive }),
    delete: (id: number) => ipcRenderer.invoke('user:delete', id),
  },

  // IPC event listeners
  on: (channel: string, callback: (data: unknown) => void) => {
    const listener = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  ipc: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  }
});
