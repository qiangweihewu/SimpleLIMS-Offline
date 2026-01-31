/**
 * TCP Communication Service
 * Handles TCP/IP communication (Client & Server modes) with laboratory instruments
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { CTRL, parseASTMMessage, verifyChecksum } from './astm-parser.js';

export interface TcpConfig {
    host?: string;
    port: number;
    mode: 'client' | 'server';
}

export interface TcpConnection {
    id: number;
    socket?: net.Socket; // For client mode or active server connection
    server?: net.Server; // For server mode
    config: TcpConfig;
    buffer: Buffer;
    state: 'idle' | 'receiving' | 'error' | 'listening' | 'connected';
    lastActivity: Date;
}

export class TcpService extends EventEmitter {
    private connections: Map<string, TcpConnection> = new Map(); // Key: "host:port" or "port"

    constructor() {
        super();
    }

    private getKey(config: TcpConfig): string {
        return config.mode === 'client' ? `${config.host}:${config.port}` : `${config.port}`;
    }

    /**
     * Connect in Client Mode or Start Server Mode
     */
    async connect(instrumentId: number, config: TcpConfig): Promise<boolean> {
        const key = this.getKey(config);

        if (this.connections.has(key)) {
            console.log(`TCP connection ${key} already active`);
            return true;
        }

        const connection: TcpConnection = {
            id: instrumentId,
            config,
            buffer: Buffer.alloc(0),
            state: 'idle',
            lastActivity: new Date(),
        };

        this.connections.set(key, connection);

        if (config.mode === 'client') {
            return this.startClient(connection);
        } else {
            return this.startServer(connection);
        }
    }

    private startClient(connection: TcpConnection): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!connection.config.host) {
                reject(new Error('Host is required for client mode'));
                return;
            }

            const socket = new net.Socket();
            connection.socket = socket;

            socket.connect(connection.config.port, connection.config.host, () => {
                console.log(`Connected to TCP Server at ${connection.config.host}:${connection.config.port}`);
                connection.state = 'connected';
                this.emit('connected', { instrumentId: connection.id, host: connection.config.host, port: connection.config.port });
                resolve(true);
            });

            this.setupSocketListeners(connection, socket);
        });
    }

    private startServer(connection: TcpConnection): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const server = net.createServer((socket) => {
                console.log(`Client connected to TCP Server on port ${connection.config.port}`);

                // For server mode, we might handle multiple clients, but for LIMS usually it's one instrument per port
                // We'll attach the latest socket to the connection
                connection.socket = socket;
                connection.state = 'connected';
                this.emit('clientConnected', { instrumentId: connection.id, port: connection.config.port, remoteAddress: socket.remoteAddress });

                this.setupSocketListeners(connection, socket);
            });

            server.on('error', (err) => {
                console.error(`TCP Server error on port ${connection.config.port}:`, err);
                connection.state = 'error';
                this.emit('error', { instrumentId: connection.id, error: err });
                reject(err);
            });

            server.listen(connection.config.port, () => {
                console.log(`TCP Server listening on port ${connection.config.port}`);
                connection.server = server;
                connection.state = 'listening';
                this.emit('listening', { instrumentId: connection.id, port: connection.config.port });
                resolve(true);
            });
        });
    }

    async disconnect(instrumentId: number, config: TcpConfig): Promise<void> {
        const key = this.getKey(config);
        const connection = this.connections.get(key);
        if (!connection) return;

        if (connection.socket) {
            connection.socket.destroy();
        }

        if (connection.server) {
            connection.server.close();
        }

        this.connections.delete(key);
        this.emit('disconnected', { instrumentId });
    }

    private setupSocketListeners(connection: TcpConnection, socket: net.Socket) {
        socket.on('data', (data) => {
            connection.lastActivity = new Date();
            this.handleIncomingData(connection, Buffer.from(data));
        });

        socket.on('close', () => {
            console.log('TCP connection closed');
            if (connection.config.mode === 'client') {
                this.connections.delete(this.getKey(connection.config));
                this.emit('disconnected', { instrumentId: connection.id });
            } else {
                // Server mode: client disconnected, server still listening?
                // Usually instruments keep connection open.
                connection.state = 'listening';
                this.emit('clientDisconnected', { instrumentId: connection.id });
            }
        });

        socket.on('error', (err) => {
            console.error('TCP Socket error:', err);
            connection.state = 'error';
            this.emit('error', { instrumentId: connection.id, error: err });
        });
    }

    private handleIncomingData(connection: TcpConnection, data: Buffer) {
        // Check for control characters - similar logic to SerialService
        if (data.includes(CTRL.ENQ)) {
            console.log(`Received ENQ via TCP`);
            this.sendACK(connection);
            connection.state = 'receiving';
            connection.buffer = Buffer.alloc(0);
            return;
        }

        if (data.includes(CTRL.EOT)) {
            console.log(`Received EOT via TCP`);
            if (connection.buffer.length > 0) {
                this.processCompleteMessage(connection);
            }
            connection.state = 'idle'; // or 'listening' / 'connected'
            connection.buffer = Buffer.alloc(0);
            return;
        }

        connection.buffer = Buffer.concat([connection.buffer, data]);
        this.processFrames(connection);
    }

    private processFrames(connection: TcpConnection) {
        let buffer = connection.buffer;

        while (buffer.length > 0) {
            const stxIdx = buffer.indexOf(CTRL.STX);
            if (stxIdx === -1) break;

            const etxIdx = buffer.indexOf(CTRL.ETX, stxIdx);
            const etbIdx = buffer.indexOf(CTRL.ETB, stxIdx);
            const endIdx = etxIdx !== -1 ? etxIdx : etbIdx;

            if (endIdx === -1) break;

            if (buffer.length < endIdx + 4) break;

            const frame = buffer.slice(stxIdx, endIdx + 4);

            // Some TCP implementations might skip checksum or just send raw data
            // But assuming ASTM over TCP (e.g. HL7 MLLP is different, but let's stick to ASTM E1381 framing for now as it's common for older devices on Terminal Servers)
            // If pure HL7 over LLC, no Checksum/Ack is needed usually. 
            // This implementation assumes ASTM-like framing.

            if (verifyChecksum(frame)) {
                this.sendACK(connection);
                const frameData = frame.slice(1, endIdx - stxIdx).toString('ascii');
                // emit frame if needed
            } else {
                console.warn(`Checksum failed for TCP frame`);
                this.sendNAK(connection);
            }

            buffer = buffer.slice(endIdx + 4);
        }

        connection.buffer = buffer;
    }

    private processCompleteMessage(connection: TcpConnection) {
        const rawData = connection.buffer.toString('ascii');
        try {
            const message = parseASTMMessage(rawData);
            this.emit('message', {
                instrumentId: connection.id,
                message,
                raw: rawData,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error parsing ASTM message from TCP:', error);
            this.emit('parseError', {
                instrumentId: connection.id,
                raw: rawData,
                error,
            });
        }
    }

    private sendACK(connection: TcpConnection) {
        connection.socket?.write(Buffer.from([CTRL.ACK]));
    }

    private sendNAK(connection: TcpConnection) {
        connection.socket?.write(Buffer.from([CTRL.NAK]));
    }

    getStatus(instrumentId: number, config: TcpConfig): { connected: boolean; state: string } {
        const key = this.getKey(config);
        const conn = this.connections.get(key);
        if (!conn) return { connected: false, state: 'disconnected' };
        return {
            connected: conn.state === 'connected' || conn.state === 'listening' || conn.state === 'receiving',
            state: conn.state
        };
    }

    /**
     * Disconnect all active TCP connections and servers
     */
    async disconnectAll(): Promise<void> {
        console.log('Disconnecting all TCP connections...');
        const promises = Array.from(this.connections.values()).map(conn => this.disconnect(conn.id, conn.config));
        await Promise.all(promises);
        this.connections.clear();
    }
}

export const tcpService = new TcpService();
