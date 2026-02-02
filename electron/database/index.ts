import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import { app, safeStorage } from 'electron';
import fs from 'fs';
import crypto from 'crypto';
import {
  CREATE_TABLES_SQL,
  SEED_TEST_PANELS_SQL,
  SEED_TEST_PACKAGES_SQL,
  SEED_ADDITIONAL_PANELS_SQL,
  SEED_ADDITIONAL_PACKAGES_SQL,
  SEED_ADMIN_USER_SQL,
  SEED_SETTINGS_SQL,
  SCHEMA_VERSION
} from './schema.js';

let db: Database.Database | null = null;
const KEY_FILE_NAME = 'db-key.enc';

function getEncryptionKey(): string {
  const userDataPath = app.getPath('userData');
  const keyPath = path.join(userDataPath, KEY_FILE_NAME);

  if (fs.existsSync(keyPath)) {
    // Read and decrypt existing key
    const encryptedKey = fs.readFileSync(keyPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(encryptedKey);
    } else {
      throw new Error('Encryption not available');
    }
  } else {
    // Generate new key
    const newKey = crypto.randomBytes(32).toString('hex');
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedKey = safeStorage.encryptString(newKey);
      fs.writeFileSync(keyPath, encryptedKey);
      return newKey;
    }
    // Fallback for dev/testing without safeStorage access (e.g. Linux sometimes)
    return 'development-default-key-do-not-use-in-prod';
  }
}

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'simplelims.db');
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  // console.log('Initializing database at:', dbPath);

  // Get encryption key
  const key = getEncryptionKey();

  db = new Database(dbPath);

  // Enable encryption
  db.pragma(`key = '${key}'`);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL'); // Balance between safety and performance
  db.pragma('foreign_keys = ON');

  // Check if database needs initialization
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
  `).get();

  if (!tableExists) {
    // console.log('Creating database schema...');
    db.exec(CREATE_TABLES_SQL);
    db.exec(SEED_TEST_PANELS_SQL);
    db.exec(SEED_TEST_PACKAGES_SQL);
    db.exec(SEED_ADDITIONAL_PANELS_SQL);
    db.exec(SEED_ADDITIONAL_PACKAGES_SQL);
    db.exec(SEED_ADMIN_USER_SQL);
    db.exec(SEED_SETTINGS_SQL);
    // console.log('Database initialized successfully');
  } else {
    // Check for schema migrations
    const version = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;

    console.log('*** DATABASE INIT DEBUG ***');
    console.log('*** DB PATH:', dbPath);
    console.log('*** CURRENT DB VERSION:', version?.version);
    console.log('*** TARGET SCHEMA VERSION:', SCHEMA_VERSION);

    if (version && version.version < SCHEMA_VERSION) {
      console.log(`*** STARTING MIGRATION from v${version.version} to v${SCHEMA_VERSION} ***`);

      // Migration to v2
      if (version.version < 2) {
        try {
          // Use transaction for migration safety
          db.transaction(() => {
            // Add name_en to test_panels
            try {
              db!.exec('ALTER TABLE test_panels ADD COLUMN name_en TEXT');
              console.log('Added name_en to test_panels');
            } catch (e: any) {
              if (!e.message.includes('duplicate column')) throw e;
            }

            // Add columns to test_packages
            try {
              db!.exec('ALTER TABLE test_packages ADD COLUMN name_en TEXT');
              db!.exec('ALTER TABLE test_packages ADD COLUMN description_en TEXT');
              console.log('Added columns to test_packages');
            } catch (e: any) {
              if (!e.message.includes('duplicate column')) throw e;
            }
          })();
        } catch (error) {
          console.error('Migration to v2 failed:', error);
          throw error; // Stop initialization if migration fails
        }
      }

      // Migration to v3
      if (version.version < 3) {
        try {
          db.transaction(() => {
            db!.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_results_order_id ON results(order_id)');
            console.log('Added unique index to results(order_id)');
          })();
        } catch (error) {
          console.error('Migration to v3 failed:', error);
        }
      }

      // Migration to v9 (Additional Panels - Retry)
      if (version.version < 9) {
        try {
          db.transaction(() => {
            console.log('Migrating to v9: Adding additional panels and packages...');
            db!.exec(SEED_ADDITIONAL_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PACKAGES_SQL);
            console.log('Additional panels and packages added.');
          })();
        } catch (error) {
          console.error('Migration to v9 failed:', error);
          throw error;
        }
      }

      // Migration to v10 (Imaging & DICOM)
      if (version.version < 10) {
        try {
          db.transaction(() => {
            console.log('Migrating to v10: Adding Imaging & DICOM tables...');

            // Captured Images
            db!.exec(`
              CREATE TABLE IF NOT EXISTS captured_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                capture_id TEXT NOT NULL UNIQUE,
                file_path TEXT NOT NULL,
                patient_id INTEGER REFERENCES patients(id),
                instrument_id INTEGER REFERENCES instruments(id),
                device_path TEXT,
                resolution TEXT,
                format TEXT,
                file_size INTEGER,
                metadata TEXT,
                captured_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
              )
            `);

            // DICOM Files
            db!.exec(`
              CREATE TABLE IF NOT EXISTS dicom_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                sop_instance_uid TEXT NOT NULL UNIQUE,
                study_instance_uid TEXT NOT NULL,
                series_instance_uid TEXT NOT NULL,
                modality TEXT NOT NULL,
                patient_id TEXT,
                patient_name TEXT,
                study_date TEXT,
                study_description TEXT,
                source_image_id INTEGER REFERENCES captured_images(id),
                orthanc_instance_id TEXT,
                file_size INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                uploaded_at TEXT
              )
            `);

            // Orthanc Sync Log
            db!.exec(`
              CREATE TABLE IF NOT EXISTS orthanc_sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dicom_file_id INTEGER NOT NULL REFERENCES dicom_files(id),
                orthanc_instance_id TEXT,
                orthanc_study_id TEXT,
                orthanc_patient_id TEXT,
                action TEXT NOT NULL CHECK (action IN ('upload', 'delete', 'query')),
                status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
              )
            `);

            // Indexes
            db!.exec('CREATE INDEX IF NOT EXISTS idx_captured_images_capture_id ON captured_images(capture_id)');
            db!.exec('CREATE INDEX IF NOT EXISTS idx_captured_images_patient ON captured_images(patient_id)');
            db!.exec('CREATE INDEX IF NOT EXISTS idx_captured_images_captured_at ON captured_images(captured_at)');
            db!.exec('CREATE INDEX IF NOT EXISTS idx_dicom_sop_uid ON dicom_files(sop_instance_uid)');
            db!.exec('CREATE INDEX IF NOT EXISTS idx_dicom_study_uid ON dicom_files(study_instance_uid)');
            db!.exec('CREATE INDEX IF NOT EXISTS idx_dicom_patient ON dicom_files(patient_id)');
            db!.exec('CREATE INDEX IF NOT EXISTS idx_orthanc_sync_dicom ON orthanc_sync_log(dicom_file_id)');

            console.log('Imaging & DICOM tables added.');
          })();
        } catch (error) {
          console.error('Migration to v10 failed:', error);
          throw error;
        }
      }

      // Migration to v11 (Update Test Catalog with new Chemistry & Imaging items)
      if (version.version < 11) {
        try {
          db.transaction(() => {
            console.log('Migrating to v11: Updating Test Catalog...');
            // Re-run seed SQLs to insert new items (INSERT OR IGNORE handles existing ones)
            db!.exec(SEED_TEST_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PACKAGES_SQL);
            console.log('Test Catalog updated.');
          })();
        } catch (error) {
          console.error('Migration to v11 failed:', error);
          throw error;
        }
      }

      // Migration to v12 (Retry: Update Test Catalog with new Chemistry & Imaging items)
      if (version.version < 12) {
        try {
          db.transaction(() => {
            console.log('Migrating to v12: Updating Test Catalog (Retry)...');
            // Re-run seed SQLs to insert new items (INSERT OR IGNORE handles existing ones)
            db!.exec(SEED_TEST_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PACKAGES_SQL);
            console.log('Test Catalog updated (v12).');
          })();
        } catch (error) {
          console.error('Migration to v12 failed:', error);
          throw error;
        }
      }

      // Migration to v13 (Forced Re-seed with Debugging)
      if (version.version < 13) {
        try {
          db.transaction(() => {
            console.log('*** MIGRATION v13: Force updating Test Catalog... ***');

            // Explicitly run the inserts for key items to verify they work
            console.log('Inserting Chemistry Items...');
            db!.exec(`
              INSERT OR IGNORE INTO test_panels (code, name, category, unit, decimal_places, sort_order) VALUES
              ('CK', 'catalog.items.CK', 'chemistry', 'U/L', 0, 103),
              ('CK-MB', 'catalog.items.CK_MB', 'chemistry', 'U/L', 1, 104),
              ('LDH', 'catalog.items.LDH', 'chemistry', 'U/L', 0, 102),
              ('ALP', 'catalog.items.ALP', 'chemistry', 'U/L', 0, 100),
              ('US', 'catalog.items.US', 'imaging', '', 0, 110);
            `);

            // Also run the full seed SQLs
            db!.exec(SEED_TEST_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PANELS_SQL);
            db!.exec(SEED_ADDITIONAL_PACKAGES_SQL);

            console.log('*** Test Catalog updated (v13). ***');
          })();
        } catch (error) {
          console.error('*** MIGRATION v13 FAILED:', error);
          throw error;
        }
      }

      // Update version
      db.prepare("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, datetime('now'))").run(SCHEMA_VERSION);
      console.log(`*** Database migrated to v${SCHEMA_VERSION} successfully ***`);
    }
  }



  // Self-healing: Ensure essential catalog items exist regardless of version state
  ensureTestCatalog(db);

  return db;
}

function ensureTestCatalog(db: Database.Database) {
  try {
    console.log('*** STARTING SELF-HEALING CHECK ***');

    // 1. Check Panels - Look for new Vital Signs (HR)
    const checkHR = db.prepare("SELECT 1 FROM test_panels WHERE code = 'HR'").get();
    if (!checkHR) {
      console.log('*** REPAIRING: Missing Panels (HR/Vitals)... ***');
      db.transaction(() => {
        db!.exec(SEED_TEST_PANELS_SQL);
        db!.exec(SEED_ADDITIONAL_PANELS_SQL);
      })();
    } else {
      console.log('*** CHECK: Panels (HR) OK ***');
    }

    // 2. Check Packages (We expect at least 9 new ones now, including VITALS)
    const counts = db.prepare("SELECT COUNT(*) as c FROM test_packages WHERE code IN ('MYO', 'EXT_LFT', 'DIABETES', 'ANEMIA', 'INFECTION', 'PANCREAS', 'IMAGING_PKG', 'ECG_PKG', 'VITALS')").get() as { c: number };
    console.log(`*** CHECK: Found ${counts.c} / 9 target packages ***`);

    if (counts.c < 9) {
      console.log('*** REPAIRING: Missing Packages & Mappings... ***');
      db.transaction(() => {
        // Insert Packages
        db!.exec(`
             INSERT OR IGNORE INTO test_packages (code, name, description, is_active) VALUES
             ('MYO', 'packages.MYO.name', 'packages.MYO.description', 1),
             ('EXT_LFT', 'packages.EXT_LFT.name', 'packages.EXT_LFT.description', 1),
             ('DIABETES', 'packages.DIABETES.name', 'packages.DIABETES.description', 1),
             ('ANEMIA', 'packages.ANEMIA.name', 'packages.ANEMIA.description', 1),
             ('INFECTION', 'packages.INFECTION.name', 'packages.INFECTION.description', 1),
             ('PANCREAS', 'packages.PANCREAS.name', 'packages.PANCREAS.description', 1),
             ('IMAGING_PKG', 'packages.IMAGING_PKG.name', 'packages.IMAGING_PKG.description', 1),
             ('ECG_PKG', 'packages.ECG_PKG.name', 'packages.ECG_PKG.description', 1),
             ('VITALS', 'packages.VITALS.name', 'packages.VITALS.description', 1);
           `);

        // Helper function for mapping
        const addMapping = (pkg: string, items: string[]) => {
          const placeholders = items.map(() => '?').join(',');
          db!.prepare(`
                INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
                SELECT p.id, t.id FROM test_packages p, test_panels t 
                WHERE p.code = ? AND t.code IN (${placeholders})
              `).run(pkg, ...items);
        };

        addMapping('MYO', ['CK', 'CK-MB', 'LDH']);
        addMapping('EXT_LFT', ['ALT', 'AST', 'TBIL', 'DBIL', 'IBIL', 'ALP', 'GGT', 'TP', 'ALB']);
        addMapping('DIABETES', ['GLU', 'HbA1c']);
        addMapping('ANEMIA', ['Ferritin', 'VitB12', 'Folate']);
        addMapping('INFECTION', ['CRP', 'PCT']);
        addMapping('PANCREAS', ['AMY']);
        addMapping('IMAGING_PKG', ['US', 'XR']);
        addMapping('ECG_PKG', ['ECG']);
        addMapping('VITALS', ['HR', 'SpO2', 'BP_SYS', 'BP_DIA', 'RR', 'TEMP']);

        console.log('*** REPAIR COMPLETE: Packages restored. ***');
      })();
    }
  } catch (error) {
    console.error('*** REPAIR FAILED:', error);
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    try {
      console.log('Checkpointing WAL before close...');
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      console.error('Checkpoint failed:', e);
    }
    db.close();
    db = null;
  }
}

export function isDatabaseInitialized(): boolean {
  return db !== null;
}

export function checkpointDatabase(): void {
  const database = getDatabase();
  try {
    database.pragma('wal_checkpoint(PASSIVE)');
  } catch (err) {
    console.error('Manual checkpoint failed:', err);
  }
}

// Database query helpers
export function query<T>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];
}

export function get<T>(sql: string, params: unknown[] = []): T | undefined {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function run(sql: string, params: unknown[] = []): Database.RunResult {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

// Backup and restore
export function backupDatabase(targetPath: string): boolean {
  try {
    const database = getDatabase();
    database.backup(targetPath);
    return true;
  } catch (error) {
    console.error('Backup failed:', error);
    return false;
  }
}

export function restoreDatabase(sourcePath: string): boolean {
  try {
    closeDatabase();
    const sourceDb = new Database(sourcePath, { readonly: true });
    const dbPath = getDbPath();
    sourceDb.backup(dbPath);
    sourceDb.close();
    initDatabase();
    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    return false;
  }
}
