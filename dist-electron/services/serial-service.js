/**
 * Serial Port Communication Service
 * Handles RS-232 communication with laboratory instruments
 */
import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import { CTRL, parseASTMMessage, verifyChecksum } from './astm-parser';
export class SerialService extends EventEmitter {
    connections = new Map();
    constructor() {
        super();
    }
    /**
     * List available serial ports
     */
    async listPorts() {
        return SerialPort.list();
    }
    /**
     * Connect to an instrument
     */
    async connect(instrumentId, config) {
        if (this.connections.has(config.path)) {
            console.log(`Port ${config.path} already connected`);
            return true;
        }
        try {
            const port = new SerialPort({
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
            return new Promise((resolve, reject) => {
                port.open((err) => {
                    if (err) {
                        console.error(`Failed to open port ${config.path}:`, err);
                        reject(err);
                        return;
                    }
                    const connection = {
                        id: instrumentId,
                        port,
                        config,
                        buffer: Buffer.alloc(0),
                        state: 'idle',
                        lastActivity: new Date(),
                    };
                    this.connections.set(config.path, connection);
                    this.setupPortListeners(connection);
                    console.log(`Connected to ${config.path} at ${config.baudRate} baud`);
                    this.emit('connected', { instrumentId, path: config.path });
                    resolve(true);
                });
            });
        }
        catch (error) {
            console.error(`Error connecting to ${config.path}:`, error);
            throw error;
        }
    }
    /**
     * Disconnect from an instrument
     */
    async disconnect(path) {
        const connection = this.connections.get(path);
        if (!connection)
            return;
        return new Promise((resolve) => {
            connection.port.close((err) => {
                if (err)
                    console.error(`Error closing port ${path}:`, err);
                this.connections.delete(path);
                this.emit('disconnected', { instrumentId: connection.id, path });
                resolve();
            });
        });
    }
    /**
     * Disconnect all instruments
     */
    async disconnectAll() {
        const paths = Array.from(this.connections.keys());
        await Promise.all(paths.map(path => this.disconnect(path)));
    }
    /**
     * Setup port event listeners
     */
    setupPortListeners(connection) {
        const { port, config } = connection;
        port.on('data', (data) => {
            connection.lastActivity = new Date();
            this.handleIncomingData(connection, data);
        });
        port.on('error', (err) => {
            console.error(`Serial port error on ${config.path}:`, err);
            connection.state = 'error';
            this.emit('error', { instrumentId: connection.id, path: config.path, error: err });
        });
        port.on('close', () => {
            console.log(`Port ${config.path} closed`);
            this.connections.delete(config.path);
            this.emit('disconnected', { instrumentId: connection.id, path: config.path });
        });
    }
    /**
     * Handle incoming data from instrument
     */
    handleIncomingData(connection, data) {
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
            if (connection.buffer.length > 0) {
                this.processCompleteMessage(connection);
            }
            connection.state = 'idle';
            connection.buffer = Buffer.alloc(0);
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
    processFrames(connection) {
        let buffer = connection.buffer;
        while (buffer.length > 0) {
            const stxIdx = buffer.indexOf(CTRL.STX);
            if (stxIdx === -1)
                break;
            const etxIdx = buffer.indexOf(CTRL.ETX, stxIdx);
            const etbIdx = buffer.indexOf(CTRL.ETB, stxIdx);
            const endIdx = etxIdx !== -1 ? etxIdx : etbIdx;
            if (endIdx === -1)
                break;
            // Need at least 2 more bytes for checksum + CR LF
            if (buffer.length < endIdx + 4)
                break;
            const frame = buffer.slice(stxIdx, endIdx + 4);
            // Verify checksum
            if (verifyChecksum(frame)) {
                this.sendACK(connection);
                // Extract data between STX and ETX/ETB
                const frameData = frame.slice(1, endIdx - stxIdx).toString('ascii');
                this.emit('frame', {
                    instrumentId: connection.id,
                    path: connection.config.path,
                    data: frameData
                });
            }
            else {
                console.warn(`Checksum failed for frame from ${connection.config.path}`);
                this.sendNAK(connection);
            }
            buffer = buffer.slice(endIdx + 4);
        }
        connection.buffer = buffer;
    }
    /**
     * Process complete ASTM message
     */
    processCompleteMessage(connection) {
        const rawData = connection.buffer.toString('ascii');
        console.log(`Processing complete message from ${connection.config.path}`);
        try {
            const message = parseASTMMessage(rawData);
            this.emit('message', {
                instrumentId: connection.id,
                path: connection.config.path,
                message,
                raw: rawData,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`Error parsing ASTM message:`, error);
            this.emit('parseError', {
                instrumentId: connection.id,
                path: connection.config.path,
                raw: rawData,
                error,
            });
        }
    }
    /**
     * Send ACK to instrument
     */
    sendACK(connection) {
        connection.port.write(Buffer.from([CTRL.ACK]), (err) => {
            if (err)
                console.error(`Error sending ACK:`, err);
        });
    }
    /**
     * Send NAK to instrument
     */
    sendNAK(connection) {
        connection.port.write(Buffer.from([CTRL.NAK]), (err) => {
            if (err)
                console.error(`Error sending NAK:`, err);
        });
    }
    /**
     * Get connection status
     */
    getStatus(path) {
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
    getAllStatuses() {
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
}
// Singleton instance
export const serialService = new SerialService();
//# sourceMappingURL=serial-service.js.map