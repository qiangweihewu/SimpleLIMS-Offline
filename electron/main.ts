import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { app, BrowserWindow, Tray, Menu, nativeImage, protocol, net } from 'electron';
import fs from 'fs';

import { setupIpcHandlers, setMainWindow } from './ipc-handlers.js';
import { closeDatabase } from './database/index.js';
import { backupService } from './services/backup-service.js';
import { serialService } from './services/serial-service.js';
import { tcpService } from './services/tcp-service.js';
import { fileWatchService } from './services/file-watch-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom protocol for local files
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-data', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

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
      webSecurity: false, // Allow access to local files
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
    title: 'SimpleLIMS-Offline',
  });

  // Handle media permissions for camera/microphone access
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    const allowedPermissions = ['camera', 'microphone', 'media', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      console.log('Permission granted:', permission);
      callback(true);
    } else {
      console.log('Permission denied:', permission);
      callback(false);
    }
  });

  // Handle permission checks
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('Permission check:', permission, 'from:', requestingOrigin);
    const allowedPermissions = ['camera', 'microphone', 'media', 'display-capture'];
    const allowed = allowedPermissions.includes(permission);
    console.log('Permission check result:', allowed);
    return allowed;
  });

  // Handle certificate errors for local development
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    callback(0); // Accept all certificates
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
app.whenReady().then(async () => {
  try {
    // Handle the custom protocol
    protocol.handle('app-data', (request) => {
      try {
        const url = request.url;
        // console.log('app-data protocol request:', url);

        // Remove the protocol prefix and decode the path
        let filePath = decodeURIComponent(url.replace('app-data://', ''));

        // Handle different path formats
        if (filePath.startsWith('/')) {
          // Absolute path - use as is
        } else if (filePath.startsWith('users/') || filePath.startsWith('Users/')) {
          // Relative path that should be absolute
          filePath = '/' + filePath;
        }

        // console.log('Resolved file path:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.error('File not found:', filePath);
          return new Response('File not found', { status: 404 });
        }

        // Determine MIME type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'application/octet-stream';

        switch (ext) {
          case '.jpg':
          case '.jpeg':
            mimeType = 'image/jpeg';
            break;
          case '.png':
            mimeType = 'image/png';
            break;
          case '.gif':
            mimeType = 'image/gif';
            break;
          case '.webp':
            mimeType = 'image/webp';
            break;
          case '.mp4':
            mimeType = 'video/mp4';
            break;
          case '.avi':
            mimeType = 'video/x-msvideo';
            break;
          case '.mov':
            mimeType = 'video/quicktime';
            break;
          case '.webm':
            mimeType = 'video/webm';
            break;
        }

        const fileStat = fs.statSync(filePath);
        const fileSize = fileStat.size;
        const range = request.headers.get('Range');

        // For small files (< 10MB), use buffer-based approach
        // For larger files, use streaming with proper error handling
        const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;

          // Read the requested chunk
          const buffer = Buffer.alloc(chunksize);
          const fd = fs.openSync(filePath, 'r');
          fs.readSync(fd, buffer, 0, chunksize, start);
          fs.closeSync(fd);

          return new Response(buffer, {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize.toString(),
              'Content-Type': mimeType,
            }
          });
        } else {
          // Return full file
          const fileBuffer = fs.readFileSync(filePath);

          return new Response(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': fileSize.toString(),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'no-cache'
            }
          });
        }
      } catch (e) {
        console.error('Failed to handle app-data protocol:', e);
        return new Response('Internal server error', { status: 500 });
      }
    });

    createWindow();

    // Setup IPC handlers with window reference for real-time events
    await setupIpcHandlers(mainWindow!);

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

app.on('before-quit', async (event) => {
  console.log('App closing: proactively destroying windows...');

  // 1. Proactively destroy all windows to stop Renderer process immediately.
  // This kills IPC requests and closes any attached DevTools "zombie" windows.
  BrowserWindow.getAllWindows().forEach((win) => win.destroy());

  // Create a timeout to force quit if cleanup takes too long (max 2 seconds)
  const timeout = setTimeout(() => {
    console.error('Cleanup timed out, forcing exit.');
    try { closeDatabase(); } catch (e) { /* ignore */ }
    process.exit(0);
  }, 2000);

  console.log('Shutting down services...');
  try {
    // 2. Stop background jobs
    backupService.stop();

    // 3. Disconnect instruments (this can now happen without UI interference)
    await Promise.allSettled([
      serialService.disconnectAll(),
      tcpService.disconnectAll(),
      fileWatchService.stopAll()
    ]);

    clearTimeout(timeout);

    // 4. Finally close database
    closeDatabase();
    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error during services cleanup:', err);
    try { closeDatabase(); } catch (e) { /* ignore */ }
    process.exit(1);
  }
});
