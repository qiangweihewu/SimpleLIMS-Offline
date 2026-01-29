import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupIpcHandlers, setMainWindow } from './ipc-handlers';
import { closeDatabase } from './database/index';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let tray = null;
const isDev = process.env.NODE_ENV === 'development';
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '../public/icon.png'),
        title: 'SimpleLIMS-Offline',
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('close', (event) => {
        if (tray) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function createTray() {
    const iconPath = path.join(__dirname, '../public/icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '打开 SimpleLIMS',
            click: () => {
                mainWindow?.show();
            },
        },
        { type: 'separator' },
        {
            label: '仪器连接状态',
            enabled: false,
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                tray?.destroy();
                tray = null;
                app.quit();
            },
        },
    ]);
    tray.setToolTip('SimpleLIMS-Offline - 仪器监听中');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
        mainWindow?.show();
    });
}
app.whenReady().then(() => {
    // Setup IPC handlers before creating window
    setupIpcHandlers();
    createWindow();
    createTray();
    // Set main window reference for IPC handlers
    if (mainWindow) {
        setMainWindow(mainWindow);
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            if (mainWindow) {
                setMainWindow(mainWindow);
            }
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Keep app running in tray on Windows/Linux
    }
});
app.on('before-quit', () => {
    closeDatabase();
});
//# sourceMappingURL=main.js.map