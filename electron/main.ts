import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';

import { setupIpcHandlers, setMainWindow } from './ipc-handlers.js';
import { closeDatabase } from './database/index.js';
import { backupService } from './services/backup-service.js';
import { serialService } from './services/serial-service.js';
import { tcpService } from './services/tcp-service.js';
import { fileWatchService } from './services/file-watch-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../resources/icon.png'), // Adjusted path if needed, or assume process.resourcesPath in prod
    title: 'SimpleLIMS-Offline',
  });

  console.log('NODE_ENV:', process.env.NODE_ENV);
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow!.on('close', (event: any) => {
    if (tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow!.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png');
  const icon = nativeImage!.createFromPath(iconPath);
  tray = new Tray!(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu!.buildFromTemplate([
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
        app!.quit();
      },
    },
  ]);

  tray!.setToolTip('SimpleLIMS-Offline - 仪器监听中');
  tray!.setContextMenu(contextMenu);

  tray!.on('double-click', () => {
    mainWindow?.show();
  });
}

// Initialize services and window when ready
app.whenReady().then(() => {
  try {
    createWindow();

    // Setup IPC handlers with window reference for real-time events
    setupIpcHandlers(mainWindow!);

    // Initialize Auto Backup
    backupService.init();

    createTray();

    // Set main window reference for IPC handlers
    if (mainWindow) {
      setMainWindow(mainWindow);
    }
  } catch (err) {
    console.error('Failed to initialize application:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow) {
        setMainWindow(mainWindow);
      }
    }
  });
}).catch((err: any) => {
  console.error('Error during app startup:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Explicitly handle SIGINT (Ctrl+C) and SIGTERM
if (process.platform === 'darwin') {
  process.on('SIGINT', () => {
    console.log('Received SIGINT. Quitting...');
    app.quit();
  });
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Quitting...');
    app.quit();
  });
}

app.on('before-quit', async () => {
  console.log('Shutting down services...');

  // Create a timeout to force quit if cleanup takes too long (max 2 seconds)
  const timeout = setTimeout(() => {
    console.error('Cleanup timed out, forcing exit.');
    closeDatabase();
    process.exit(0);
  }, 2000);

  try {
    // Stop background jobs
    backupService.stop();

    // Disconnect instruments
    await Promise.allSettled([
      serialService.disconnectAll(),
      tcpService.disconnectAll(),
      fileWatchService.stopAll()
    ]);

    clearTimeout(timeout);
    closeDatabase();
    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error during services cleanup:', err);
    closeDatabase();
    process.exit(1);
  }
});
