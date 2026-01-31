/**
 * HL7 v2.x TCP/MLLP Communication Service
 * Handles both client and server modes with robust error handling
 * Supports ORU^R01 (Observation Result) messages and proper ACK/NAK responses
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { MLLP, parseHL7Message, validateHL7Segment } from './hl7-parser.js';
import type { HL7Message } from './hl7-parser.js';

export interface HL7TcpConfig {
  host?: string;
  port: number;
  mode: 'client' | 'server';
  timeout?: number; // Message timeout in ms (default: 30000)
  reconnectInterval?: number; // Client reconnect interval in ms (default: 5000)
}

export interface HL7Connection {
  id: number;
  socket?: net.Socket;
  server?: net.Server;
  config: HL7TcpConfig;
  buffer: Buffer;
  messageBuffer: string;
  state: 'idle' | 'receiving' | 'error' | 'listening' | 'connected';
  lastActivity: Date;
  messageTimeout?: NodeJS.Timeout;
  intentionalDisconnect: boolean;
}

export interface HL7MessageEvent {
  instrumentId: number;
  message: HL7Message;
  raw: string;
  timestamp: string;
  host?: string;
  port: number;
}

/**
 * Send HL7 ACK message (MSA segment) to acknowledge received message
 */
export function createHL7ACK(
  messageControlId: string,
  ackCode: 'AA' | 'AE' | 'AR' = 'AA',
  textMessage: string = 'Message accepted'
): string {
  // MSH segment (v2.5)
  const msh = 'MSH|^~\\&|SimpleLIMS|Lab|SendingApp|SendingFac|' +
    new Date().toISOString().replace(/[:\-]/g, '').substring(0, 14) +
    '||ACK|' + messageControlId + '|P|2.5';
  
  // MSA segment (Message Acknowledgement)
  const msa = `MSA|${ackCode}|${messageControlId}|${textMessage}`;
  
  return msh + '\r' + msa;
}

/**
 * Wrap HL7 message in MLLP frame
 */
export function wrapMLLP(message: string): Buffer {
  const buf = Buffer.alloc(message.length + 3);
  buf[0] = MLLP.VT; // Start
  Buffer.from(message, 'utf-8').copy(buf, 1);
  buf[buf.length - 2] = MLLP.FS; // End
  buf[buf.length - 1] = MLLP.CR; // CR
  return buf;
}

export class HL7TcpService extends EventEmitter {
  private connections: Map<string, HL7Connection> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  private getKey(config: HL7TcpConfig): string {
    return config.mode === 'client' ? `${config.host}:${config.port}` : `${config.port}`;
  }

  /**
   * Connect in Client Mode or Start Server Mode
   */
  async connect(instrumentId: number, config: HL7TcpConfig): Promise<boolean> {
    const key = this.getKey(config);

    if (this.connections.has(key)) {
      const conn = this.connections.get(key)!;
      if (conn.socket?.writable || conn.server?.listening) {
        console.log(`[HL7TCP] Connection ${key} already active`);
        return true;
      }
    }

    // Clear any pending reconnect
    if (this.reconnectTimers.has(key)) {
      clearTimeout(this.reconnectTimers.get(key)!);
      this.reconnectTimers.delete(key);
    }

    const connection: HL7Connection = {
      id: instrumentId,
      config,
      buffer: Buffer.alloc(0),
      messageBuffer: '',
      state: 'idle',
      lastActivity: new Date(),
      intentionalDisconnect: false,
    };

    this.connections.set(key, connection);

    try {
      if (config.mode === 'client') {
        return await this.startClient(connection);
      } else {
        return await this.startServer(connection);
      }
    } catch (error) {
      console.error(`[HL7TCP] Error connecting ${key}:`, error);
      this.emit('error', { instrumentId, error });
      return false;
    }
  }

  private startClient(connection: HL7Connection): Promise<boolean> {
    return new Promise((resolve) => {
      if (!connection.config.host) {
        this.emit('error', { instrumentId: connection.id, error: 'Host required for client mode' });
        resolve(false);
        return;
      }

      const socket = new net.Socket();
      connection.socket = socket;

      const timeout = setTimeout(() => {
        socket.destroy();
        this.emit('error', { instrumentId: connection.id, error: 'Connection timeout' });
        resolve(false);
      }, connection.config.timeout || 30000);

      socket.connect(connection.config.port, connection.config.host, () => {
        clearTimeout(timeout);
        console.log(`[HL7TCP] Client connected to ${connection.config.host}:${connection.config.port}`);
        connection.state = 'connected';
        this.emit('connected', { 
          instrumentId: connection.id, 
          host: connection.config.host, 
          port: connection.config.port 
        });
        resolve(true);
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[HL7TCP] Client socket error:`, err);
        connection.state = 'error';
        this.emit('error', { instrumentId: connection.id, error: err });
      });

      this.setupSocketListeners(connection, socket);
    });
  }

  private startServer(connection: HL7Connection): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        console.log(`[HL7TCP] Client connected on port ${connection.config.port}`);
        connection.socket = socket;
        connection.state = 'connected';
        
        this.emit('clientConnected', { 
          instrumentId: connection.id, 
          port: connection.config.port,
          remoteAddress: socket.remoteAddress 
        });

        this.setupSocketListeners(connection, socket);
      });

      server.on('error', (err) => {
        console.error(`[HL7TCP] Server error on port ${connection.config.port}:`, err);
        this.emit('error', { instrumentId: connection.id, error: err });
        reject(err);
      });

      server.listen(connection.config.port, () => {
        console.log(`[HL7TCP] Server listening on port ${connection.config.port}`);
        connection.server = server;
        connection.state = 'listening';
        this.emit('listening', { instrumentId: connection.id, port: connection.config.port });
        resolve(true);
      });
    });
  }

  async disconnect(key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (!connection) return;

    connection.intentionalDisconnect = true;

    // Clear message timeout
    if (connection.messageTimeout) {
      clearTimeout(connection.messageTimeout);
    }

    // Clear reconnect timer
    if (this.reconnectTimers.has(key)) {
      clearTimeout(this.reconnectTimers.get(key)!);
      this.reconnectTimers.delete(key);
    }

    if (connection.socket) {
      connection.socket.destroy();
    }

    if (connection.server) {
      connection.server.close();
    }

    this.connections.delete(key);
    this.emit('disconnected', { instrumentId: connection.id });
  }

  private setupSocketListeners(connection: HL7Connection, socket: net.Socket) {
    socket.on('data', (data: Buffer) => {
      try {
        connection.lastActivity = new Date();
        this.handleIncomingData(connection, Buffer.from(data));
      } catch (error) {
        console.error(`[HL7TCP] Error processing data:`, error);
        this.emit('error', { instrumentId: connection.id, error });
      }
    });

    socket.on('close', () => {
      console.log(`[HL7TCP] Socket closed for instrument ${connection.id}`);
      const key = this.getKey(connection.config);
      
      if (connection.messageTimeout) {
        clearTimeout(connection.messageTimeout);
      }

      if (connection.config.mode === 'client') {
        this.connections.delete(key);
        this.emit('disconnected', { instrumentId: connection.id });

        if (!connection.intentionalDisconnect) {
          console.log(`[HL7TCP] Unexpected disconnect, retrying in ${connection.config.reconnectInterval || 5000}ms...`);
          this.scheduleReconnect(connection.id, connection.config, key);
        }
      } else {
        // Server mode: client disconnected, but server still listening
        connection.state = 'listening';
        connection.socket = undefined;
        this.emit('clientDisconnected', { instrumentId: connection.id });
      }
    });

    socket.on('error', (err) => {
      console.error(`[HL7TCP] Socket error:`, err);
      connection.state = 'error';
      this.emit('error', { instrumentId: connection.id, error: err });
    });
  }

  private scheduleReconnect(instrumentId: number, config: HL7TcpConfig, key: string) {
    const timer = setTimeout(() => {
      console.log(`[HL7TCP] Attempting reconnect...`);
      this.connect(instrumentId, config).catch((err) => {
        console.error(`[HL7TCP] Reconnect failed:`, err);
        this.scheduleReconnect(instrumentId, config, key);
      });
    }, config.reconnectInterval || 5000);

    this.reconnectTimers.set(key, timer);
  }

  private handleIncomingData(connection: HL7Connection, data: Buffer) {
    // Append to buffer
    connection.buffer = Buffer.concat([connection.buffer, data]);

    // Process complete MLLP frames
    this.processMLLPFrames(connection);
  }

  private processMLLPFrames(connection: HL7Connection) {
    let buffer = connection.buffer;

    while (buffer.length > 0) {
      // Look for MLLP start marker (VT = 0x0b)
      const startIdx = buffer.indexOf(MLLP.VT);
      
      if (startIdx === -1) {
        // No start marker found, discard buffer if it's getting too large
        if (buffer.length > 65536) {
          console.warn(`[HL7TCP] Large buffer without MLLP marker, discarding ${buffer.length} bytes`);
          buffer = Buffer.alloc(0);
        }
        break;
      }

      // Look for MLLP end markers (FS + CR = 0x1c 0x0d)
      let endIdx = -1;
      for (let i = startIdx + 1; i < buffer.length - 1; i++) {
        if (buffer[i] === MLLP.FS && buffer[i + 1] === MLLP.CR) {
          endIdx = i;
          break;
        }
      }

      if (endIdx === -1) {
        // No complete frame yet, wait for more data
        // But discard data before start marker
        if (startIdx > 0) {
          buffer = buffer.subarray(startIdx);
        }
        break;
      }

      // Extract message between VT and FS (inclusive of FS+CR)
      const frameData = buffer.slice(startIdx + 1, endIdx).toString('utf-8');
      
      try {
        this.processHL7Message(connection, frameData);
      } catch (error) {
        console.error(`[HL7TCP] Error processing HL7 message:`, error);
        this.sendNAK(connection, 'AE', 'Message parsing error');
        this.emit('parseError', {
          instrumentId: connection.id,
          raw: frameData,
          error,
        });
      }

      // Move buffer past this frame
      buffer = buffer.slice(endIdx + 2);
    }

    connection.buffer = buffer;
  }

  private processHL7Message(connection: HL7Connection, rawMessage: string) {
    try {
      // Parse HL7 message
      const message = parseHL7Message(rawMessage);

      // Send ACK
      const ack = createHL7ACK(message.msh.messageControlId, 'AA', 'Message accepted');
      this.sendMessage(connection, ack);

      // Set message timeout (30 seconds default)
      if (connection.messageTimeout) {
        clearTimeout(connection.messageTimeout);
      }

      // Emit parsed message
      this.emit('message', {
        instrumentId: connection.id,
        message,
        raw: rawMessage,
        timestamp: new Date().toISOString(),
        port: connection.config.port,
        host: connection.config.host,
      } as HL7MessageEvent);

    } catch (error) {
      console.error(`[HL7TCP] HL7 parsing error:`, error);
      
      // Try to extract message control ID for NAK
      let controlId = 'UNKNOWN';
      try {
        const mshMatch = rawMessage.match(/^MSH\|.*?\|([^\|]+)\|/);
        if (mshMatch) {
          controlId = mshMatch[1];
        }
      } catch (e) {
        // Ignore
      }

      this.sendNAK(connection, 'AE', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private sendMessage(connection: HL7Connection, message: string) {
    if (!connection.socket?.writable) {
      console.warn(`[HL7TCP] Socket not writable, cannot send message`);
      return;
    }

    const frame = wrapMLLP(message);
    connection.socket.write(frame, (err) => {
      if (err) {
        console.error(`[HL7TCP] Error sending message:`, err);
      }
    });
  }

  private sendNAK(connection: HL7Connection, errorCode: string, errorText: string) {
    try {
      const nak = `MSH|^~\\&|SimpleLIMS|Lab|SendingApp|SendingFac|` +
        new Date().toISOString().replace(/[:\-]/g, '').substring(0, 14) +
        '||NAK|NAK_' + Date.now() + '|P|2.5\r' +
        `ERR|||${errorCode}|E|${errorText}`;
      
      this.sendMessage(connection, nak);
    } catch (error) {
      console.error(`[HL7TCP] Error sending NAK:`, error);
    }
  }

  /**
   * Send HL7 message to instrument (for bidirectional scenarios)
   */
  async sendHL7Message(key: string, message: string): Promise<boolean> {
    const connection = this.connections.get(key);
    if (!connection || !connection.socket?.writable) {
      console.warn(`[HL7TCP] Connection not available for sending`);
      return false;
    }

    try {
      this.sendMessage(connection, message);
      return true;
    } catch (error) {
      console.error(`[HL7TCP] Error sending HL7 message:`, error);
      return false;
    }
  }

  getStatus(key: string): { connected: boolean; state: string; lastActivity?: Date } {
    const connection = this.connections.get(key);
    if (!connection) {
      return { connected: false, state: 'disconnected' };
    }
    return {
      connected: connection.state === 'connected' || connection.state === 'listening',
      state: connection.state,
      lastActivity: connection.lastActivity,
    };
  }

  getAllConnections(): Map<string, HL7Connection> {
    return new Map(this.connections);
  }
}

export const hl7TcpService = new HL7TcpService();
