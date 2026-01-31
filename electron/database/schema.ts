// SimpleLIMS-Offline Database Schema
// SQLite with WAL mode for concurrent read/write

export const SCHEMA_VERSION = 3;

export const CREATE_TABLES_SQL = `
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'technician', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL UNIQUE, -- External ID (e.g., P-20260129-001)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Test panels / catalog
CREATE TABLE IF NOT EXISTS test_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT, -- English name for bilingual reports
  category TEXT NOT NULL, -- hematology, chemistry, urinalysis, immunology
  unit TEXT,
  ref_range_male_low REAL,
  ref_range_male_high REAL,
  ref_range_female_low REAL,
  ref_range_female_high REAL,
  ref_range_child_low REAL,
  ref_range_child_high REAL,
  panic_low REAL, -- Critical low value
  panic_high REAL, -- Critical high value
  decimal_places INTEGER DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Test packages (groups of test panels)
CREATE TABLE IF NOT EXISTS test_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT, -- English name
  description TEXT,
  description_en TEXT, -- English description
  price REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Test package items (many-to-many)
CREATE TABLE IF NOT EXISTS test_package_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL REFERENCES test_packages(id) ON DELETE CASCADE,
  panel_id INTEGER NOT NULL REFERENCES test_panels(id) ON DELETE CASCADE,
  UNIQUE(package_id, panel_id)
);

-- Samples
CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id TEXT NOT NULL UNIQUE, -- Barcode/ID (e.g., S-20260129-001)
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  sample_type TEXT NOT NULL DEFAULT 'blood', -- blood, urine, serum, plasma
  collected_at TEXT NOT NULL DEFAULT (datetime('now')),
  collected_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'stat')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders (test requests)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  panel_id INTEGER NOT NULL REFERENCES test_panels(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  ordered_at TEXT NOT NULL DEFAULT (datetime('now')),
  ordered_by INTEGER REFERENCES users(id),
  completed_at TEXT,
  UNIQUE(sample_id, panel_id)
);

-- Results
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  value TEXT, -- Stored as text, can be numeric or qualitative
  numeric_value REAL, -- For numeric results
  unit TEXT,
  flag TEXT CHECK (flag IN ('N', 'H', 'L', 'HH', 'LL', 'C')), -- Normal, High, Low, Critical High/Low, Critical
  reference_range TEXT, -- Displayed reference range
  instrument_id INTEGER REFERENCES instruments(id),
  raw_data TEXT, -- Original data from instrument
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'instrument', 'calculated')),
  verified_by INTEGER REFERENCES users(id),
  verified_at TEXT,
  is_released INTEGER NOT NULL DEFAULT 0,
  released_at TEXT,
  released_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_results_order_id ON results(order_id);

-- Instruments
CREATE TABLE IF NOT EXISTS instruments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacturer TEXT,
  serial_number TEXT,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('serial', 'tcp', 'file')),
  protocol TEXT NOT NULL CHECK (protocol IN ('astm', 'hl7', 'csv', 'custom')),
  -- Serial port settings
  port_path TEXT,
  baud_rate INTEGER DEFAULT 9600,
  data_bits INTEGER DEFAULT 8,
  stop_bits REAL DEFAULT 1,
  parity TEXT DEFAULT 'none',
  -- TCP settings
  host TEXT,
  port INTEGER,
  tcp_mode TEXT CHECK (tcp_mode IN ('client', 'server')),
  -- File watch settings
  watch_folder TEXT,
  file_pattern TEXT,
  -- CSV parsing config (JSON string)
  csv_config TEXT,
  -- Status
  is_active INTEGER NOT NULL DEFAULT 1,
  is_connected INTEGER NOT NULL DEFAULT 0,
  last_activity TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Instrument test mapping (instrument code -> LIMS panel)
CREATE TABLE IF NOT EXISTS instrument_test_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  instrument_code TEXT NOT NULL, -- Code sent by instrument (e.g., "WBC", "1", "GLU")
  panel_id INTEGER NOT NULL REFERENCES test_panels(id),
  conversion_factor REAL DEFAULT 1.0, -- For unit conversion
  notes TEXT,
  UNIQUE(instrument_id, instrument_code)
);

-- Unmatched data pool (results that couldn't be auto-matched)
CREATE TABLE IF NOT EXISTS unmatched_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER REFERENCES instruments(id),
  sample_id_raw TEXT, -- Sample ID as received from instrument
  patient_id_raw TEXT,
  raw_data TEXT NOT NULL,
  parsed_data TEXT, -- JSON of parsed results
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'discarded')),
  claimed_sample_id INTEGER REFERENCES samples(id),
  claimed_by INTEGER REFERENCES users(id),
  claimed_at TEXT,
  discard_reason TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL, -- login, logout, create, update, delete, verify, release, print
  entity_type TEXT NOT NULL, -- patient, sample, order, result, user, instrument
  entity_id INTEGER,
  old_value TEXT, -- JSON of old values
  new_value TEXT, -- JSON of new values
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lab settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- QC Materials
CREATE TABLE IF NOT EXISTS qc_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  manufacturer TEXT,
  panel_id INTEGER NOT NULL REFERENCES test_panels(id),
  target_value REAL NOT NULL,
  sd REAL NOT NULL, -- Standard deviation
  expiry_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- QC Results
CREATE TABLE IF NOT EXISTS qc_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL REFERENCES qc_materials(id),
  instrument_id INTEGER REFERENCES instruments(id),
  value REAL NOT NULL,
  westgard_status TEXT, -- pass, 1_2s, 1_3s, 2_2s, r_4s, 4_1s, 10x
  is_accepted INTEGER NOT NULL DEFAULT 1,
  performed_by INTEGER REFERENCES users(id),
  performed_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_samples_sample_id ON samples(sample_id);
CREATE INDEX IF NOT EXISTS idx_samples_patient_id ON samples(patient_id);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_collected_at ON samples(collected_at);
CREATE INDEX IF NOT EXISTS idx_orders_sample_id ON orders(sample_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_results_order_id ON results(order_id);
CREATE INDEX IF NOT EXISTS idx_results_verified ON results(is_released, verified_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_unmatched_status ON unmatched_data(status);

-- Insert schema version
INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;

// Default test panels (CBC, CMP, etc.)
export const SEED_TEST_PANELS_SQL = `
INSERT OR IGNORE INTO test_panels (code, name, category, unit, ref_range_male_low, ref_range_male_high, ref_range_female_low, ref_range_female_high, decimal_places, sort_order) VALUES
-- Hematology - CBC
('WBC', 'catalog.items.WBC', 'hematology', '10^9/L', 4.0, 10.0, 4.0, 10.0, 2, 1),
('RBC', 'catalog.items.RBC', 'hematology', '10^12/L', 4.5, 5.5, 4.0, 5.0, 2, 2),
('HGB', 'catalog.items.HGB', 'hematology', 'g/L', 130, 175, 115, 150, 0, 3),
('HCT', 'catalog.items.HCT', 'hematology', '%', 40, 50, 35, 45, 1, 4),
('PLT', 'catalog.items.PLT', 'hematology', '10^9/L', 100, 300, 100, 300, 0, 5),
('MCV', 'catalog.items.MCV', 'hematology', 'fL', 80, 100, 80, 100, 1, 6),
('MCH', 'catalog.items.MCH', 'hematology', 'pg', 27, 34, 27, 34, 1, 7),
('MCHC', 'catalog.items.MCHC', 'hematology', 'g/L', 320, 360, 320, 360, 0, 8),
('NEUT%', 'catalog.items.NEUT%', 'hematology', '%', 50, 70, 50, 70, 1, 9),
('LYMPH%', 'catalog.items.LYMPH%', 'hematology', '%', 20, 40, 20, 40, 1, 10),

-- Chemistry
('GLU', 'catalog.items.GLU', 'chemistry', 'mmol/L', 3.9, 6.1, 3.9, 6.1, 2, 20),
('BUN', 'catalog.items.BUN', 'chemistry', 'mmol/L', 2.9, 8.2, 2.9, 8.2, 2, 21),
('CREA', 'catalog.items.CREA', 'chemistry', 'μmol/L', 44, 133, 44, 97, 0, 22),
('UA', 'catalog.items.UA', 'chemistry', 'μmol/L', 208, 428, 155, 357, 0, 23),
('ALT', 'catalog.items.ALT', 'chemistry', 'U/L', 0, 40, 0, 40, 0, 24),
('AST', 'catalog.items.AST', 'chemistry', 'U/L', 0, 40, 0, 40, 0, 25),
('TBIL', 'catalog.items.TBIL', 'chemistry', 'μmol/L', 3.4, 20.5, 3.4, 20.5, 1, 26),
('TP', 'catalog.items.TP', 'chemistry', 'g/L', 60, 80, 60, 80, 0, 27),
('ALB', 'catalog.items.ALB', 'chemistry', 'g/L', 35, 55, 35, 55, 0, 28),

-- Lipid Panel
('TC', 'catalog.items.TC', 'chemistry', 'mmol/L', 0, 5.2, 0, 5.2, 2, 30),
('TG', 'catalog.items.TG', 'chemistry', 'mmol/L', 0, 1.7, 0, 1.7, 2, 31),
('HDL', 'catalog.items.HDL', 'chemistry', 'mmol/L', 1.0, 9.9, 1.3, 9.9, 2, 32),
('LDL', 'catalog.items.LDL', 'chemistry', 'mmol/L', 0, 3.4, 0, 3.4, 2, 33),

-- Diabetes
('HbA1c', 'catalog.items.HbA1c', 'chemistry', '%', 4.0, 6.0, 4.0, 6.0, 1, 40);
`;

// Default test packages (common panels)
// Default test packages (common panels)
export const SEED_TEST_PACKAGES_SQL = `
INSERT OR IGNORE INTO test_packages (code, name, description) VALUES
('CBC', 'packages.CBC.name', 'packages.CBC.description'),
('LFT', 'packages.LFT.name', 'packages.LFT.description'),
('RFT', 'packages.RFT.name', 'packages.RFT.description'),
('LIPID', 'packages.LIPID.name', 'packages.LIPID.description');

-- CBC package items (WBC, RBC, HGB, HCT, PLT, MCV, MCH, MCHC)
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'CBC' AND t.code IN ('WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'MCV', 'MCH', 'MCHC');

-- LFT package items (ALT, AST, TBIL)
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'LFT' AND t.code IN ('ALT', 'AST', 'TBIL');

-- RFT package items (BUN, CREA, UA)
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'RFT' AND t.code IN ('BUN', 'CREA', 'UA');

-- LIPID package items (TC, TG, HDL, LDL)
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'LIPID' AND t.code IN ('TC', 'TG', 'HDL', 'LDL');
`;

// Default admin user (password: admin123)
export const SEED_ADMIN_USER_SQL = `
INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES
('admin', '$2a$10$HjvdlAz/cDDGM2T5SHKvKOxFi/zQBjH6N2hLBTrOUJwpby5WoVQeW', 'Administrator', 'admin');
`;

// Default settings
export const SEED_SETTINGS_SQL = `
INSERT OR IGNORE INTO settings (key, value) VALUES
('lab_name', 'SimpleLIMS Laboratory'),
('lab_address', ''),
('lab_phone', ''),
('lab_email', ''),
('lab_logo', ''),
('report_footer', ''),
('language', 'zh'),
('date_format', 'YYYY-MM-DD'),
('time_format', 'HH:mm:ss'),
('sample_id_prefix', 'S'),
('patient_id_prefix', 'P'),
('auto_backup_enabled', '0'),
('auto_backup_path', ''),
('auto_backup_interval', '24');
`;
