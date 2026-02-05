// SimpleLIMS-Offline Database Schema
// SQLite with WAL mode for concurrent read/write

export const SCHEMA_VERSION = 14;

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
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
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

-- ============================================
-- Phase 1: New tables for Legacy Device Integration
-- ============================================

-- Device Traffic Log (Raw byte stream forensic logging)
CREATE TABLE IF NOT EXISTS device_traffic_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER REFERENCES instruments(id),
  direction TEXT NOT NULL CHECK (direction IN ('rx', 'tx')),
  raw_bytes BLOB NOT NULL,
  hex_dump TEXT,
  receipt_timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Data Quality History (Historical quality metrics)
CREATE TABLE IF NOT EXISTS data_quality_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  total_packets INTEGER NOT NULL DEFAULT 0,
  successful_packets INTEGER NOT NULL DEFAULT 0,
  failed_packets INTEGER NOT NULL DEFAULT 0,
  checksum_errors INTEGER NOT NULL DEFAULT 0,
  packet_loss_rate REAL,
  checksum_error_rate REAL,
  data_completeness REAL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Device Lifecycle Events (Full lifecycle tracking)
CREATE TABLE IF NOT EXISTS device_lifecycle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'install', 'calibration', 'maintenance', 'repair', 'upgrade', 'decommission')),
  event_date TEXT NOT NULL,
  description TEXT,
  cost REAL,
  performed_by TEXT,
  next_due_date TEXT,
  attachments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FHIR Resources (Semantic interoperability layer)
CREATE TABLE IF NOT EXISTS fhir_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL UNIQUE,
  resource_json TEXT NOT NULL,
  source_result_id INTEGER REFERENCES results(id),
  source_instrument_id INTEGER REFERENCES instruments(id),
  loinc_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT
);

-- Predictive Maintenance Scores (Health tracking)
CREATE TABLE IF NOT EXISTS predictive_maintenance_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  overall_score REAL NOT NULL,
  communication_health REAL,
  calibration_status REAL,
  maintenance_compliance REAL,
  usage_pattern REAL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  recommendations TEXT,
  predicted_issues TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- Phase 5: Imaging Device Support
-- ============================================

-- Captured Images (from video capture devices)
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
);

-- DICOM Files (wrapped images/videos)
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
);

-- Orthanc Sync Log (PACS upload tracking)
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
);

-- ============================================
-- Indexes
-- ============================================

-- Existing indexes
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

-- New indexes for Phase 1 tables
CREATE INDEX IF NOT EXISTS idx_traffic_instrument ON device_traffic_log(instrument_id);
CREATE INDEX IF NOT EXISTS idx_traffic_timestamp ON device_traffic_log(receipt_timestamp);
CREATE INDEX IF NOT EXISTS idx_traffic_direction ON device_traffic_log(direction);
CREATE INDEX IF NOT EXISTS idx_quality_instrument ON data_quality_history(instrument_id);
CREATE INDEX IF NOT EXISTS idx_quality_window ON data_quality_history(window_start);
CREATE INDEX IF NOT EXISTS idx_lifecycle_instrument ON device_lifecycle(instrument_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_event_type ON device_lifecycle(event_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_due_date ON device_lifecycle(next_due_date);

-- FHIR Resources indexes
CREATE INDEX IF NOT EXISTS idx_fhir_resource_type ON fhir_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_id ON fhir_resources(resource_id);
CREATE INDEX IF NOT EXISTS idx_fhir_loinc ON fhir_resources(loinc_code);
CREATE INDEX IF NOT EXISTS idx_fhir_source_result ON fhir_resources(source_result_id);

-- Predictive Maintenance indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_instrument ON predictive_maintenance_scores(instrument_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_risk ON predictive_maintenance_scores(risk_level);

-- Phase 5: Imaging indexes
CREATE INDEX IF NOT EXISTS idx_captured_images_capture_id ON captured_images(capture_id);
CREATE INDEX IF NOT EXISTS idx_captured_images_patient ON captured_images(patient_id);
CREATE INDEX IF NOT EXISTS idx_captured_images_captured_at ON captured_images(captured_at);
CREATE INDEX IF NOT EXISTS idx_dicom_sop_uid ON dicom_files(sop_instance_uid);
CREATE INDEX IF NOT EXISTS idx_dicom_study_uid ON dicom_files(study_instance_uid);
CREATE INDEX IF NOT EXISTS idx_dicom_patient ON dicom_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_dicom_modality ON dicom_files(modality);
CREATE INDEX IF NOT EXISTS idx_orthanc_sync_dicom ON orthanc_sync_log(dicom_file_id);
CREATE INDEX IF NOT EXISTS idx_orthanc_sync_status ON orthanc_sync_log(status);

-- ============================================
-- Phase 6: Equipment Maintenance Enhancement
-- ============================================

-- Equipment Attachments (images for equipment and maintenance records)
CREATE TABLE IF NOT EXISTS equipment_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_id INTEGER REFERENCES maintenance_records(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Document Version History (for knowledge base)
CREATE TABLE IF NOT EXISTS document_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Equipment attachments indexes
CREATE INDEX IF NOT EXISTS idx_attachments_equipment ON equipment_attachments(equipment_id);
CREATE INDEX IF NOT EXISTS idx_attachments_maintenance ON equipment_attachments(maintenance_id);

-- Document versions indexes
CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_number ON document_versions(version_number);

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

// Additional Panels (Electrolytes, Coagulation, Urinalysis, Immunoassay)
export const SEED_ADDITIONAL_PANELS_SQL = `
INSERT OR IGNORE INTO test_panels (code, name, category, unit, ref_range_male_low, ref_range_male_high, ref_range_female_low, ref_range_female_high, decimal_places, sort_order) VALUES
('Na', 'catalog.items.Na', 'electrolytes', 'mmol/L', 135, 145, 135, 145, 1, 50),
('K', 'catalog.items.K', 'electrolytes', 'mmol/L', 3.5, 5.5, 3.5, 5.5, 1, 51),
('Cl', 'catalog.items.Cl', 'electrolytes', 'mmol/L', 96, 106, 96, 106, 1, 52),
('Ca', 'catalog.items.Ca', 'electrolytes', 'mmol/L', 2.1, 2.6, 2.1, 2.6, 2, 53),
('PHOS', 'catalog.items.PHOS', 'electrolytes', 'mmol/L', 0.8, 1.5, 0.8, 1.5, 2, 54),
('Mg', 'catalog.items.Mg', 'electrolytes', 'mmol/L', 0.7, 1.1, 0.7, 1.1, 2, 55),
('PT', 'catalog.items.PT', 'coagulation', 's', 11, 13.5, 11, 13.5, 1, 60),
('APTT', 'catalog.items.APTT', 'coagulation', 's', 25, 35, 25, 35, 1, 61),
('FIB', 'catalog.items.FIB', 'coagulation', 'g/L', 2, 4, 2, 4, 2, 62),
('TT', 'catalog.items.TT', 'coagulation', 's', 14, 21, 14, 21, 1, 63),
('INR', 'catalog.items.INR', 'coagulation', '', 0.8, 1.2, 0.8, 1.2, 2, 64),
('D-Dimer', 'catalog.items.D_Dimer', 'coagulation', 'mg/L FEU', 0, 0.5, 0, 0.5, 2, 65),
('U-pH', 'catalog.items.U_pH', 'urinalysis', '', 4.5, 8.0, 4.5, 8.0, 1, 70),
('U-SG', 'catalog.items.U_SG', 'urinalysis', '', 1.005, 1.030, 1.005, 1.030, 3, 71),
('U-PRO', 'catalog.items.U_PRO', 'urinalysis', 'mg/dL', 0, 0, 0, 0, 0, 72),
('U-GLU', 'catalog.items.U_GLU', 'urinalysis', 'mmol/L', 0, 0, 0, 0, 0, 73),
('U-KET', 'catalog.items.U_KET', 'urinalysis', 'mmol/L', 0, 0, 0, 0, 0, 74),
('U-BIL', 'catalog.items.U_BIL', 'urinalysis', 'μmol/L', 0, 0, 0, 0, 0, 75),
('U-UBG', 'catalog.items.U_UBG', 'urinalysis', 'μmol/L', 0, 16, 0, 16, 0, 76),
('U-NIT', 'catalog.items.U_NIT', 'urinalysis', '', 0, 0, 0, 0, 0, 77),
('U-LEU', 'catalog.items.U_LEU', 'urinalysis', 'cells/μL', 0, 10, 0, 10, 0, 78),
('U-BLD', 'catalog.items.U_BLD', 'urinalysis', 'cells/μL', 0, 3, 0, 3, 0, 79),
('TSH', 'catalog.items.TSH', 'immunoassay', 'mIU/L', 0.4, 4.0, 0.4, 4.0, 2, 90),
('FT3', 'catalog.items.FT3', 'immunoassay', 'pmol/L', 3.1, 6.8, 3.1, 6.8, 2, 91),
('FT4', 'catalog.items.FT4', 'immunoassay', 'pmol/L', 12, 22, 12, 22, 2, 92),
('T3', 'catalog.items.T3', 'immunoassay', 'nmol/L', 1.3, 3.1, 1.3, 3.1, 2, 93),
('T4', 'catalog.items.T4', 'immunoassay', 'nmol/L', 66, 181, 66, 181, 1, 94),
('CRP', 'catalog.items.CRP', 'immunoassay', 'mg/L', 0, 5, 0, 5, 2, 95),
('PCT', 'catalog.items.PCT', 'immunoassay', 'ng/mL', 0, 0.5, 0, 0.5, 2, 96),
('Ferritin', 'catalog.items.Ferritin', 'immunoassay', 'ng/mL', 30, 400, 13, 150, 1, 97),
('VitB12', 'catalog.items.VitB12', 'immunoassay', 'pg/mL', 200, 900, 200, 900, 0, 98),
('Folate', 'catalog.items.Folate', 'immunoassay', 'ng/mL', 4, 20, 4, 20, 1, 99),
('ALP', 'catalog.items.ALP', 'chemistry', 'U/L', 40, 150, 40, 150, 0, 100),
('GGT', 'catalog.items.GGT', 'chemistry', 'U/L', 10, 60, 7, 35, 0, 101),
('LDH', 'catalog.items.LDH', 'chemistry', 'U/L', 100, 240, 100, 240, 0, 102),
('CK', 'catalog.items.CK', 'chemistry', 'U/L', 38, 174, 26, 140, 0, 103),
('CK-MB', 'catalog.items.CK_MB', 'chemistry', 'U/L', 0, 25, 0, 25, 1, 104),
('DBIL', 'catalog.items.DBIL', 'chemistry', 'μmol/L', 0, 6.8, 0, 6.8, 1, 105),
('IBIL', 'catalog.items.IBIL', 'chemistry', 'μmol/L', 3.4, 17.0, 3.4, 17.0, 1, 106),
('AMY', 'catalog.items.AMY', 'chemistry', 'U/L', 30, 110, 30, 110, 0, 107),
('US', 'catalog.items.US', 'imaging', '', 0, 0, 0, 0, 0, 110),
('XR', 'catalog.items.XR', 'imaging', '', 0, 0, 0, 0, 0, 111),
('ECG', 'catalog.items.ECG', 'monitoring', '', 0, 0, 0, 0, 0, 112),
('HR', 'catalog.items.HR', 'monitoring', 'bpm', 60, 100, 60, 100, 0, 120),
('SpO2', 'catalog.items.SpO2', 'monitoring', '%', 95, 100, 95, 100, 0, 121),
('BP_SYS', 'catalog.items.BP_SYS', 'monitoring', 'mmHg', 90, 140, 90, 140, 0, 122),
('BP_DIA', 'catalog.items.BP_DIA', 'monitoring', 'mmHg', 60, 90, 60, 90, 0, 123),
('RR', 'catalog.items.RR', 'monitoring', 'rpm', 12, 20, 12, 20, 0, 124),
('TEMP', 'catalog.items.TEMP', 'monitoring', '°C', 36.5, 37.5, 36.5, 37.5, 1, 125);
`;

export const SEED_ADDITIONAL_PACKAGES_SQL = `
INSERT OR IGNORE INTO test_packages (code, name, description) VALUES
('ELECTROLYTES', 'packages.ELECTROLYTES.name', 'packages.ELECTROLYTES.description'),
('COAG', 'packages.COAG.name', 'packages.COAG.description'),
('URINE', 'packages.URINE.name', 'packages.URINE.description'),
('THYROID', 'packages.THYROID.name', 'packages.THYROID.description'),
('MYO', 'packages.MYO.name', 'packages.MYO.description'),
('EXT_LFT', 'packages.EXT_LFT.name', 'packages.EXT_LFT.description'),
('DIABETES', 'packages.DIABETES.name', 'packages.DIABETES.description'),
('ANEMIA', 'packages.ANEMIA.name', 'packages.ANEMIA.description'),
('INFECTION', 'packages.INFECTION.name', 'packages.INFECTION.description'),
('PANCREAS', 'packages.PANCREAS.name', 'packages.PANCREAS.description'),
('IMAGING_PKG', 'packages.IMAGING_PKG.name', 'packages.IMAGING_PKG.description'),
('ECG_PKG', 'packages.ECG_PKG.name', 'packages.ECG_PKG.description'),
('VITALS', 'packages.VITALS.name', 'packages.VITALS.description');

-- Electrolytes items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'ELECTROLYTES' AND t.code IN ('Na', 'K', 'Cl', 'Ca', 'PHOS', 'Mg');

-- Coagulation items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'COAG' AND t.code IN ('PT', 'APTT', 'FIB', 'TT', 'INR', 'D-Dimer');

-- Urinalysis items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'URINE' AND t.code IN ('U-pH', 'U-SG', 'U-PRO', 'U-GLU', 'U-KET', 'U-BIL', 'U-UBG', 'U-NIT', 'U-LEU', 'U-BLD');

-- Thyroid items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'THYROID' AND t.code IN ('TSH', 'FT3', 'FT4', 'T3', 'T4');

-- Myocardial Enzymes items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'MYO' AND t.code IN ('CK', 'CK-MB', 'LDH');

-- Extended LFT items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_panels t, test_packages p
WHERE p.code = 'EXT_LFT' AND t.code IN ('ALT', 'AST', 'TBIL', 'DBIL', 'IBIL', 'ALP', 'GGT', 'TP', 'ALB');

-- Diabetes items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'DIABETES' AND t.code IN ('GLU', 'HbA1c');

-- Anemia items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'ANEMIA' AND t.code IN ('Ferritin', 'VitB12', 'Folate');

-- Infection items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'INFECTION' AND t.code IN ('CRP', 'PCT');

-- Pancreas items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'PANCREAS' AND t.code IN ('AMY');

-- Imaging items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'IMAGING_PKG' AND t.code IN ('US', 'XR');

-- ECG items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'ECG_PKG' AND t.code IN ('ECG');

-- Vitals items
INSERT OR IGNORE INTO test_package_items (package_id, panel_id)
SELECT p.id, t.id FROM test_packages p, test_panels t 
WHERE p.code = 'VITALS' AND t.code IN ('HR', 'SpO2', 'BP_SYS', 'BP_DIA', 'RR', 'TEMP');
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
