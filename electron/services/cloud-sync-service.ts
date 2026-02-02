import { app } from 'electron';
import Database from 'better-sqlite3-multiple-ciphers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface CloudSyncConfig {
    enabled: boolean;
    serverUrl?: string;
    username?: string;
    password?: string; // For HTTP sync
    syncInterval?: number;
    lastSyncTime?: string;
}

interface ImportResult {
    success: boolean;
    message: string;
    recordsImported: number;
}

export class CloudSyncService {
    private db: Database.Database;
    private config: CloudSyncConfig;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.config = { enabled: false };
        this.loadConfig();
    }

    private loadConfig() {
        try {
            const row = this.db.prepare("SELECT value FROM settings WHERE key = 'cloud_sync_config'").get() as { value: string };
            if (row) {
                this.config = JSON.parse(row.value);
            }
        } catch (error) {
            // Config might not exist
        }
    }

    public setConfig(config: CloudSyncConfig) {
        this.config = config;
        this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('cloud_sync_config', ?)").run(JSON.stringify(config));
    }

    public getConfig(): CloudSyncConfig {
        return this.config;
    }

    public isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Exports data changed since `since` date to an encrypted JSON file.
     */
    public async exportOfflinePackage(since: string, password: string): Promise<string> {
        if (!since) since = '1970-01-01';

        // 1. Fetch data
        const results = this.db.prepare("SELECT * FROM results WHERE created_at > ?").all(since);
        const patients = this.db.prepare("SELECT * FROM patients WHERE created_at > ?").all(since);

        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            source: 'SimpleLIMS-Offline',
            data: {
                results,
                patients
            }
        };

        // 2. Encrypt
        const jsonStr = JSON.stringify(exportData);
        const encrypted = this.encrypt(jsonStr, password);

        // 3. Save to file
        const fileName = `lims_export_${new Date().toISOString().replace(/[:.]/g, '-')}.dat`;
        const exportPath = path.join(app.getPath('documents'), fileName);

        await fs.promises.writeFile(exportPath, encrypted);

        return exportPath;
    }

    /**
     * Imports an encrypted offline package.
     */
    public async importOfflinePackage(filePath: string, password: string): Promise<ImportResult> {
        try {
            // 1. Read file
            const encrypted = await fs.promises.readFile(filePath, 'utf8');

            // 2. Decrypt
            const jsonStr = this.decrypt(encrypted, password);
            const dataPackage = JSON.parse(jsonStr);

            if (dataPackage.source !== 'SimpleLIMS-Offline' || !dataPackage.data) {
                return { success: false, message: 'Invalid package format', recordsImported: 0 };
            }

            // 3. Merge Data (Simplified: Insert or Ignore)
            // In a real scenario, we need conflict resolution strategies.
            let importedCount = 0;

            const insertPatient = this.db.prepare(`
        INSERT OR IGNORE INTO patients (patient_id, name, gender, birth_date, phone, address, created_at)
        VALUES (@patient_id, @name, @gender, @birth_date, @phone, @address, @created_at)
      `);

            const insertResult = this.db.prepare(`
        INSERT OR IGNORE INTO results (sample_id, patient_id, test_code, test_name, value, unit, flag, range, remark, created_at, instrument_id)
        VALUES (@sample_id, @patient_id, @test_code, @test_name, @value, @unit, @flag, @range, @remark, @created_at, @instrument_id)
      `);

            const updateResultTransaction = this.db.transaction((patients: any[], results: any[]) => {
                for (const p of patients) {
                    insertPatient.run(p);
                }
                for (const r of results) {
                    const info = insertResult.run(r);
                    if (info.changes > 0) importedCount++;
                }
            });

            updateResultTransaction(dataPackage.data.patients || [], dataPackage.data.results || []);

            return { success: true, message: 'Import successful', recordsImported: importedCount };

        } catch (error) {
            console.error('Import Error:', error);
            return { success: false, message: (error as Error).message, recordsImported: 0 };
        }
    }

    /**
     * Performs manual online sync (Placeholder).
     */
    public async manualSync(): Promise<{ success: boolean; message: string }> {
        if (!this.config.serverUrl) {
            return { success: false, message: 'Server URL not configured' };
        }

        // Implementation would involve:
        // 1. Authenticate
        // 2. Fetch changes from server
        // 3. Upload local changes
        // 4. Handle conflicts

        return { success: false, message: 'Online sync not fully implemented in this version.' };
    }

    // --- Encryption Helpers ---

    private encrypt(text: string, secret: string): string {
        const algorithm = 'aes-256-cbc';
        // Use a fixed salt for simplicity in this POC, or generate one and prepend it.
        // For better security, derive key properly using pbkdf2.
        const key = crypto.scryptSync(secret, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    private decrypt(text: string, secret: string): string {
        const algorithm = 'aes-256-cbc';
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift() as string, 'hex');
        const encryptedText = parts.join(':');
        const key = crypto.scryptSync(secret, 'salt', 32);
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
