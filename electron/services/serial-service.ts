/**
 * Serial Port Communication Service
 * Handles RS-232 communication with laboratory instruments
 * 
 * Phase 1 Enhancement: Integrated with TrafficLogger, TimeSyncService, and DataQualityMonitor
 */

import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import { CTRL, parseASTMMessage, verifyChecksum } from './astm-parser.js';
import { VirtualPort } from './virtual-port.js';
import { trafficLogger } from './traffic-logger.js';
import { timeSyncService } from './time-sync-service.js';
import { dataQualityMonitor } from './data-quality-monitor.js';

export interface SerialConfig {
  path: string;
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  rtscts?: boolean;
  xon?: boolean;
  xoff?: boolean;
}

export interface InstrumentConnection {
  id: number;
  port: SerialPort | VirtualPort;
  config: SerialConfig;
  buffer: Buffer;
  messageBuffer?: string;
  state: 'idle' | 'receiving' | 'error';
  lastActivity: Date;
  intentionalDisconnect: boolean;
}

export class SerialService extends EventEmitter {
  private connections: Map<string, InstrumentConnection> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  // Keep track of virtual ports to allow simulation
  private virtualPorts: Map<string, VirtualPort> = new Map();

  constructor() {
    super();
  }

  /**
   * List available serial ports
   */
  async listPorts() {
    const realPorts = await SerialPort.list();
    // Append a virtual port for testing
    return [
      ...realPorts,
      { path: 'VIRTUAL:BC-3000', manufacturer: 'Virtual', serialNumber: 'V001', pnpId: 'VIRT_01', locationId: undefined, productId: undefined, vendorId: undefined }
    ];
  }

  /**
   * Get reference to a virtual port for simulation control
   */
  getVirtualPort(path: string): VirtualPort | undefined {
    return this.virtualPorts.get(path);
  }

  async connect(instrumentId: number, config: SerialConfig): Promise<boolean> {
    if (this.connections.has(config.path)) {
      const conn = this.connections.get(config.path);
      // Check isOpen property safely (works on both real and virtual)
      if (conn?.port.isOpen) {
        console.log(`Port ${config.path} already connected`);
        return true;
      }
    }

    // Clear any pending reconnect
    if (this.reconnectTimers.has(config.path)) {
      clearTimeout(this.reconnectTimers.get(config.path)!);
      this.reconnectTimers.delete(config.path);
    }

    try {
      let port: SerialPort | VirtualPort;

      if (config.path.startsWith('VIRTUAL:')) {
        console.log(`Creating virtual port for ${config.path}`);
        port = new VirtualPort({
          path: config.path,
          baudRate: config.baudRate
        });
        this.virtualPorts.set(config.path, port as VirtualPort);
      } else {
        port = new SerialPort({
          path: config.path,
          baudRate: config.baudRate,
          dataBits: config.dataBits || 8,
          stopBits: config.stopBits || 1,
          parity: config.parity || 'none',
          rtscts: config.rtscts || false,
          xon: config.xon || false,
          xoff: config.xoff || false,
          autoOpen: false,
        });
      }

      return new Promise((resolve, reject) => {
        port.open((err: Error | null | undefined) => {
          // Note: SerialPort types might say Error | null, we handle both
          if (err) {
            console.error(`Failed to open port ${config.path}:`, err);
            reject(err);
            return;
          }

          const connection: InstrumentConnection = {
            id: instrumentId,
            port,
            config,
            buffer: Buffer.alloc(0),
            state: 'idle',
            lastActivity: new Date(),
            intentionalDisconnect: false
          };

          this.connections.set(config.path, connection);
          this.setupPortListeners(connection);

          console.log(`Connected to ${config.path} at ${config.baudRate} baud`);
          this.emit('connected', { instrumentId, path: config.path });
          resolve(true);
        });
      });
    } catch (error) {
      console.error(`Error connecting to ${config.path}:`, error);
      throw error;
    }
  }

  async disconnect(path: string): Promise<void> {
    // Clear reconnect timer if any
    if (this.reconnectTimers.has(path)) {
      clearTimeout(this.reconnectTimers.get(path)!);
      this.reconnectTimers.delete(path);
    }

    const connection = this.connections.get(path);
    if (!connection) return;

    connection.intentionalDisconnect = true;

    return new Promise((resolve) => {
      if (connection.port.isOpen) {
        connection.port.close((err) => {
          if (err) console.error(`Error closing port ${path}:`, err);
          this.connections.delete(path);
          this.emit('disconnected', { instrumentId: connection.id, path });
          resolve();
        });
      } else {
        this.connections.delete(path);
        this.emit('disconnected', { instrumentId: connection.id, path });
        resolve();
      }
    });
  }

  // ... (disconnectAll)

  private setupPortListeners(connection: InstrumentConnection) {
    const { port, config } = connection;

    // Cast to any to avoid TS union type issues between SerialPort (Stream) and VirtualPort (EventEmitter)
    const p = port as any;

    p.on('data', (data: Buffer) => {
      connection.lastActivity = new Date();
      this.handleIncomingData(connection, data);
    });

    p.on('error', (err: any) => {
      console.error(`Serial port error on ${config.path}:`, err);
      connection.state = 'error';
      this.emit('error', { instrumentId: connection.id, path: config.path, error: err });
    });

    p.on('close', () => {
      console.log(`Port ${config.path} closed`);
      this.connections.delete(config.path);
      this.emit('disconnected', { instrumentId: connection.id, path: config.path });

      if (!connection.intentionalDisconnect) {
        console.log(`Unexpected disconnect on ${config.path}, retrying in 5s...`);
        const timer = setTimeout(() => {
          console.log(`Attempting reconnect to ${config.path}...`);
          this.connect(connection.id, connection.config).catch(err => {
            console.error(`Reconnect failed for ${config.path}:`, err);
            // If failed, maybe schedule another retry or emit permanent failure
            // Simple recursive retry via close handlers logic isn't here because connect() failing doesn't trigger 'close' event on the new port instance if open() fails.
            // We should retry loop here if connect fails.
            this.retryConnect(connection.id, connection.config);
          });
        }, 5000);
        this.reconnectTimers.set(config.path, timer);
      }
    });
  }

  private retryConnect(instrumentId: number, config: SerialConfig) {
    // Check if we should stop trying (e.g. user updated config or stopped it mid-retry?)
    // For now just try again in 10s
    const timer = setTimeout(() => {
      this.connect(instrumentId, config).catch(err => {
        console.error(`Retry attempt failed for ${config.path}`);
        this.retryConnect(instrumentId, config);
      });
    }, 10000);
    this.reconnectTimers.set(config.path, timer);
  }

  /**
   * Handle incoming data from instrument
   * Enhanced with traffic logging and receipt timestamp
   */
  private handleIncomingData(connection: InstrumentConnection, data: Buffer) {
    // Log raw traffic for forensic analysis
    trafficLogger.logReceive(connection.id, data);
    
    // Check for control characters
    if (data.includes(CTRL.ENQ)) {
      // Instrument wants to send data - respond with ACK
      console.log(`Received ENQ from ${connection.config.path}`);
      this.sendACK(connection);
      connection.state = 'receiving';
      connection.buffer = Buffer.alloc(0);
      return;
    }

    if (data.includes(CTRL.EOT)) {
      // End of transmission
      console.log(`Received EOT from ${connection.config.path}`);
      if (connection.messageBuffer && connection.messageBuffer.length > 0) {
        this.processCompleteMessage(connection);
      }
      connection.state = 'idle';
      connection.buffer = Buffer.alloc(0);
      connection.messageBuffer = '';
      return;
    }

    // Append to buffer
    connection.buffer = Buffer.concat([connection.buffer, data]);

    // Check for complete frames
    this.processFrames(connection);
  }

  /**
   * Process complete frames from buffer
   */
  private processFrames(connection: InstrumentConnection) {
    let buffer = connection.buffer;

    while (buffer.length > 0) {
      const stxIdx = buffer.indexOf(CTRL.STX);
      if (stxIdx === -1) {
        // No start of text, discard garbage if we have some data but no STX? 
        // Be careful not to discard partial STX if it's split (?) -> STX is 1 byte, so rare.
        // But we might have noise before STX.
        // For now, if no STX found, we keep the buffer as is, waiting for more data.
        // UNLESS the buffer is huge?
        break;
      }

      const etxIdx = buffer.indexOf(CTRL.ETX, stxIdx);
      const etbIdx = buffer.indexOf(CTRL.ETB, stxIdx);
      // Find the first occurrence of either ETX or ETB
      let endIdx = -1;
      if (etxIdx !== -1 && etbIdx !== -1) {
        endIdx = Math.min(etxIdx, etbIdx);
      } else if (etxIdx !== -1) {
        endIdx = etxIdx;
      } else {
        endIdx = etbIdx;
      }

      if (endIdx === -1) break; // Wait for more data

      // Need at least 2 more bytes for checksum + CR LF
      if (buffer.length < endIdx + 4) break;

      const frame = buffer.slice(stxIdx, endIdx + 4);

      // Verify checksum
      if (verifyChecksum(frame)) {
        this.sendACK(connection);
        
        // Record successful packet for quality monitoring
        dataQualityMonitor.recordSuccess(connection.id);

        // Extract data between STX and ETX/ETB (exclude frame number at start if strict, 
        // but ASTM parser handles the whole line usually? 
        // Actually, ASTM frame is <STX>F#<Data><ETX>CS<CR><LF>
        // The data passed to parseASTMMessage usually expects lines of records.
        // We should extract the content.

        // Frame structure: STX (1) + Frame# (1) + Text (N) + ETX (1) + CS (2) + CRLF (2)
        // We want 'Text'.
        // Note: The Frame# loops 0-7. 

        const frameData = frame.slice(stxIdx + 2, endIdx); // Skip STX and Frame#

        if (!connection.messageBuffer) connection.messageBuffer = '';
        connection.messageBuffer += frameData.toString('ascii');

        this.emit('frame', {
          instrumentId: connection.id,
          path: connection.config.path,
          data: frameData.toString('ascii')
        });
      } else {
        console.warn(`Checksum failed for frame from ${connection.config.path}`);
        this.sendNAK(connection);
        
        // Record checksum error for quality monitoring
        dataQualityMonitor.recordChecksumError(connection.id);
        
        // We do NOT discard the frame yet? Or do we?
        // Instrument should retransmit. We should probably accept that we consumed this attempts.
        // Standard says: sending NAK causes retransmission.
        // We consume the buffer so we can receive the retransmission.
      }

      // Advance buffer past this frame
      buffer = buffer.slice(endIdx + 4);
    }

    connection.buffer = buffer;
  }

  /**
   * Process complete ASTM message
   * Enhanced with receipt timestamp from TimeSyncService
   */
  private processCompleteMessage(connection: InstrumentConnection) {
    const rawData = connection.messageBuffer || '';
    const receiptTimestamp = timeSyncService.getReceiptTimestamp();
    console.log(`Processing complete message from ${connection.config.path}`);

    try {
      const message = parseASTMMessage(rawData);
      this.emit('message', {
        instrumentId: connection.id,
        path: connection.config.path,
        message,
        raw: rawData,
        timestamp: receiptTimestamp,  // Use TimeSyncService for consistent timestamps
        receiptTimestamp,             // Explicit receipt timestamp
      });
    } catch (error) {
      console.error(`Error parsing ASTM message:`, error);
      dataQualityMonitor.recordIncompleteData(connection.id);
      this.emit('parseError', {
        instrumentId: connection.id,
        path: connection.config.path,
        raw: rawData,
        error,
        receiptTimestamp,
      });
    }
  }

  /**
   * Send ACK to instrument
   */
  private sendACK(connection: InstrumentConnection) {
    connection.port.write(Buffer.from([CTRL.ACK]), (err) => {
      if (err) console.error(`Error sending ACK:`, err);
    });
  }

  /**
   * Send NAK to instrument
   */
  private sendNAK(connection: InstrumentConnection) {
    connection.port.write(Buffer.from([CTRL.NAK]), (err) => {
      if (err) console.error(`Error sending NAK:`, err);
    });
  }

  /**
   * Get connection status
   */
  getStatus(path: string): { connected: boolean; state?: string; lastActivity?: Date } {
    const connection = this.connections.get(path);
    if (!connection) {
      return { connected: false };
    }
    return {
      connected: connection.port.isOpen,
      state: connection.state,
      lastActivity: connection.lastActivity,
    };
  }

  /**
   * Get all connection statuses
   */
  /**
   * Get all connection statuses
   */
  getAllStatuses(): Map<string, { instrumentId: number; connected: boolean; state: string; lastActivity: Date }> {
    const statuses = new Map();
    for (const [path, connection] of this.connections) {
      statuses.set(path, {
        instrumentId: connection.id,
        connected: connection.port.isOpen,
        state: connection.state,
        lastActivity: connection.lastActivity,
      });
    }
    return statuses;
  }

  /**
   * Disconnect all active ports and clear timers
   */
  async disconnectAll(): Promise<void> {
    console.log('Disconnecting all serial ports...');
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    const disconnectPromises = Array.from(this.connections.keys()).map(path => this.disconnect(path));
    await Promise.all(disconnectPromises);
    this.connections.clear();
    this.virtualPorts.clear();
  }
}

// Singleton instance
export const serialService = new SerialService();
