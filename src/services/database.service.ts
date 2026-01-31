// Database service - interfaces with Electron IPC for SQLite operations

const isElectron = typeof window !== 'undefined' && window.electronAPI;

// Patient operations
export const patientService = {
  async getAll() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<Patient>('SELECT * FROM patients ORDER BY created_at DESC');
  },

  async getById(id: number) {
    if (!isElectron) return undefined;
    return window.electronAPI.db.get<Patient>('SELECT * FROM patients WHERE id = ?', [id]);
  },

  async search(term: string) {
    if (!isElectron) return [];
    return window.electronAPI.db.all<Patient>(
      `SELECT * FROM patients WHERE patient_id LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?`,
      [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
    );
  },

  async create(data: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO patients (patient_id, first_name, last_name, gender, date_of_birth, phone, email, address, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.patient_id, data.first_name, data.last_name, data.gender, data.date_of_birth, data.phone, data.email, data.address, data.notes]
    );
  },

  async update(id: number, data: Partial<Patient>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
    const values = Object.keys(data).filter(k => k !== 'id').map(k => data[k as keyof Patient]);
    return window.electronAPI.db.run(`UPDATE patients SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);
  },

  async checkIdExists(patientId: string): Promise<boolean> {
    if (!isElectron) return false;
    const result = await window.electronAPI.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM patients WHERE patient_id = ?',
      [patientId]
    );
    return (result?.count ?? 0) > 0;
  },
};

// Sample operations
export const sampleService = {
  async getAll() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<Sample & { first_name: string; last_name: string; patient_code: string; tests?: string }>(`
      SELECT s.*, p.first_name, p.last_name, p.patient_id as patient_code,
             (SELECT GROUP_CONCAT(tp.code, ', ') FROM orders o JOIN test_panels tp ON o.panel_id = tp.id WHERE o.sample_id = s.id) as tests
      FROM samples s 
      JOIN patients p ON s.patient_id = p.id
      ORDER BY s.created_at DESC
    `);
  },

  async getById(id: number) {
    if (!isElectron) return undefined;
    return window.electronAPI.db.get<Sample>('SELECT * FROM samples WHERE id = ?', [id]);
  },

  async getBySampleId(sampleId: string) {
    if (!isElectron) return undefined;
    return window.electronAPI.db.get<Sample>('SELECT * FROM samples WHERE sample_id = ?', [sampleId]);
  },

  async create(data: { patient_id: number; sample_id: string; sample_type: string; priority: string; collected_by?: number }) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO samples (patient_id, sample_id, sample_type, priority, collected_by, status) VALUES (?, ?, ?, ?, ?, 'registered')`,
      [data.patient_id, data.sample_id, data.sample_type, data.priority, data.collected_by]
    );
  },

  async updateStatus(id: number, status: string) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(`UPDATE samples SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
  },

  async checkIdExists(sampleId: string): Promise<boolean> {
    if (!isElectron) return false;
    const result = await window.electronAPI.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM samples WHERE sample_id = ?',
      [sampleId]
    );
    return (result?.count ?? 0) > 0;
  },

  async getByPatientId(patientId: number) {
    if (!isElectron) return [];
    return window.electronAPI.db.all<Sample & { tests?: string }>(`
      SELECT s.*,
             (SELECT GROUP_CONCAT(tp.code, ', ') FROM orders o JOIN test_panels tp ON o.panel_id = tp.id WHERE o.sample_id = s.id) as tests
      FROM samples s 
      WHERE s.patient_id = ?
      ORDER BY s.created_at DESC
    `, [patientId]);
  },
};

// Order operations
export const orderService = {
  async createOrders(sampleId: number, panelIds: number[], orderedBy?: number) {
    if (!isElectron) return [];
    const results = [];
    for (const panelId of panelIds) {
      const result = await window.electronAPI.db.run(
        `INSERT INTO orders (sample_id, panel_id, ordered_by, status) VALUES (?, ?, ?, 'pending')`,
        [sampleId, panelId, orderedBy]
      );
      results.push(result);
    }
    return results;
  },

  async getBySampleId(sampleId: number) {
    if (!isElectron) return [];
    return window.electronAPI.db.all<Order>(`
      SELECT o.*, tp.code, tp.name as test_name 
      FROM orders o JOIN test_panels tp ON o.panel_id = tp.id 
      WHERE o.sample_id = ?
    `, [sampleId]);
  },
};

export interface PendingResult extends Result {
  order_sample_id: number;
  test_code: string;
  test_name: string;
  test_name_en?: string;
  // unit is already in Result but might be overridden by join
  ref_range_male_low?: number;
  ref_range_male_high?: number;
  ref_range_female_low?: number;
  ref_range_female_high?: number;
  ref_range_child_low?: number;
  ref_range_child_high?: number;
  sample_id: string; // from samples table
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  patient_id: number; // for delta check lookups
  panel_id: number; // for delta check lookups
}

// Result operations
export const resultService = {
  async getPending() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<PendingResult>(`
      SELECT r.*, o.sample_id as order_sample_id, tp.code as test_code, tp.name as test_name, tp.unit,
             tp.ref_range_male_low, tp.ref_range_male_high, tp.ref_range_female_low, tp.ref_range_female_high,
             tp.ref_range_child_low, tp.ref_range_child_high,
             s.sample_id, p.first_name, p.last_name, p.gender, p.date_of_birth,
             s.patient_id, o.panel_id
      FROM results r
      JOIN orders o ON r.order_id = o.id
      JOIN test_panels tp ON o.panel_id = tp.id
      JOIN samples s ON o.sample_id = s.id
      JOIN patients p ON s.patient_id = p.id
      WHERE r.is_released = 0
      ORDER BY r.created_at DESC
    `);
  },

  async verify(id: number, userId: number) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE results SET verified_by = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, id]
    );
  },

  async release(id: number, userId: number) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE results SET is_released = 1, released_by = ?, released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, id]
    );
  },

  async updateValue(id: number, value: string, flag: string) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE results SET value = ?, numeric_value = ?, flag = ?, source = 'manual', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [value, parseFloat(value) || null, flag, id]
    );
  },
};

// Test Panel operations
export const testPanelService = {
  async getAll() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<TestPanel>('SELECT * FROM test_panels WHERE is_active = 1 ORDER BY sort_order, name');
  },

  async getById(id: number) {
    if (!isElectron) return undefined;
    return window.electronAPI.db.get<TestPanel>('SELECT * FROM test_panels WHERE id = ?', [id]);
  },

  async create(data: Omit<TestPanel, 'id' | 'is_active'>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO test_panels (code, name, category, unit, ref_range_male_low, ref_range_male_high, ref_range_female_low, ref_range_female_high, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [data.code, data.name, data.category, data.unit, data.ref_range_male_low, data.ref_range_male_high, data.ref_range_female_low, data.ref_range_female_high, data.sort_order || 0]
    );
  },

  async update(id: number, data: Partial<TestPanel>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
    const values = Object.keys(data).filter(k => k !== 'id').map(k => data[k as keyof TestPanel]);
    return window.electronAPI.db.run(`UPDATE test_panels SET ${fields} WHERE id = ?`, [...values, id]);
  },

  async toggleActive(id: number, isActive: boolean) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(`UPDATE test_panels SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
  }
};

// Instrument operations
export const instrumentService = {
  async getAll() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<Instrument>('SELECT * FROM instruments ORDER BY name');
  },

  async updateConnectionStatus(id: number, connected: boolean) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE instruments SET is_connected = ?, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [connected ? 1 : 0, id]
    );
  },

  async create(data: Omit<Instrument, 'id' | 'is_active' | 'is_connected' | 'last_activity'>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO instruments (
        name, model, manufacturer, connection_type, protocol, 
        port_path, baud_rate, data_bits, stop_bits, parity,
        host, port, tcp_mode,
        watch_folder, file_pattern, csv_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name, data.model, data.manufacturer, data.connection_type, data.protocol,
        data.port_path, data.baud_rate, data.data_bits, data.stop_bits, data.parity,
        data.host, data.port, data.tcp_mode,
        data.watch_folder, data.file_pattern, data.csv_config
      ]
    );
  },

  async update(id: number, data: Partial<Instrument>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    const validFields = [
      'name', 'model', 'manufacturer', 'connection_type', 'protocol',
      'port_path', 'baud_rate', 'data_bits', 'stop_bits', 'parity',
      'host', 'port', 'tcp_mode', 'watch_folder', 'file_pattern', 'csv_config', 'is_active'
    ];
    const fields = Object.keys(data)
      .filter(k => validFields.includes(k))
      .map(k => `${k} = ?`)
      .join(', ');

    if (!fields) return { changes: 0 };

    const values = Object.keys(data)
      .filter(k => validFields.includes(k))
      .map(k => data[k as keyof Instrument]);

    return window.electronAPI.db.run(`UPDATE instruments SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);
  },

  async delete(id: number) {
    if (!isElectron) return { changes: 0 };
    return window.electronAPI.db.run('DELETE FROM instruments WHERE id = ?', [id]);
  },

  async getTestMappings(instrumentId: number) {
    if (!isElectron) return [];
    return window.electronAPI.db.all<InstrumentTestMapping & { panel_name: string; panel_name_en?: string; panel_code: string }>(`
      SELECT m.*, tp.name as panel_name, tp.name_en as panel_name_en, tp.code as panel_code
      FROM instrument_test_mappings m
      JOIN test_panels tp ON m.panel_id = tp.id
      WHERE m.instrument_id = ?
      ORDER BY m.instrument_code
    `, [instrumentId]);
  },

  async createTestMapping(data: Omit<InstrumentTestMapping, 'id'>) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO instrument_test_mappings (instrument_id, instrument_code, panel_id, conversion_factor) VALUES (?, ?, ?, ?)`,
      [data.instrument_id, data.instrument_code, data.panel_id, data.conversion_factor || 1.0]
    );
  },

  async deleteTestMapping(id: number) {
    if (!isElectron) return { changes: 0 };
    return window.electronAPI.db.run('DELETE FROM instrument_test_mappings WHERE id = ?', [id]);
  }
};

// Unmatched data operations
export const unmatchedDataService = {
  async getPending(page: number = 1, pageSize: number = 50) {
    if (!isElectron) return { data: [], total: 0 };

    const offset = (page - 1) * pageSize;
    const countRes = await window.electronAPI.db.get<{ count: number }>(`SELECT COUNT(*) as count FROM unmatched_data WHERE status = 'pending'`);
    const data = await window.electronAPI.db.all<UnmatchedData>(
      `SELECT * FROM unmatched_data WHERE status = 'pending' ORDER BY received_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    return {
      data,
      total: countRes?.count || 0
    };
  },

  async claim(id: number, sampleId: number, userId: number) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE unmatched_data SET status = 'claimed', claimed_sample_id = ?, claimed_by = ?, claimed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [sampleId, userId, id]
    );
  },

  async discard(id: number, reason: string) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE unmatched_data SET status = 'discarded', discard_reason = ? WHERE id = ?`,
      [reason, id]
    );
  },
};

// Settings operations
export const settingsService = {
  async getAll() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<{ key: string; value: string }>('SELECT * FROM settings');
  },

  async get(key: string) {
    if (!isElectron) return undefined;
    const result = await window.electronAPI.db.get<{ key: string; value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return result?.value;
  },

  async set(key: string, value: string) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    // Use INSERT OR REPLACE
    return window.electronAPI.db.run(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, value]
    );
  },
};

// Dashboard operations
export const dashboardService = {
  async getStats() {
    if (!isElectron) return {
      todaySamples: 0,
      pendingSamples: 0,
      completedSamples: 0,
      abnormalResults: 0,
      recentSamples: []
    };

    // This would be better as a single complex query or multiple parallel queries
    // For now, we'll do multiple IPC calls which is acceptable for local IPC

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todaySamples = await window.electronAPI.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM samples WHERE date(created_at) = ?`, [today]
    );

    const pendingSamples = await window.electronAPI.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM samples WHERE status = 'registered' OR status = 'in_progress'`
    );

    const completedSamples = await window.electronAPI.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM samples WHERE status = 'completed'`
    );

    const abnormalResults = await window.electronAPI.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM results WHERE flag IS NOT NULL AND flag != 'N' AND date(created_at) = ?`, [today]
    );

    const recentSamples = await window.electronAPI.db.all<{
      id: number;
      sample_id: string;
      first_name: string;
      last_name: string;
      tests: string;
      status: string;
      time: string;
    }>(`
      SELECT s.id, s.sample_id, p.first_name, p.last_name, 
             s.status, time(s.created_at) as time,
             (SELECT GROUP_CONCAT(tp.code, ', ') FROM orders o JOIN test_panels tp ON o.panel_id = tp.id WHERE o.sample_id = s.id) as tests
      FROM samples s
      JOIN patients p ON s.patient_id = p.id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);

    return {
      todaySamples: todaySamples?.count || 0,
      pendingSamples: pendingSamples?.count || 0,
      completedSamples: completedSamples?.count || 0,
      abnormalResults: abnormalResults?.count || 0,
      recentSamples: recentSamples || []
    };
  }
};

interface TestPackageRaw {
  id: number;
  code: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  price?: number;
  is_active: number;
  created_at: string;
  panel_ids: string | null;
  panel_codes: string | null;
  panel_names: string | null;
}

// Test Package operations
export const testPackageService = {
  async getAll() {
    if (!isElectron) return [];
    const packages = await window.electronAPI.db.all<TestPackageRaw>(`
      SELECT tp.*, 
             GROUP_CONCAT(tpi.panel_id) as panel_ids,
             GROUP_CONCAT(panels.code) as panel_codes,
             GROUP_CONCAT(panels.name) as panel_names
      FROM test_packages tp
      LEFT JOIN test_package_items tpi ON tp.id = tpi.package_id
      LEFT JOIN test_panels panels ON tpi.panel_id = panels.id
      WHERE tp.is_active = 1
      GROUP BY tp.id
      ORDER BY tp.name
    `);
    return packages.map(pkg => ({
      ...pkg,
      is_active: pkg.is_active === 1,
      panel_ids: pkg.panel_ids ? pkg.panel_ids.split(',').map(Number) : [],
      panel_codes: pkg.panel_codes ? pkg.panel_codes.split(',') : [],
      panel_names: pkg.panel_names ? pkg.panel_names.split(',') : [],
    }));
  },

  async create(data: { code: string; name: string; description?: string; price?: number }) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO test_packages (code, name, description, price, is_active) VALUES (?, ?, ?, ?, 1)`,
      [data.code, data.name, data.description, data.price]
    );
  },

  async addItems(packageId: number, panelIds: number[]) {
    if (!isElectron) return [];
    const results = [];
    for (const panelId of panelIds) {
      const result = await window.electronAPI.db.run(
        `INSERT OR IGNORE INTO test_package_items (package_id, panel_id) VALUES (?, ?)`,
        [packageId, panelId]
      );
      results.push(result);
    }
    return results;
  },
};

// Worklist operations
export const worklistService = {
  async getPendingItems() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<WorklistItem>(`
      SELECT 
        o.id as order_id,
        o.status as order_status,
        s.id as sample_db_id,
        s.sample_id,
        s.priority,
        p.first_name,
        p.last_name,
        tp.code as test_code,
        tp.name as test_name,
        tp.name_en as test_name_en,
        tp.category,
        s.created_at,
        s.status as sample_status
      FROM orders o
      JOIN samples s ON o.sample_id = s.id
      JOIN patients p ON s.patient_id = p.id
      JOIN test_panels tp ON o.panel_id = tp.id
      WHERE o.status IN ('pending', 'processing')
      ORDER BY 
        CASE s.priority 
          WHEN 'stat' THEN 1 
          WHEN 'urgent' THEN 2 
          ELSE 3 
        END,
        s.created_at ASC
    `);
  },

  async updateStatus(orderIds: number[], status: 'pending' | 'processing' | 'completed' | 'cancelled') {
    if (!isElectron) return { changes: 0 };
    let totalChanges = 0;

    for (const id of orderIds) {
      if (status === 'processing') {
        // Use the dedicated atomic IPC handler for starting work
        const res = await window.electronAPI.worklist.start(id);
        if (res.success) totalChanges++;
      } else {
        // Fallback for other status updates
        const res = await window.electronAPI.db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id]);
        totalChanges += res.changes;
      }
    }
    return { changes: totalChanges };
  }
};

// Types
export interface Patient {
  id: number;
  patient_id: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Sample {
  id: number;
  sample_id: string;
  patient_id: number;
  sample_type: string;
  collected_at: string;
  collected_by?: number;
  status: 'registered' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'normal' | 'urgent' | 'stat';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  sample_id: number;
  panel_id: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  ordered_at: string;
  ordered_by?: number;
  completed_at?: string;
}

export interface Result {
  id: number;
  order_id: number;
  value?: string;
  numeric_value?: number;
  unit?: string;
  flag?: 'N' | 'H' | 'L' | 'HH' | 'LL' | 'C';
  reference_range?: string;
  instrument_id?: number;
  raw_data?: string;
  source: 'manual' | 'instrument' | 'calculated';
  verified_by?: number;
  verified_at?: string;
  is_released: boolean;
  released_at?: string;
  released_by?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TestPanel {
  id: number;
  code: string;
  name: string;
  category: string;
  unit?: string;
  ref_range_male_low?: number;
  ref_range_male_high?: number;
  ref_range_female_low?: number;
  ref_range_female_high?: number;
  panic_low?: number;
  panic_high?: number;
  decimal_places: number;
  is_active: boolean;
  sort_order: number;
}

export interface CSVConfig {
  delimiter?: string;
  hasHeader?: boolean;
  sampleIdColumn?: number | string;
  patientIdColumn?: number | string;
  testCodeColumn?: number | string;
  valueColumn?: number | string;
  unitColumn?: number | string;
  flagColumn?: number | string;
  skipRows?: number;
}

export interface Instrument {
  id: number;
  name: string;
  model: string;
  manufacturer?: string;
  connection_type: 'serial' | 'tcp' | 'file';
  protocol: 'astm' | 'hl7' | 'csv' | 'custom';
  // Serial
  port_path?: string;
  baud_rate?: number;
  data_bits?: number;
  stop_bits?: number;
  parity?: string;
  // TCP
  host?: string;
  port?: number;
  tcp_mode?: 'client' | 'server';
  // File
  watch_folder?: string;
  file_pattern?: string;
  // CSV config
  csv_config?: string;

  is_active: boolean;
  is_connected: boolean;
  last_activity?: string;
}

export interface InstrumentTestMapping {
  id: number;
  instrument_id: number;
  instrument_code: string;
  panel_id: number;
  conversion_factor: number;
  notes?: string;
}

export interface UnmatchedData {
  id: number;
  instrument_id?: number;
  sample_id_raw?: string;
  patient_id_raw?: string;
  raw_data: string;
  parsed_data?: string;
  status: 'pending' | 'claimed' | 'discarded';
  claimed_sample_id?: number;
  claimed_by?: number;
  claimed_at?: string;
  discard_reason?: string;
  received_at: string;
}

export interface TestPackage {
  id: number;
  code: string;
  name: string;
  description?: string;
  price?: number;
  is_active: boolean;
  created_at: string;
  panel_ids: number[];
  panel_codes: string[];
  panel_names: string[];
}

export interface WorklistItem {
  order_id: number;
  order_status: string;
  sample_db_id: number;
  sample_id: string;
  priority: 'normal' | 'urgent' | 'stat';
  first_name: string;
  last_name: string;
  test_code: string;
  test_name: string;
  test_name_en?: string;
  category: string;
  created_at: string;
  sample_status: string;
}

export interface ReportResultItem {
  id: number;
  test_code: string;
  test_name: string;
  value: string;
  numeric_value?: number;
  unit?: string;
  flag?: 'N' | 'H' | 'L' | 'HH' | 'LL' | 'C';
  ref_range_low?: number;
  ref_range_high?: number;
  category: string;
  verified_at?: string;
  released_at?: string;
}

export interface ReportData {
  sample: Sample & {
    first_name: string;
    last_name: string;
    patient_code: string;
    gender: 'male' | 'female' | 'other';
    date_of_birth: string;
  };
  results: ReportResultItem[];
  labSettings: {
    lab_name: string;
    lab_address: string;
    lab_phone: string;
    lab_email: string;
    report_footer?: string;
    report_footer_en?: string;
  };
}

// Report operations
// Delta Check - Historical data for patient test results
export const deltaCheckService = {
  async getPatientTestHistory(patientId: number, testPanelId: number, limitDays: number = 14) {
    if (!isElectron) return [];
    return window.electronAPI.db.all<{
      id: number;
      value: string;
      numeric_value: number | null;
      created_at: string;
      flag: string | null;
    }>(`
      SELECT r.id, r.value, r.numeric_value, r.created_at, r.flag
      FROM results r
      JOIN orders o ON r.order_id = o.id
      JOIN samples s ON o.sample_id = s.id
      WHERE s.patient_id = ? AND o.panel_id = ? 
      AND datetime(r.created_at) > datetime('now', '-' || ? || ' days')
      AND r.numeric_value IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [patientId, testPanelId, limitDays]);
  }
};

export const reportService = {
  async getReportData(sampleId: number): Promise<ReportData | null> {
    if (!isElectron) return null;

    // Fetch sample with patient info
    const sample = await window.electronAPI.db.get<Sample & {
      first_name: string;
      last_name: string;
      patient_code: string;
      gender: 'male' | 'female' | 'other';
      date_of_birth: string;
    }>(`
      SELECT s.*, p.first_name, p.last_name, p.patient_id as patient_code, p.gender, p.date_of_birth
      FROM samples s
      JOIN patients p ON s.patient_id = p.id
      WHERE s.id = ?
    `, [sampleId]);

    if (!sample) return null;

    // Fetch all results for this sample with test panel info
    const results = await window.electronAPI.db.all<ReportResultItem>(`
      SELECT r.id, tp.code as test_code, tp.name as test_name,
             r.value, r.numeric_value, tp.unit, r.flag, tp.category,
             r.verified_at, r.released_at,
             CASE
               WHEN '${sample.gender}' = 'male' THEN tp.ref_range_male_low
               WHEN '${sample.gender}' = 'female' THEN tp.ref_range_female_low
               ELSE tp.ref_range_male_low
             END as ref_range_low,
             CASE
               WHEN '${sample.gender}' = 'male' THEN tp.ref_range_male_high
               WHEN '${sample.gender}' = 'female' THEN tp.ref_range_female_high
               ELSE tp.ref_range_male_high
             END as ref_range_high
      FROM results r
      JOIN orders o ON r.order_id = o.id
      JOIN test_panels tp ON o.panel_id = tp.id
      WHERE o.sample_id = ?
      ORDER BY tp.sort_order, tp.name
    `, [sampleId]);

    // Fetch lab settings
    const settingsRows = await window.electronAPI.db.all<{ key: string; value: string }>(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?)',
      ['lab_name', 'lab_address', 'lab_phone', 'lab_email', 'report_footer']
    );
    const settingsMap = settingsRows.reduce((acc: Record<string, string>, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    return {
      sample,
      results,
      labSettings: {
        lab_name: settingsMap.lab_name || 'SimpleLIMS Laboratory',
        lab_address: settingsMap.lab_address || '',
        lab_phone: settingsMap.lab_phone || '',
        lab_email: settingsMap.lab_email || '',
        report_footer: settingsMap.report_footer
      }
    };
  }
};

// QC Operations
export interface QCMaterial {
  id: number;
  name: string;
  lot_number: string;
  manufacturer?: string;
  panel_id: number;
  target_value: number;
  sd: number;
  expiry_date?: string;
  is_active: number;
}

export interface QCResultRecord {
  id: number;
  material_id: number;
  instrument_id?: number;
  value: number;
  westgard_status?: string;
  is_accepted: number;
  performed_by?: number;
  performed_at: string;
  notes?: string;
}

export const qcService = {
  // Get all active QC materials
  async getMaterials() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<QCMaterial>(
      'SELECT * FROM qc_materials WHERE is_active = 1 ORDER BY name'
    );
  },

  // Get QC results for a material and instrument (last N days)
  async getResults(materialId: number, instrumentId?: number, limitDays: number = 30) {
    if (!isElectron) return [];
    const sql = instrumentId
      ? `SELECT * FROM qc_results 
         WHERE material_id = ? AND instrument_id = ?
         AND datetime(performed_at) > datetime('now', '-' || ? || ' days')
         ORDER BY performed_at DESC`
      : `SELECT * FROM qc_results 
         WHERE material_id = ?
         AND datetime(performed_at) > datetime('now', '-' || ? || ' days')
         ORDER BY performed_at DESC`;
    
    const params = instrumentId ? [materialId, instrumentId, limitDays] : [materialId, limitDays];
    return window.electronAPI.db.all<QCResultRecord>(sql, params);
  },

  // Record a QC result
  async recordQC(
    materialId: number,
    value: number,
    westgardStatus: string,
    instrumentId?: number,
    performedBy?: number,
    notes?: string
  ) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `INSERT INTO qc_results (material_id, instrument_id, value, westgard_status, performed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [materialId, instrumentId || null, value, westgardStatus, performedBy || null, notes || null]
    );
  },

  // Check if an instrument passed QC today
  async getInstrumentQCStatus(instrumentId: number): Promise<{
    passedToday: boolean;
    lastResult?: QCResultRecord;
    message: string;
  }> {
    if (!isElectron) return { passedToday: false, message: 'Not available' };
    
    const result = await window.electronAPI.db.get<QCResultRecord>(
      `SELECT * FROM qc_results 
       WHERE instrument_id = ? AND date(performed_at) = date('now')
       ORDER BY performed_at DESC LIMIT 1`,
      [instrumentId]
    );

    if (!result) {
      return { passedToday: false, message: 'No QC performed today' };
    }

    const passedToday = result.westgard_status === 'pass' && result.is_accepted === 1;
    return {
      passedToday,
      lastResult: result,
      message: passedToday ? 'QC passed' : `QC warning: ${result.westgard_status}`
    };
  },

  // Lock all results from an instrument until QC passes
  async lockInstrumentResults(instrumentId: number) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    // Mark results as requiring re-verification
    return window.electronAPI.db.run(
      `UPDATE results SET verified_by = NULL, verified_at = NULL
       WHERE instrument_id = ? AND is_released = 0`,
      [instrumentId]
    );
  }
};
