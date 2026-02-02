/**
 * RS-485 Bus Communication Service
 * 
 * Extends SerialService to support RS-485 multi-device bus communication.
 * Supports Modbus RTU protocol commonly used in medical device networks.
 */

import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import { SerialConfig, InstrumentConnection } from './serial-service.js';
import { trafficLogger } from './traffic-logger.js';
import { dataQualityMonitor } from './data-quality-monitor.js';
import { timeSyncService } from './time-sync-service.js';

export interface RS485Config extends SerialConfig {
  slaveAddress?: number;       // Modbus slave address (1-247)
  txEnableDelay?: number;      // Transmit enable delay in ms
  rxEnableDelay?: number;      // Receive enable delay in ms
  halfDuplex?: boolean;        // Half-duplex mode (most RS-485)
  responseTimeout?: number;    // Response timeout in ms
}

export interface ModbusRequest {
  address: number;             // Slave address
  functionCode: number;        // Modbus function code
  startRegister: number;       // Starting register address
  registerCount?: number;      // Number of registers to read
  data?: Buffer;               // Data for write operations
}

export interface ModbusResponse {
  address: number;
  functionCode: number;
  data: Buffer;
  receiptTimestamp: string;
}

// Modbus function codes
export const MODBUS_FUNCTIONS = {
  READ_COILS: 0x01,
  READ_DISCRETE_INPUTS: 0x02,
  READ_HOLDING_REGISTERS: 0x03,
  READ_INPUT_REGISTERS: 0x04,
  WRITE_SINGLE_COIL: 0x05,
  WRITE_SINGLE_REGISTER: 0x06,
  WRITE_MULTIPLE_COILS: 0x0F,
  WRITE_MULTIPLE_REGISTERS: 0x10
};

export class RS485Service extends EventEmitter {
  private connections: Map<string, { port: SerialPort; config: RS485Config; instrumentId: number }> = new Map();
  private pollingIntervals: Map<number, NodeJS.Timeout> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor() {
    super();
  }

  /**
   * Connect to RS-485 bus
   */
  async connect(instrumentId: number, config: RS485Config): Promise<boolean> {
    if (this.connections.has(config.path)) {
      const conn = this.connections.get(config.path);
      if (conn?.port.isOpen) {
        console.log(`[RS485] Port ${config.path} already connected`);
        return true;
      }
    }

    try {
      const port = new SerialPort({
        path: config.path,
        baudRate: config.baudRate,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || 'none',
        rtscts: config.rtscts || false,
        autoOpen: false,
      });

      return new Promise((resolve, reject) => {
        port.open((err) => {
          if (err) {
            console.error(`[RS485] Failed to open port ${config.path}:`, err);
            reject(err);
            return;
          }

          this.connections.set(config.path, { port, config, instrumentId });
          this.setupListeners(config.path);

          console.log(`[RS485] Connected to ${config.path} at ${config.baudRate} baud`);
          this.emit('connected', { instrumentId, path: config.path });
          resolve(true);
        });
      });
    } catch (error) {
      console.error(`[RS485] Error connecting to ${config.path}:`, error);
      throw error;
    }
  }

  /**
   * Setup port event listeners
   */
  private setupListeners(path: string): void {
    const conn = this.connections.get(path);
    if (!conn) return;

    conn.port.on('data', (data: Buffer) => {
      trafficLogger.logReceive(conn.instrumentId, data);
      this.handleResponse(path, data);
    });

    conn.port.on('error', (err) => {
      console.error(`[RS485] Port error on ${path}:`, err);
      dataQualityMonitor.recordFailure(conn.instrumentId);
      this.emit('error', { instrumentId: conn.instrumentId, path, error: err });
    });

    conn.port.on('close', () => {
      console.log(`[RS485] Port ${path} closed`);
      this.connections.delete(path);
      this.emit('disconnected', { instrumentId: conn.instrumentId, path });
    });
  }

  /**
   * Handle incoming response
   */
  private handleResponse(path: string, data: Buffer): void {
    const conn = this.connections.get(path);
    if (!conn) return;

    // Check for pending request
    const requestKey = `${path}_${data[0]}`; // path + slave address
    const pending = this.pendingRequests.get(requestKey);
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestKey);

      // Validate CRC
      if (this.validateModbusCRC(data)) {
        dataQualityMonitor.recordSuccess(conn.instrumentId);
        pending.resolve({
          address: data[0],
          functionCode: data[1],
          data: data.slice(2, -2), // Remove address, function code, and CRC
          receiptTimestamp: timeSyncService.getReceiptTimestamp()
        });
      } else {
        dataQualityMonitor.recordChecksumError(conn.instrumentId);
        pending.reject(new Error('CRC validation failed'));
      }
    } else {
      // Unsolicited data - emit as event
      this.emit('data', {
        instrumentId: conn.instrumentId,
        path,
        data,
        receiptTimestamp: timeSyncService.getReceiptTimestamp()
      });
    }
  }

  /**
   * Send Modbus RTU request
   */
  async sendModbusRequest(path: string, request: ModbusRequest): Promise<ModbusResponse> {
    const conn = this.connections.get(path);
    if (!conn) {
      throw new Error(`No connection on path ${path}`);
    }

    const frame = this.buildModbusFrame(request);
    trafficLogger.logTransmit(conn.instrumentId, frame);

    return new Promise((resolve, reject) => {
      const requestKey = `${path}_${request.address}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestKey);
        dataQualityMonitor.recordFailure(conn.instrumentId);
        reject(new Error(`Modbus request timeout for address ${request.address}`));
      }, conn.config.responseTimeout || 1000);

      this.pendingRequests.set(requestKey, { resolve, reject, timeout });

      // Add TX enable delay for half-duplex
      const txDelay = conn.config.txEnableDelay || 0;
      setTimeout(() => {
        conn.port.write(frame, (err) => {
          if (err) {
            clearTimeout(timeout);
            this.pendingRequests.delete(requestKey);
            dataQualityMonitor.recordFailure(conn.instrumentId);
            reject(err);
          }
        });
      }, txDelay);
    });
  }

  /**
   * Build Modbus RTU frame
   */
  private buildModbusFrame(request: ModbusRequest): Buffer {
    const { address, functionCode, startRegister, registerCount, data } = request;
    
    let frame: Buffer;
    
    switch (functionCode) {
      case MODBUS_FUNCTIONS.READ_HOLDING_REGISTERS:
      case MODBUS_FUNCTIONS.READ_INPUT_REGISTERS:
      case MODBUS_FUNCTIONS.READ_COILS:
      case MODBUS_FUNCTIONS.READ_DISCRETE_INPUTS:
        // Read request: Address + Function + StartReg(2) + Count(2) + CRC(2)
        frame = Buffer.alloc(8);
        frame.writeUInt8(address, 0);
        frame.writeUInt8(functionCode, 1);
        frame.writeUInt16BE(startRegister, 2);
        frame.writeUInt16BE(registerCount || 1, 4);
        break;
        
      case MODBUS_FUNCTIONS.WRITE_SINGLE_REGISTER:
        // Write single: Address + Function + Reg(2) + Value(2) + CRC(2)
        frame = Buffer.alloc(8);
        frame.writeUInt8(address, 0);
        frame.writeUInt8(functionCode, 1);
        frame.writeUInt16BE(startRegister, 2);
        frame.writeUInt16BE(data?.readUInt16BE(0) || 0, 4);
        break;
        
      case MODBUS_FUNCTIONS.WRITE_MULTIPLE_REGISTERS:
        // Write multiple: Address + Function + StartReg(2) + Count(2) + ByteCount + Data + CRC(2)
        const byteCount = data?.length || 0;
        const regCount = byteCount / 2;
        frame = Buffer.alloc(9 + byteCount);
        frame.writeUInt8(address, 0);
        frame.writeUInt8(functionCode, 1);
        frame.writeUInt16BE(startRegister, 2);
        frame.writeUInt16BE(regCount, 4);
        frame.writeUInt8(byteCount, 6);
        if (data) data.copy(frame, 7);
        break;
        
      default:
        throw new Error(`Unsupported Modbus function code: ${functionCode}`);
    }
    
    // Calculate and append CRC
    const crc = this.calculateModbusCRC(frame.slice(0, -2));
    frame.writeUInt16LE(crc, frame.length - 2);
    
    return frame;
  }

  /**
   * Calculate Modbus CRC-16
   */
  private calculateModbusCRC(data: Buffer): number {
    let crc = 0xFFFF;
    
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    
    return crc;
  }

  /**
   * Validate Modbus CRC
   */
  private validateModbusCRC(data: Buffer): boolean {
    if (data.length < 4) return false;
    
    const receivedCRC = data.readUInt16LE(data.length - 2);
    const calculatedCRC = this.calculateModbusCRC(data.slice(0, -2));
    
    return receivedCRC === calculatedCRC;
  }

  /**
   * Start polling multiple slave devices
   */
  startPolling(path: string, addresses: number[], intervalMs: number, request: Omit<ModbusRequest, 'address'>): void {
    const conn = this.connections.get(path);
    if (!conn) {
      console.error(`[RS485] Cannot start polling - no connection on ${path}`);
      return;
    }

    // Stop any existing polling
    this.stopPolling(conn.instrumentId);

    let currentIndex = 0;
    const poll = async () => {
      if (!this.connections.has(path)) {
        this.stopPolling(conn.instrumentId);
        return;
      }

      const address = addresses[currentIndex];
      try {
        const response = await this.sendModbusRequest(path, { ...request, address });
        this.emit('poll-response', {
          instrumentId: conn.instrumentId,
          address,
          response
        });
      } catch (err) {
        this.emit('poll-error', {
          instrumentId: conn.instrumentId,
          address,
          error: err
        });
      }

      currentIndex = (currentIndex + 1) % addresses.length;
    };

    const interval = setInterval(poll, intervalMs);
    this.pollingIntervals.set(conn.instrumentId, interval);
    console.log(`[RS485] Started polling ${addresses.length} devices on ${path} every ${intervalMs}ms`);
  }

  /**
   * Stop polling for an instrument
   */
  stopPolling(instrumentId: number): void {
    const interval = this.pollingIntervals.get(instrumentId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(instrumentId);
      console.log(`[RS485] Stopped polling for instrument ${instrumentId}`);
    }
  }

  /**
   * Disconnect from RS-485 bus
   */
  async disconnect(path: string): Promise<void> {
    const conn = this.connections.get(path);
    if (!conn) return;

    // Stop polling
    this.stopPolling(conn.instrumentId);

    return new Promise((resolve) => {
      if (conn.port.isOpen) {
        conn.port.close((err) => {
          if (err) console.error(`[RS485] Error closing port ${path}:`, err);
          this.connections.delete(path);
          this.emit('disconnected', { instrumentId: conn.instrumentId, path });
          resolve();
        });
      } else {
        this.connections.delete(path);
        resolve();
      }
    });
  }

  /**
   * Disconnect all
   */
  async disconnectAll(): Promise<void> {
    const paths = Array.from(this.connections.keys());
    await Promise.all(paths.map(path => this.disconnect(path)));
  }

  /**
   * Get connection status
   */
  getStatus(path: string): { connected: boolean; instrumentId?: number } {
    const conn = this.connections.get(path);
    if (!conn) return { connected: false };
    return {
      connected: conn.port.isOpen,
      instrumentId: conn.instrumentId
    };
  }
}

// Singleton instance
export const rs485Service = new RS485Service();
