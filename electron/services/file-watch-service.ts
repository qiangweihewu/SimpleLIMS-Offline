/**
 * File Watch Service
 * Monitor directories for new result files from instruments (CSV, ASTM, HL7)
 */

import chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { parseASTMMessage } from './astm-parser.js';
import { CSVParser, type CSVParserConfig, type CSVResultRecord } from './csv-parser.js';
import { parseHL7Message, isHL7Message, isMLLPFramed, stripMLLP } from './hl7-parser.js';

export interface FileWatchConfig {
    path: string;
    pattern?: string; // e.g. '*.astm', '*.txt'
    protocol?: 'astm' | 'hl7' | 'csv' | 'custom';
    csvConfig?: CSVParserConfig;
}

export class FileWatchService extends EventEmitter {
    private watchers: Map<number, any> = new Map();
    private configs: Map<number, FileWatchConfig> = new Map();

    constructor() {
        super();
    }

    async startWatching(instrumentId: number, config: FileWatchConfig): Promise<boolean> {
        if (this.watchers.has(instrumentId)) {
            console.log(`Already watching for instrument ${instrumentId}`);
            return true;
        }

        try {
            // Ensure directory exists
            try {
                await fs.access(config.path);
            } catch {
                await fs.mkdir(config.path, { recursive: true });
            }

            const watchPath = config.pattern ? path.join(config.path, config.pattern) : config.path;
            console.log(`Starting watch on ${watchPath}`);

            const watcher = chokidar.watch(watchPath, {
                persistent: true,
                ignoreInitial: false, // Process existing files on startup? Maybe configurable.
                awaitWriteFinish: {
                    stabilityThreshold: 2000,
                    pollInterval: 100
                }
            });

            watcher.on('add', async (filePath) => {
                console.log(`File detected: ${filePath}`);
                await this.processFile(instrumentId, filePath);
            });

            watcher.on('error', (error) => {
                console.error(`Watcher error for instrument ${instrumentId}:`, error);
                this.emit('error', { instrumentId, error });
            });

            this.watchers.set(instrumentId, watcher);
            this.configs.set(instrumentId, config);
            this.emit('connected', { instrumentId, path: config.path });
            return true;
        } catch (error) {
            console.error(`Failed to start watcher for instrument ${instrumentId}:`, error);
            return false;
        }
    }

    async stopWatching(instrumentId: number): Promise<void> {
        const watcher = this.watchers.get(instrumentId);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(instrumentId);
            this.configs.delete(instrumentId);
            this.emit('disconnected', { instrumentId });
        }
    }

    private detectProtocol(filePath: string, content: string, configProtocol?: string): 'astm' | 'hl7' | 'csv' {
        if (configProtocol === 'csv') return 'csv';
        if (configProtocol === 'hl7') return 'hl7';
        if (configProtocol === 'astm') return 'astm';

        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.csv' || ext === '.tsv') return 'csv';

        if (isHL7Message(content)) return 'hl7';

        const firstLine = content.split('\n')[0] || '';
        if (firstLine.startsWith('H|') || firstLine.includes('|^\\&')) return 'astm';

        const commaCount = (firstLine.match(/,/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const pipeCount = (firstLine.match(/\|/g) || []).length;

        if ((commaCount >= 2 || tabCount >= 2) && pipeCount < 3) return 'csv';

        return 'astm';
    }

    private async processFile(instrumentId: number, filePath: string) {
        try {
            const rawBuffer = await fs.readFile(filePath);
            let content: string;

            if (isMLLPFramed(rawBuffer)) {
                content = stripMLLP(rawBuffer);
            } else {
                content = rawBuffer.toString('utf-8');
            }

            const config = this.configs.get(instrumentId);
            const protocol = this.detectProtocol(filePath, content, config?.protocol);

            try {
                if (protocol === 'csv') {
                    const csvConfig = config?.csvConfig || {
                        delimiter: ',',
                        hasHeader: true,
                        columnMapping: { testCode: 0, result: 1 }
                    };
                    const parser = new CSVParser(csvConfig);
                    const results: CSVResultRecord[] = parser.parseContent(content);

                    this.emit('csv-message', {
                        instrumentId,
                        results,
                        raw: content,
                        timestamp: new Date().toISOString(),
                        sourceFile: filePath
                    });
                } else if (protocol === 'hl7') {
                    const message = parseHL7Message(content);
                    this.emit('message', {
                        instrumentId,
                        message,
                        protocol: 'HL7',
                        raw: content,
                        timestamp: new Date().toISOString(),
                        sourceFile: filePath
                    });
                } else {
                    const message = parseASTMMessage(content);
                    this.emit('message', {
                        instrumentId,
                        message,
                        protocol: 'ASTM',
                        raw: content,
                        timestamp: new Date().toISOString(),
                        sourceFile: filePath
                    });
                }
            } catch (parseError) {
                console.error(`Error parsing file ${filePath}:`, parseError);
                this.emit('error', { instrumentId, error: parseError, filePath });
            }

            const dir = path.dirname(filePath);
            const filename = path.basename(filePath);
            const processedDir = path.join(dir, 'processed');

            try {
                await fs.access(processedDir);
            } catch {
                await fs.mkdir(processedDir);
            }

            const destPath = path.join(processedDir, `${Date.now()}_${filename}`);
            await fs.rename(filePath, destPath);
            console.log(`Moved ${filename} to processed`);

        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            this.emit('error', { instrumentId, error, filePath });
        }
    }

    getStatus(instrumentId: number): { connected: boolean; state: string } {
        const isWatching = this.watchers.has(instrumentId);
        return {
            connected: isWatching,
            state: isWatching ? 'watching' : 'idle'
        };
    }

    /**
     * Stop all file watchers
     */
    async stopAll(): Promise<void> {
        console.log('Stopping all file watchers...');
        const promises = Array.from(this.watchers.keys()).map(id => this.stopWatching(id));
        await Promise.all(promises);
    }
}

export const fileWatchService = new FileWatchService();
