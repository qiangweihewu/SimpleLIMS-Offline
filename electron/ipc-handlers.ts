/**
 * IPC Handlers for Electron Main Process
 * Bridges renderer process requests to native functionality
 */

import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { initDatabase, getDatabase, query, get, run, backupDatabase, restoreDatabase, isDatabaseInitialized } from './database/index.js';
import { serialService } from './services/serial-service.js';
import { tcpService } from './services/tcp-service.js';
import { fileWatchService } from './services/file-watch-service.js';
import { backupService } from './services/backup-service.js';
import { auditLogger } from './services/audit-service.js';
import { getDriverManager } from './services/instrument-driver-manager.js';
import { extractTestCode, parseResultValue, mapAbnormalFlag } from './services/astm-parser.js';
import { virtualInstrumentSimulation } from './services/virtual-instrument-simulation.js';
import { setupHL7Handlers } from './handlers/hl7-handler.js';
import { timeSyncService } from './services/time-sync-service.js';
import { dataQualityMonitor } from './services/data-quality-monitor.js';
import { deviceLifecycleManager } from './services/device-lifecycle-manager.js';
import { predictiveMaintenanceService } from './services/predictive-maintenance-service.js';
import { videoCaptureService } from './services/video-capture-service.js';
import { dicomWrapper } from './services/dicom-wrapper.js';
import { orthancService } from './services/orthanc-service.js';
import { CloudSyncService } from './services/cloud-sync-service.js';
import { DHIS2Reporter } from './services/dhis2-reporter.js';
import { OpenMRSBridge } from './services/openmrs-bridge.js';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';

import bcrypt from 'bcryptjs';

// Note: Session/token management removed for simplified offline auth model
// Backend role checks via currentUserRole parameter for defense-in-depth

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

// Helper to process instrument messages (ASTM)
async function processInstrumentMessage(data: { instrumentId: number; message: any; raw: string; timestamp: string }) {
  const { instrumentId, message, raw, timestamp } = data;
  if (!isDatabaseInitialized()) return;

  const db = getDatabase();
  const sampleIdRaw = message.orders[0]?.specimenId || message.orders[0]?.instrumentSpecimenId || 'UNKNOWN';
  const isDebug = instrumentId === 0 || instrumentId >= 9999;

  // Always notify UI about receiving data
  for (const result of message.results) {
    const testCode = extractTestCode(result.universalTestId);
    const { numeric, text } = parseResultValue(result.dataValue);
    const flag = mapAbnormalFlag(result.abnormalFlags);

    mainWindow?.webContents.send('instrument:data', {
      instrumentId,
      timestamp,
      sampleId: sampleIdRaw,
      testCode,
      value: text,
      numericValue: numeric,
      unit: result.units,
      flag,
      raw,
    });
  }

  // If debug mode, don't save to database
  if (isDebug) return;

  const sampleRecord = db.prepare<string, { id: number; status: string }>(`SELECT id, status FROM samples WHERE sample_id = ?`).get(sampleIdRaw);

  if (sampleRecord) {
    const insertResultStmt = db.prepare(`
      INSERT INTO results (order_id, value, numeric_value, unit, flag, instrument_id, raw_data, source, created_at, updated_at)
      VALUES (@orderId, @value, @numericValue, @unit, @flag, @instrumentId, @rawData, 'instrument', datetime('now'), datetime('now'))
    `);

    const updateOrderStmt = db.prepare(`UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?`);
    const createOrderStmt = db.prepare(`INSERT INTO orders (sample_id, panel_id, status, ordered_at, completed_at) VALUES (?, ?, 'completed', datetime('now'), datetime('now'))`);
    const getOrderStmt = db.prepare(`SELECT id FROM orders WHERE sample_id = ? AND panel_id = ?`);
    const getMappingStmt = db.prepare(`SELECT panel_id, conversion_factor FROM instrument_test_mappings WHERE instrument_id = ? AND instrument_code = ?`);
    const getPanelByCodeStmt = db.prepare(`SELECT id FROM test_panels WHERE code = ?`);

    try {
      db.transaction(() => {
        for (const result of message.results) {
          const testCode = extractTestCode(result.universalTestId);
          let { numeric, text } = parseResultValue(result.dataValue);

          let panelId: number | undefined;
          let conversionFactor = 1.0;

          const mapping = getMappingStmt.get(instrumentId, testCode) as { panel_id: number; conversion_factor: number } | undefined;
          if (mapping) {
            panelId = mapping.panel_id;
            conversionFactor = mapping.conversion_factor;
          } else {
            const panel = getPanelByCodeStmt.get(testCode) as { id: number } | undefined;
            if (panel) panelId = panel.id;
          }

          if (panelId) {
            if (numeric !== null && conversionFactor !== 1.0) {
              numeric *= conversionFactor;
              if (!isNaN(parseFloat(text))) text = numeric.toString();
            }

            let orderId: number | bigint | undefined;
            const order = getOrderStmt.get(sampleRecord.id, panelId) as { id: number } | undefined;

            if (order) {
              orderId = order.id;
              updateOrderStmt.run(orderId);
            } else {
              const info = createOrderStmt.run(sampleRecord.id, panelId);
              orderId = info.lastInsertRowid;
            }

            insertResultStmt.run({
              orderId,
              value: text,
              numericValue: numeric,
              unit: result.units,
              flag: mapAbnormalFlag(result.abnormalFlags),
              instrumentId,
              rawData: raw
            });
          }
        }

        if (sampleRecord.status === 'registered' || sampleRecord.status === 'in_progress') {
          db.prepare(`UPDATE samples SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(sampleRecord.id);
        }
      })();
    } catch (err) {
      console.error('Error processing instrument message:', err);
    }
  } else {
    // Unmatched data
    try {
      db.prepare(`
        INSERT INTO unmatched_data (instrument_id, sample_id_raw, raw_data, parsed_data, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(instrumentId, sampleIdRaw, raw, JSON.stringify(message));

      mainWindow?.webContents.send('instrument:unmatched', {
        instrumentId,
        sampleId: sampleIdRaw,
        resultCount: message.results.length,
        timestamp,
      });
    } catch (err) {
      console.error('Error saving unmatched data:', err);
    }
  }
}

export async function setupIpcHandlers(mainWindow?: BrowserWindow) {
  // Initialize database
  initDatabase();

  // Setup HL7 handlers with main window reference
  setupHL7Handlers(getDatabase(), mainWindow);

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
    connectionType?: 'serial' | 'tcp' | 'file';
    baudRate?: number;
    dataBits?: 5 | 6 | 7 | 8;
    stopBits?: 1 | 1.5 | 2;
    parity?: 'none' | 'even' | 'odd';
    instrumentId: number;
    host?: string;
    port?: number;
    mode?: 'client' | 'server';
    watchPath?: string;
    filePattern?: string;
  }) => {
    try {
      if (options.connectionType === 'tcp') {
        if (!options.port) throw new Error('Port is required for TCP');
        return await tcpService.connect(options.instrumentId, {
          host: options.host,
          port: options.port,
          mode: options.mode || 'client'
        });
      } else if (options.connectionType === 'file') {
        if (!options.watchPath) throw new Error('Watch path is required');
        return await fileWatchService.startWatching(options.instrumentId, {
          path: options.watchPath,
          pattern: options.filePattern
        });
      } else {
        // Default to serial
        await serialService.connect(options.instrumentId, {
          path: portPath,
          baudRate: options.baudRate || 9600,
          dataBits: options.dataBits,
          stopBits: options.stopBits,
          parity: options.parity,
        });
      }
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  });

  ipcMain.handle('instrument:disconnect', async (_event, portPath: string, options?: { instrumentId: number; connectionType: 'serial' | 'tcp' | 'file'; host?: string; port?: number; mode?: 'client' | 'server'; watchPath?: string }) => {
    if (options?.connectionType === 'tcp' && options.port) {
      await tcpService.disconnect(options.instrumentId, {
        host: options.host,
        port: options.port,
        mode: options.mode || 'client'
      });
    } else if (options?.connectionType === 'file') {
      await fileWatchService.stopWatching(options.instrumentId);
    } else {
      await serialService.disconnect(portPath);
    }
  });

  ipcMain.handle('instrument:getStatus', async (_event, portPath: string, options?: { connectionType: 'serial' | 'tcp' | 'file'; instrumentId: number; host?: string; port?: number; mode?: 'client' | 'server' }) => {
    if (options?.connectionType === 'tcp' && options.port) {
      return tcpService.getStatus(options.instrumentId, {
        host: options.host,
        port: options.port,
        mode: options.mode || 'client'
      });
    }
    if (options?.connectionType === 'file') {
      return fileWatchService.getStatus(options.instrumentId);
    }
    return serialService.getStatus(portPath);
  });

  ipcMain.handle('instrument:getAllStatuses', async () => {
    const serialStatuses = serialService.getAllStatuses();
    // TCP doesn't have a simple getAllStatuses that returns a Map compatible with serial's keying (path).
    // But we can just merge them if we knew how the frontend keying works.
    // Frontend uses `path || host:port`? 
    // Actually instrument list loop checks `instrument.is_connected`.
    return Object.fromEntries(serialStatuses);
  });

  ipcMain.handle('instrument:simulate', async (_event, path: string) => {
    await virtualInstrumentSimulation.startBC3000Simulation(path);
    return true;
  });

  // ============= Driver Management =============

  ipcMain.handle('driver:getAll', async () => {
    const manager = getDriverManager();
    // Ensure built-in drivers are loaded
    await manager.loadDrivers();
    return manager.getAllDrivers();
  });

  ipcMain.handle('driver:get', async (_event, id: string) => {
    const manager = getDriverManager();
    return manager.getDriver(id);
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

  ipcMain.handle('file:showSaveDialog', async (_event, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return result.canceled ? null : result.filePath;
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

  ipcMain.handle('backup:updateSettings', async (_event, settings: { enabled: boolean; path: string; interval: string }) => {
    const db = getDatabase();
    const { enabled, path, interval } = settings;

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_backup_enabled', ?)").run(String(enabled));
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_backup_path', ?)").run(path);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_backup_interval', ?)").run(interval);

    // Reload backup service to apply changes
    backupService.reload();

    return { success: true };
  });

  ipcMain.handle('backup:getDefaultPath', async () => {
    const defaultPath = path.join(app.getPath('userData'), 'databackup');
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true });
    }
    return defaultPath;
  });

  // ============= License =============
  // Using unified license service for security
  const licenseService = await import('./services/license-service.js');

  ipcMain.handle('license:getMachineId', async () => {
    return licenseService.generateMachineId();
  });

  ipcMain.handle('license:getMachineIdFormatted', async () => {
    const machineId = licenseService.generateMachineId();
    return licenseService.formatMachineId(machineId);
  });

  ipcMain.handle('license:activate', async (_event, key: string) => {
    const db = getDatabase();
    const result = licenseService.activateLicense(db, key);

    // Optional: Verify online if network available
    if (result.success) {
      try {
        const onlineResult = await licenseService.verifyOnline(key);
        if (onlineResult.shouldBlock) {
          return { success: false, message: '此许可证已被撤销' };
        }
      } catch {
        // Ignore network errors - allow offline activation
      }
    }

    return result;
  });

  ipcMain.handle('license:activateFromFile', async (_event, filePath: string) => {
    const db = getDatabase();
    const result = licenseService.activateFromFile(db, filePath);

    if (result.success) {
      try {
        const licenseKey = db.prepare(`SELECT value FROM settings WHERE key = 'license_key'`).get() as { value: string } | undefined;
        if (licenseKey?.value) {
          const onlineResult = await licenseService.verifyOnline(licenseKey.value);
          if (onlineResult.shouldBlock) {
            return { success: false, message: '此许可证已被撤销' };
          }
        }
      } catch {
        // Ignore network errors
      }
    }

    return result;
  });

  ipcMain.handle('license:getStatus', async () => {
    const db = getDatabase();
    return licenseService.getLicenseStatus(db);
  });

  ipcMain.handle('license:canRun', async () => {
    const db = getDatabase();
    return licenseService.canRunApplication(db);
  });

  ipcMain.handle('license:getActivationUrl', async () => {
    return licenseService.getActivationUrl();
  });

  ipcMain.handle('license:hasFeature', async (_event, feature: number) => {
    const db = getDatabase();
    return licenseService.hasFeature(db, feature);
  });

  // ============= Setup Instrument Event Forwarding =============



  // Serial
  serialService.on('connected', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'connected' }));
  serialService.on('disconnected', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'disconnected' }));
  serialService.on('error', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'error' }));
  serialService.on('message', processInstrumentMessage);

  // TCP
  tcpService.on('connected', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'connected' }));
  tcpService.on('listening', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'listening' }));
  tcpService.on('disconnected', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'disconnected' }));
  tcpService.on('error', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'error' }));
  tcpService.on('message', processInstrumentMessage);

  // File Watcher
  fileWatchService.on('connected', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'connected' })); // "Connected" means watching
  fileWatchService.on('disconnected', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'disconnected' }));
  fileWatchService.on('error', (data) => mainWindow?.webContents.send('instrument:status', { ...data, status: 'error' }));
  fileWatchService.on('message', processInstrumentMessage);

  // ============= Report/PDF Generation =============

  ipcMain.handle('print-to-pdf', async (event, options: { filename?: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'No window found' };

    try {
      const pdfData = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      });

      if (options.filename) {
        const { filePath } = await dialog.showSaveDialog(win, {
          defaultPath: options.filename,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (filePath) {
          const fs = await import('fs/promises');
          await fs.writeFile(filePath, pdfData);
          return { success: true, path: filePath };
        }
        return { success: false, error: 'Cancelled' };
      }

      return { success: true, data: pdfData };
    } catch (error) {
      console.error('PDF generation error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('print-page', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };
    win.webContents.print({ silent: false, printBackground: true });
    return { success: true };
  });

  // console.log('IPC handlers registered');
  // ============= Authentication =============

  ipcMain.handle('auth:login', async (_event, { username, password }) => {
    try {
      const db = getDatabase();
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

      if (!user) {
        return { success: false, error: 'invalid_credentials' };
      }

      if (!user.is_active) {
        return { success: false, error: 'account_disabled' };
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        // Log login
        auditLogger.log('login', 'user', user.id, { userId: user.id, ip: 'local' });

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
          }
        };
      } else {
        return { success: false, error: 'invalid_credentials' };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'server_error' };
    }
  });

  // ============= User Management =============
  // Note: Role check is done via currentUserRole parameter for simplicity
  // In an offline system, frontend role check is sufficient for most cases
  // Backend role check is added for critical operations as defense-in-depth

  ipcMain.handle('user:getAll', (_event, { currentUserRole }: { currentUserRole?: string } = {}) => {
    // Only admin can list users
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }
    const db = getDatabase();
    return db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users').all();
  });

  ipcMain.handle('user:create', async (_event, { currentUserRole, userData }: { currentUserRole?: string; userData: any }) => {
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    try {
      const db = getDatabase();
      const { username, password, full_name, role } = userData;

      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) return { success: false, error: 'Username already exists' };

      const passwordHash = await bcrypt.hash(password, 10);

      const result = db.prepare(
        'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)'
      ).run(username, passwordHash, full_name, role);

      auditLogger.log('create', 'user', Number(result.lastInsertRowid), { newValues: { username, full_name, role } });

      return { success: true, id: result.lastInsertRowid };
    } catch (err: any) {
      console.error('Create user error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('user:update', async (_event, { currentUserRole, userData }: { currentUserRole?: string; userData: any }) => {
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    try {
      const db = getDatabase();
      const { id, password, full_name, role } = userData;

      if (id === 1 && role !== 'admin') {
        return { success: false, error: 'Cannot change role of default admin' };
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        db.prepare(
          `UPDATE users SET password_hash = ?, full_name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(passwordHash, full_name, role, id);
      } else {
        db.prepare(
          `UPDATE users SET full_name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(full_name, role, id);
      }

      auditLogger.log('update', 'user', id, { newValues: { full_name, role } });

      return { success: true };
    } catch (err: any) {
      console.error('Update user error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('user:toggleActive', (_event, { currentUserRole, id, isActive }: { currentUserRole?: string; id: number; isActive: boolean }) => {
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    if (id === 1) return { success: false, error: 'Cannot disable default admin' };

    getDatabase().prepare(
      `UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(isActive ? 1 : 0, id);

    auditLogger.log('update_status', 'user', id, { newValues: { is_active: isActive } });

    return { success: true };
  });

  ipcMain.handle('user:delete', (_event, { currentUserRole, id }: { currentUserRole?: string; id: number }) => {
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    if (id === 1) return { success: false, error: 'Cannot delete default admin' };

    getDatabase().prepare('DELETE FROM users WHERE id = ?').run(id);

    auditLogger.log('delete', 'user', id);

    return { success: true };
  });

  // ============= Audit Logs =============

  ipcMain.handle('audit:getLogs', (_event, { currentUserRole, page = 1, pageSize = 50, filters = {} }: { currentUserRole?: string; page?: number; pageSize?: number; filters?: any }) => {
    // Only admin can view audit logs
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' };
    }

    const db = getDatabase();
    const offset = (page - 1) * pageSize;

    let queryStr = `
      SELECT a.*, u.username 
      FROM audit_log a 
      LEFT JOIN users u ON a.user_id = u.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.action) {
      conditions.push('a.action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('a.entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.userId) {
      conditions.push('a.user_id = ?');
      params.push(filters.userId);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as count FROM audit_log a ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`;
    const totalResult = db.prepare(countQuery).get(...params) as { count: number };

    queryStr += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const logs = db.prepare(queryStr).all(...params);

    return {
      logs,
      total: totalResult.count,
      page,
      pageSize,
      totalPages: Math.ceil(totalResult.count / pageSize)
    };
  });

  // ============= Worklist Operations =============

  ipcMain.handle('worklist:start', async (_event, orderId: number) => {
    const db = getDatabase();
    try {
      return db.transaction(() => {
        // 1. Update order status
        db.prepare(`UPDATE orders SET status = 'processing' WHERE id = ?`).run(orderId);

        // 2. Get sample_id for this order
        const order = db.prepare('SELECT sample_id FROM orders WHERE id = ?').get(orderId) as { sample_id: number } | undefined;

        if (order) {
          // 3. Update sample status to 'in_progress'
          db.prepare(
            `UPDATE samples SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'registered'`
          ).run(order.sample_id);

          // 4. Ensure entry in results table exists
          db.prepare(
            `INSERT OR IGNORE INTO results (order_id, source, created_at, updated_at) VALUES (?, 'manual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).run(orderId);
        }

        return { success: true };
      })();
    } catch (err: any) {
      console.error('Worklist start error:', err);
      return { success: false, error: err.message };
    }
  });

  // ============= System Init =============
  ipcMain.handle('system:checkInit', () => {
    const db = getDatabase();
    // Check if any user exists
    const user = db.prepare('SELECT id FROM users LIMIT 1').get();
    return { initialized: !!user };
  });

  ipcMain.handle('system:createFirstAdmin', async (_event, { username, password, fullName }) => {
    const db = getDatabase();
    // Strict check: Only allow if NO users exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count > 0) {
      return { success: false, error: 'System already initialized. Users exist.' };
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const result = db.prepare(
        'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)'
      ).run(username, passwordHash, fullName, 'admin');

      // Log creation (system logs it, user_id is null or 0? or the new user?)
      // We can log as system
      auditLogger.log('create', 'user', Number(result.lastInsertRowid), { newValues: { username, fullName, role: 'admin' }, userId: 0 }); // 0 = System

      return { success: true, id: result.lastInsertRowid };
    } catch (err: any) {
      console.error('First admin creation failed:', err);
      return { success: false, error: err.message };
    }
  });


  // ============= Phase 1: Time Sync & Quality =============
  ipcMain.handle('time:getDrift', (_event, instrumentId: number) => timeSyncService.getDriftOffset(instrumentId));
  ipcMain.handle('time:setOffset', (_event, { instrumentId, offsetMs }) => timeSyncService.setManualOffset(instrumentId, offsetMs));
  ipcMain.handle('time:getHistory', (_event, instrumentId: number) => timeSyncService.getDriftHistory(instrumentId));
  ipcMain.handle('time:getSystemTime', () => timeSyncService.getSystemTime());

  // Quality Monitor
  ipcMain.handle('quality:getMetrics', (_event, instrumentId: number) => dataQualityMonitor.getMetrics(instrumentId));
  ipcMain.handle('quality:getHistory', (_event, { instrumentId, hours }) => dataQualityMonitor.getHistory(instrumentId, hours));

  // ============= Phase 2: Lifecycle & Maintenance =============
  ipcMain.handle('lifecycle:addEvent', (_event, { instrumentId, event }) => deviceLifecycleManager.recordEvent({ ...event, instrumentId }));
  ipcMain.handle('lifecycle:getHistory', (_event, instrumentId: number) => deviceLifecycleManager.getHistory(instrumentId));
  ipcMain.handle('lifecycle:getUpcomingDueDates', (_event, days: number) => deviceLifecycleManager.getUpcomingDueDates(days));

  ipcMain.handle('maintenance:evaluateHealth', (_event, instrumentId: number) => predictiveMaintenanceService.evaluateDevice(instrumentId));
  // predictFailure is internal to evaluateDevice, result is in predictedIssues


  // ============= Phase 3: Semantics (Optional exposure) =============
  // SemanticMapper is mostly internal to result processing, but we can expose mapping utils if needed.
  // For now, no direct IPC needed unless UI has a mapper editor.

  // ============= Phase 5: Imaging (Video/DICOM) =============
  ipcMain.handle('video:listDevices', () => videoCaptureService.listDevices());

  ipcMain.handle('video:startPreview', (_event, config) => videoCaptureService.startPreview(config));
  ipcMain.handle('video:stopPreview', (_event, devicePath) => videoCaptureService.stopPreview(devicePath));

  ipcMain.handle('video:capture', (_event, { config, patientId }) => videoCaptureService.captureFrame(config, patientId));

  ipcMain.handle('video:startRecording', (_event, { config, patientId, duration }) => videoCaptureService.startRecording(config, patientId, duration));
  ipcMain.handle('video:stopRecording', (_event, sessionId) => videoCaptureService.stopRecording(sessionId));
  ipcMain.handle('video:saveWebRecording', (_event, { buffer, patientId, format }) => videoCaptureService.saveWebRecording(buffer, patientId, format));

  ipcMain.handle('video:getCaptures', (_event, patientId) => videoCaptureService.getCaptures(patientId));

  // DICOM
  ipcMain.handle('dicom:wrap', (_event, { imagePath, patient, study }) => dicomWrapper.wrapImage(imagePath, patient, study));
  ipcMain.handle('dicom:list', (_event, patientId) => dicomWrapper.getDicomFiles(patientId));

  // Orthanc
  ipcMain.handle('orthanc:test', () => orthancService.testConnection());
  ipcMain.handle('orthanc:upload', (_event, filePath) => orthancService.uploadDicom(filePath));
  ipcMain.handle('orthanc:search', (_event, query) => orthancService.findStudies(query));

  // End of Phase 5

  // ============= Phase 4: External Integrations =============


  // Singleton instances
  const cloudSync = new CloudSyncService(getDatabase().name);
  const dhis2Reporter = new DHIS2Reporter(getDatabase().name);
  const openMrsBridge = new OpenMRSBridge(getDatabase().name);

  // Cloud Sync
  ipcMain.handle('sync:getConfig', () => cloudSync.getConfig());
  ipcMain.handle('sync:setConfig', (_event, config) => cloudSync.setConfig(config));
  ipcMain.handle('sync:exportOffline', (_event, { since, password }) => cloudSync.exportOfflinePackage(since, password));
  ipcMain.handle('sync:importOffline', (_event, { path, password }) => cloudSync.importOfflinePackage(path, password));
  ipcMain.handle('sync:manual', () => cloudSync.manualSync());

  // DHIS2
  ipcMain.handle('dhis2:getConfig', () => dhis2Reporter.getConfig());
  ipcMain.handle('dhis2:setConfig', (_event, config) => dhis2Reporter.setConfig(config));
  ipcMain.handle('dhis2:generateDaily', (_event, date) => dhis2Reporter.generateAggregate(date));
  ipcMain.handle('dhis2:submit', (_event, data) => dhis2Reporter.submitData(data));

  // OpenMRS
  ipcMain.handle('openmrs:getConfig', () => openMrsBridge.getConfig());
  ipcMain.handle('openmrs:setConfig', (_event, config) => openMrsBridge.setConfig(config));
  ipcMain.handle('openmrs:findPatient', (_event, identifier) => openMrsBridge.findPatient(identifier));
  ipcMain.handle('openmrs:pushObservation', (_event, obs) => openMrsBridge.pushObservation(obs));

  // ============= Debug/Testing Handlers =============

  ipcMain.handle('debug:testProtocol', async (_event, testPath?: string) => {
    try {
      const testFilePath = testPath || path.join(videoCaptureService.getStoragePath(), 'test.txt');

      // Create a test file if it doesn't exist
      if (!fs.existsSync(testFilePath)) {
        fs.writeFileSync(testFilePath, 'Test file for protocol handler verification');
      }

      return {
        success: true,
        testPath: testFilePath,
        exists: fs.existsSync(testFilePath),
        protocolUrl: `app-data://${testFilePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // End of handlers

  // ============= App Control =============
  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit();
  });
}
