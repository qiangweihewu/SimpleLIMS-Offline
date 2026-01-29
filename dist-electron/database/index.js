import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { CREATE_TABLES_SQL, SEED_TEST_PANELS_SQL, SEED_ADMIN_USER_SQL, SEED_SETTINGS_SQL, SCHEMA_VERSION } from './schema';
let db = null;
export function getDbPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'simplelims.db');
}
export function initDatabase() {
    if (db)
        return db;
    const dbPath = getDbPath();
    console.log('Initializing database at:', dbPath);
    db = new Database(dbPath);
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Check if database needs initialization
    const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
  `).get();
    if (!tableExists) {
        console.log('Creating database schema...');
        db.exec(CREATE_TABLES_SQL);
        db.exec(SEED_TEST_PANELS_SQL);
        db.exec(SEED_ADMIN_USER_SQL);
        db.exec(SEED_SETTINGS_SQL);
        console.log('Database initialized successfully');
    }
    else {
        // Check for schema migrations
        const version = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get();
        if (version && version.version < SCHEMA_VERSION) {
            console.log(`Migrating database from v${version.version} to v${SCHEMA_VERSION}`);
            // Add migration logic here when needed
        }
    }
    return db;
}
export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
// Database query helpers
export function query(sql, params = []) {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.all(...params);
}
export function get(sql, params = []) {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.get(...params);
}
export function run(sql, params = []) {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    return stmt.run(...params);
}
export function transaction(fn) {
    const database = getDatabase();
    return database.transaction(fn)();
}
// Backup and restore
export function backupDatabase(targetPath) {
    try {
        const database = getDatabase();
        database.backup(targetPath);
        return true;
    }
    catch (error) {
        console.error('Backup failed:', error);
        return false;
    }
}
export function restoreDatabase(sourcePath) {
    try {
        closeDatabase();
        const sourceDb = new Database(sourcePath, { readonly: true });
        const dbPath = getDbPath();
        sourceDb.backup(dbPath);
        sourceDb.close();
        initDatabase();
        return true;
    }
    catch (error) {
        console.error('Restore failed:', error);
        return false;
    }
}
//# sourceMappingURL=index.js.map