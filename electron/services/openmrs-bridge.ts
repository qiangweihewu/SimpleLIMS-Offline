import Database from 'better-sqlite3-multiple-ciphers';

interface OpenMRSConfig {
    enabled: boolean;
    baseUrl: string;
    username?: string;
    password?: string;
}

interface FhirObservation {
    resourceType: 'Observation';
    [key: string]: any;
}

export class OpenMRSBridge {
    private db: Database.Database;
    private config: OpenMRSConfig;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.config = {
            enabled: false,
            baseUrl: '',
        };
        this.loadConfig();
    }

    private loadConfig() {
        try {
            const row = this.db.prepare("SELECT value FROM settings WHERE key = 'openmrs_config'").get() as { value: string };
            if (row) {
                this.config = JSON.parse(row.value);
            }
        } catch (error) {
            // Configuration might not exist
        }
    }

    public setConfig(config: OpenMRSConfig) {
        this.config = config;
        this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('openmrs_config', ?)").run(JSON.stringify(config));
    }

    public getConfig(): OpenMRSConfig {
        return this.config;
    }

    public isEnabled(): boolean {
        return this.config.enabled && !!this.config.baseUrl;
    }

    /**
     * Pushes a FHIR Observation to OpenMRS.
     */
    public async pushObservation(fhirObservation: FhirObservation): Promise<{ success: boolean; message: string }> {
        if (!this.isEnabled()) {
            return { success: false, message: 'OpenMRS integration is not enabled or configured.' };
        }

        try {
            const auth = btoa(`${this.config.username}:${this.config.password}`);
            const response = await fetch(`${this.config.baseUrl}/ws/fhir2/R4/Observation`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/fhir+json'
                },
                body: JSON.stringify(fhirObservation)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenMRS API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            return { success: true, message: `Observation pushed successfully. ID: ${result.id}` };

        } catch (error) {
            console.error('OpenMRS Push Error:', error);
            return { success: false, message: (error as Error).message };
        }
    }

    /**
     * Finds a patient in OpenMRS by identifier.
     */
    public async findPatient(identifier: string): Promise<any | null> {
        if (!this.isEnabled()) {
            throw new Error('OpenMRS integration is not enabled.');
        }

        try {
            const auth = btoa(`${this.config.username}:${this.config.password}`);
            // OpenMRS FHIR Patient Search by Identifier
            const url = `${this.config.baseUrl}/ws/fhir2/R4/Patient?identifier=${identifier}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/fhir+json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to find patient: ${response.statusText}`);
            }

            const bundle = await response.json();
            if (bundle.entry && bundle.entry.length > 0) {
                return bundle.entry[0].resource;
            }
            return null;

        } catch (error) {
            console.error('OpenMRS Find Patient Error:', error);
            throw error;
        }
    }
}
