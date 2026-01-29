import { contextBridge, ipcRenderer } from 'electron';
// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    // Database operations
    db: {
        query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
        run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
        get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
        all: (sql, params) => ipcRenderer.invoke('db:all', sql, params),
    },
    // Instrument communication
    instrument: {
        listPorts: () => ipcRenderer.invoke('instrument:listPorts'),
        connect: (portPath, options) => ipcRenderer.invoke('instrument:connect', portPath, options),
        disconnect: (portPath) => ipcRenderer.invoke('instrument:disconnect', portPath),
        onData: (callback) => {
            ipcRenderer.on('instrument:data', (_event, data) => callback(data));
        },
        onStatus: (callback) => {
            const listener = (_event, status) => callback(status);
            ipcRenderer.on('instrument:status', listener);
            return () => ipcRenderer.removeListener('instrument:status', listener);
        },
    },
    // File operations
    file: {
        selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
        selectFile: (filters) => ipcRenderer.invoke('file:selectFile', filters),
        saveFile: (defaultPath, content) => ipcRenderer.invoke('file:saveFile', defaultPath, content),
    },
    // Backup/Restore
    backup: {
        create: (targetPath) => ipcRenderer.invoke('backup:create', targetPath),
        restore: (sourcePath) => ipcRenderer.invoke('backup:restore', sourcePath),
    },
    // License
    license: {
        getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
        activate: (key) => ipcRenderer.invoke('license:activate', key),
        getStatus: () => ipcRenderer.invoke('license:getStatus'),
    },
});
//# sourceMappingURL=preload.js.map