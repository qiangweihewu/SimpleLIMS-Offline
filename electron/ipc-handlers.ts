/**
 * IPC Handlers for Electron Main Process
 * Bridges renderer process requests to native functionality
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { initDatabase, getDatabase, query, get, run, backupDatabase, restoreDatabase } from './database/index';
import { serialService } from './services/serial-service';
import { extractTestCode, parseResultValue, mapAbnormalFlag } from './services/astm-parser';
import crypto from 'crypto';
import os from 'os';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

export function setupIpcHandlers() {
  // Initialize database
  initDatabase();

  // ============= Database Operations =============
  
  ipcMain.handle('db:query', async (_event, sql: string, params?: unknown[]) => {
    return query(sql, params || []);
  });

  ipcMain.handle('db:run', async (_event, sql: string, params?: unknown[]) => {
    return run(sql, params || []);
  });

  ipcMain.handle('db:get', async (_event, sql: string, params?: unknown[]) => {
    return get(sql, params || []);
  });

  ipcMain.handle('db:all', async (_event, sql: string, params?: unknown[]) => {
    return query(sql, params || []);
  });

  // ============= Instrument Communication =============

  ipcMain.handle('instrument:listPorts', async () => {
    return serialService.listPorts();
  });

  ipcMain.handle('instrument:connect', async (_event, portPath: string, options: {
    baudRate: number;
    dataBits?: 5 | 6 | 7 | 8;
    stopBits?: 1 | 1.5 | 2;
    parity?: 'none' | 'even' | 'odd';
    instrumentId: number;
  }) => {
    try {
      await serialService.connect(options.instrumentId, {
        path: portPath,
        baudRate: options.baudRate,
        dataBits: options.dataBits,
        stopBits: options.stopBits,
        parity: options.parity,
      });
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  });

  ipcMain.handle('instrument:disconnect', async (_event, portPath: string) => {
    await serialService.disconnect(portPath);
  });

  ipcMain.handle('instrument:getStatus', async (_event, portPath: string) => {
    return serialService.getStatus(portPath);
  });

  ipcMain.handle('instrument:getAllStatuses', async () => {
    const statuses = serialService.getAllStatuses();
    return Object.fromEntries(statuses);
  });

  // ============= File Operations =============

  ipcMain.handle('file:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('file:selectFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('file:saveFile', async (_event, defaultPath: string, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath,
    });
    if (result.canceled || !result.filePath) return null;
    
    const fs = await import('fs/promises');
    await fs.writeFile(result.filePath, content, 'utf-8');
    return result.filePath;
  });

  // ============= Backup/Restore =============

  ipcMain.handle('backup:create', async (_event, targetPath: string) => {
    return backupDatabase(targetPath);
  });

  ipcMain.handle('backup:restore', async (_event, sourcePath: string) => {
    return restoreDatabase(sourcePath);
  });

  // ============= License =============

  ipcMain.handle('license:getMachineId', async () => {
    // Generate machine ID from hardware info
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();
    
    const data = [
      os.hostname(),
      os.platform(),
      os.arch(),
      cpus[0]?.model || '',
      Object.values(networkInterfaces)
        .flat()
        .find(i => i && !i.internal && i.mac !== '00:00:00:00:00:00')?.mac || '',
    ].join('|');

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    // Format as readable ID
    return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`.toUpperCase();
  });

  ipcMain.handle('license:activate', async (_event, key: string) => {
    // Simple validation - in production, use proper RSA signature verification
    if (!key || key.length < 16) {
      return { success: false, message: '无效的许可证密钥' };
    }
    
    // Store license info
    const db = getDatabase();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_key', ?)`).run(key);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_activated_at', datetime('now'))`).run();
    
    return { success: true, message: '许可证激活成功' };
  });

  ipcMain.handle('license:getStatus', async () => {
    const db = getDatabase();
    const licenseKey = db.prepare(`SELECT value FROM settings WHERE key = 'license_key'`).get() as { value: string } | undefined;
    const activatedAt = db.prepare(`SELECT value FROM settings WHERE key = 'license_activated_at'`).get() as { value: string } | undefined;
    
    const machineIdResult = await ipcMain.emit('license:getMachineId');
    
    return {
      activated: !!licenseKey?.value,
      machineId: machineIdResult || 'UNKNOWN',
      activatedAt: activatedAt?.value,
      licenseType: licenseKey?.value ? 'professional' : 'trial',
    };
  });

  // ============= Setup Instrument Event Forwarding =============

  serialService.on('connected', (data) => {
    mainWindow?.webContents.send('instrument:status', { ...data, status: 'connected' });
  });

  serialService.on('disconnected', (data) => {
    mainWindow?.webContents.send('instrument:status', { ...data, status: 'disconnected' });
  });

  serialService.on('error', (data) => {
    mainWindow?.webContents.send('instrument:status', { ...data, status: 'error' });
  });

  serialService.on('message', async (data) => {
    const { instrumentId, message, raw, timestamp } = data;
    
    // Process results and store in database
    for (const result of message.results) {
      const testCode = extractTestCode(result.universalTestId);
      const { numeric, text } = parseResultValue(result.dataValue);
      const flag = mapAbnormalFlag(result.abnormalFlags);
      
      // Get sample ID from order record
      const sampleId = message.orders[0]?.specimenId || message.orders[0]?.instrumentSpecimenId;
      
      // Send to renderer
      mainWindow?.webContents.send('instrument:data', {
        instrumentId,
        timestamp,
        sampleId,
        testCode,
        value: text,
        numericValue: numeric,
        unit: result.units,
        flag,
        raw: raw,
      });
    }

    // If no matching sample, store in unmatched data
    if (message.results.length > 0) {
      const sampleId = message.orders[0]?.specimenId || message.orders[0]?.instrumentSpecimenId || 'UNKNOWN';
      
      const db = getDatabase();
      const existingSample = db.prepare(`SELECT id FROM samples WHERE sample_id = ?`).get(sampleId);
      
      if (!existingSample) {
        db.prepare(`
          INSERT INTO unmatched_data (instrument_id, sample_id_raw, raw_data, parsed_data, status)
          VALUES (?, ?, ?, ?, 'pending')
        `).run(instrumentId, sampleId, raw, JSON.stringify(message));
        
        mainWindow?.webContents.send('instrument:unmatched', {
          instrumentId,
          sampleId,
          resultCount: message.results.length,
          timestamp,
        });
      }
    }
  });

  console.log('IPC handlers registered');
}
