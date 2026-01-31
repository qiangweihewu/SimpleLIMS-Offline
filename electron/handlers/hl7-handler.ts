/**
 * HL7 IPC Handler
 * Handles HL7 TCP service events and bridges with database
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ipcMain, BrowserWindow } from 'electron';
import { hl7TcpService } from '../services/hl7-tcp-service.js';
import { HL7ResultProcessor } from '../services/hl7-result-processor.js';
import type { HL7TcpConfig } from '../services/hl7-tcp-service.js';
import type { InstrumentTestMapping } from '../types/instrument-driver.js';

let mainWindow: BrowserWindow | null = null;

export function setupHL7Handlers(db: any, window?: BrowserWindow) {
  mainWindow = window || mainWindow;
  /**
   * Connect to HL7 instrument
   */
  ipcMain.handle('hl7:connect', async (event, instrumentId: number, config: HL7TcpConfig) => {
    try {
      const result = await hl7TcpService.connect(instrumentId, config);
      return { success: result, error: null };
    } catch (error) {
      console.error('[HL7Handler] Connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Disconnect from HL7 instrument
   */
  ipcMain.handle('hl7:disconnect', async (event, key: string) => {
    try {
      await hl7TcpService.disconnect(key);
      return { success: true, error: null };
    } catch (error) {
      console.error('[HL7Handler] Disconnection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get connection status
   */
  ipcMain.handle('hl7:getStatus', (event, key: string) => {
    try {
      const status = hl7TcpService.getStatus(key);
      return { data: status, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : String(error) };
    }
  });

  /**
   * Send HL7 message to instrument (bidirectional)
   */
  ipcMain.handle('hl7:send', async (event, key: string, message: string) => {
    try {
      const result = await hl7TcpService.sendHL7Message(key, message);
      return { success: result, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Process HL7 message and save results
   */
  ipcMain.handle(
    'hl7:processAndSave',
    async (event, message: any, instrumentId: number, testMappings: InstrumentTestMapping[]) => {
      try {
        // Process message
        const processed = HL7ResultProcessor.processMessage(message, testMappings);

        // Validate
        const validation = HL7ResultProcessor.validateResults(processed);
        if (!validation.valid) {
          return {
            success: false,
            error: `Validation failed: ${validation.issues.join('; ')}`,
          };
        }

        // Save results to database (via IPC to preload)
        const saveResult = await new Promise((resolve) => {
          // This would be handled by the database service
          // For now, return the processed message
          resolve(processed);
        });

        return {
          success: true,
          data: saveResult,
          error: null,
        };
      } catch (error) {
        console.error('[HL7Handler] Processing error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Handle HL7 message events with live broadcasting
   */
  hl7TcpService.on('message', (event: any) => {
    console.log('[HL7Handler] Received message from instrument:', event.instrumentId);
    // Broadcast to all renderer windows
    if (mainWindow) {
      mainWindow.webContents.send('hl7:message', event);
    }
  });

  hl7TcpService.on('connected', (event: any) => {
    console.log('[HL7Handler] HL7 connected:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:connected', {
        instrumentId: event.instrumentId,
        host: event.host,
        port: event.port,
        timestamp: new Date().toISOString(),
      });
    }
  });

  hl7TcpService.on('clientConnected', (event: any) => {
    console.log('[HL7Handler] HL7 client connected:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:clientConnected', {
        instrumentId: event.instrumentId,
        port: event.port,
        remoteAddress: event.remoteAddress,
        timestamp: new Date().toISOString(),
      });
    }
  });

  hl7TcpService.on('disconnected', (event: any) => {
    console.log('[HL7Handler] HL7 disconnected:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:disconnected', {
        instrumentId: event.instrumentId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  hl7TcpService.on('clientDisconnected', (event: any) => {
    console.log('[HL7Handler] HL7 client disconnected:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:clientDisconnected', {
        instrumentId: event.instrumentId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  hl7TcpService.on('error', (event: any) => {
    console.error('[HL7Handler] HL7 error:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:error', {
        instrumentId: event.instrumentId,
        error: event.error instanceof Error ? event.error.message : String(event.error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  hl7TcpService.on('parseError', (event: any) => {
    console.error('[HL7Handler] HL7 parse error:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:parseError', {
        instrumentId: event.instrumentId,
        raw: event.raw,
        error: event.error instanceof Error ? event.error.message : String(event.error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  hl7TcpService.on('listening', (event: any) => {
    console.log('[HL7Handler] HL7 server listening:', event);
    if (mainWindow) {
      mainWindow.webContents.send('instrument:listening', {
        instrumentId: event.instrumentId,
        port: event.port,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
