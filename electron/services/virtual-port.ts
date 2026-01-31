
import { EventEmitter } from 'events';

export class VirtualPort extends EventEmitter {
    path: string;
    baudRate: number;
    isOpen: boolean = false;

    constructor(options: { path: string; baudRate: number;[key: string]: any }) {
        super();
        this.path = options.path;
        this.baudRate = options.baudRate;
    }

    open(callback?: (err?: Error | null) => void) {
        this.isOpen = true;
        setTimeout(() => {
            this.emit('open');
            if (callback) callback(null);
        }, 10);
    }

    close(callback?: (err?: Error | null) => void) {
        this.isOpen = false;
        setTimeout(() => {
            this.emit('close');
            if (callback) callback(null);
        }, 10);
    }

    write(data: string | Buffer | number[], callback?: (err?: Error | null) => void) {
        if (!this.isOpen) {
            if (callback) callback(new Error('Port is not open'));
            return;
        }

        // Echo back to the "instrument" logic? 
        // In a real scenario, we write to the instrument.
        // Here we emit 'write' so our simulator can pick it up and respond (e.g. respond with ACK).
        this.emit('dataOnPort', Buffer.isBuffer(data) ? data : Buffer.from(data));

        if (callback) callback(null);
    }

    // Method to simulate receiving data from the instrument
    simulateReceive(data: Buffer) {
        if (this.isOpen) {
            this.emit('data', data);
        }
    }
}
