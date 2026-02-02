import { app } from 'electron';
import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';

interface DHIS2Config {
    enabled: boolean;
    baseUrl: string;
    username?: string;
    password?: string;
    orgUnitId?: string;
    dataSetId?: string;
    periodFormat?: 'Daily' | 'Weekly' | 'Monthly';
}

interface AggregateData {
    date: string; // ISO format YYYY-MM-DD
    metrics: Record<string, number>; // dataElementId -> value
}

export class DHIS2Reporter {
    private db: Database.Database;
    private config: DHIS2Config;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.config = {
            enabled: false,
            baseUrl: '',
            periodFormat: 'Daily'
        };
        this.loadConfig();
    }

    private loadConfig() {
        try {
            const row = this.db.prepare("SELECT value FROM settings WHERE key = 'dhis2_config'").get() as { value: string };
            if (row) {
                this.config = JSON.parse(row.value);
            }
        } catch (error) {
            // Config might not exist yet
        }
    }

    public setConfig(config: DHIS2Config) {
        this.config = config;
        this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dhis2_config', ?)").run(JSON.stringify(config));
    }

    public getConfig(): DHIS2Config {
        return this.config;
    }

    public isEnabled(): boolean {
        return this.config.enabled && !!this.config.baseUrl && !!this.config.orgUnitId && !!this.config.dataSetId;
    }

    /**
     * Generates daily aggregate statistics for a given date.
     * This is a simplified example. In a real app, you'd calculate these based on mapped indicators.
     */
    public generateAggregate(date: string): AggregateData {
        // Example: Count HIV tests and Malaria tests from results table
        // We assume test names or codes are mapped to data elements.
        // For now, let's just query raw counts for demonstration.

        // In a real implementation, you would have a `dhis2_mappings` table 
        // mapping local test codes to DHIS2 Data Element IDs.

        // Mock metrics for now
        const metrics: Record<string, number> = {};

        // Example query: Count positive malaria results
        const malariaCount = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM results 
      WHERE test_name LIKE '%Malaria%' 
      AND value LIKE '%Positive%'
      AND date(created_at) = ?
    `).get(date) as { count: number };

        // Example query: Count total HIV tests
        const hivCount = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM results 
      WHERE test_name LIKE '%HIV%'
      AND date(created_at) = ?
    `).get(date) as { count: number };

        // You would map these to specific Data Element IDs configured in the system
        // For this POC, we use placeholders
        metrics['MALARIA_POS_ID'] = malariaCount.count;
        metrics['HIV_TESTS_ID'] = hivCount.count;

        return {
            date,
            metrics
        };
    }

    /**
     * Submits aggregate data to DHIS2.
     */
    public async submitData(aggregate: AggregateData): Promise<{ success: boolean; message: string }> {
        if (!this.isEnabled()) {
            return { success: false, message: 'DHIS2 integration is not enabled or configured.' };
        }

        try {
            const dataValues = Object.entries(aggregate.metrics).map(([dataElement, value]) => ({
                dataElement,
                period: this.formatPeriod(aggregate.date),
                orgUnit: this.config.orgUnitId,
                value
            }));

            const payload = {
                dataSet: this.config.dataSetId,
                period: this.formatPeriod(aggregate.date),
                orgUnit: this.config.orgUnitId,
                dataValues
            };

            const auth = btoa(`${this.config.username}:${this.config.password}`);
            const response = await fetch(`${this.config.baseUrl}/api/dataValueSets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`DHIS2 API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            return { success: true, message: `Data submitted successfully: ${JSON.stringify(result.importCount)}` };

        } catch (error: any) {
            console.error('DHIS2 Submit Error:', error);
            return { success: false, message: error.message };
        }
    }

    private formatPeriod(dateStr: string): string {
        // dateStr is YYYY-MM-DD
        // DHIS2 daily format: YYYYMMDD
        return dateStr.replace(/-/g, '');
    }
}
