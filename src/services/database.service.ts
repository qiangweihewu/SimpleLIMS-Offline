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
    return window.electronAPI.db.run(`UPDATE patients SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
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
    return window.electronAPI.db.run(`UPDATE samples SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
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
  // unit is already in Result but might be overridden by join
  ref_range_male_low?: number;
  ref_range_male_high?: number;
  ref_range_female_low?: number;
  ref_range_female_high?: number;
  sample_id: string; // from samples table
  first_name: string;
  last_name: string;
  gender: string;
}

// Result operations
export const resultService = {
  async getPending() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<PendingResult>(`
      SELECT r.*, o.sample_id as order_sample_id, tp.code as test_code, tp.name as test_name, tp.unit,
             tp.ref_range_male_low, tp.ref_range_male_high, tp.ref_range_female_low, tp.ref_range_female_high,
             s.sample_id, p.first_name, p.last_name, p.gender
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
      `UPDATE results SET verified_by = ?, verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [userId, id]
    );
  },

  async release(id: number, userId: number) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE results SET is_released = 1, released_by = ?, released_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [userId, id]
    );
  },

  async updateValue(id: number, value: string, flag: string) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE results SET value = ?, numeric_value = ?, flag = ?, source = 'manual', updated_at = datetime('now') WHERE id = ?`,
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
      `UPDATE instruments SET is_connected = ?, last_activity = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [connected ? 1 : 0, id]
    );
  },
};

// Unmatched data operations
export const unmatchedDataService = {
  async getPending() {
    if (!isElectron) return [];
    return window.electronAPI.db.all<UnmatchedData>(`SELECT * FROM unmatched_data WHERE status = 'pending' ORDER BY received_at DESC`);
  },

  async claim(id: number, sampleId: number, userId: number) {
    if (!isElectron) return { changes: 0, lastInsertRowid: 0 };
    return window.electronAPI.db.run(
      `UPDATE unmatched_data SET status = 'claimed', claimed_sample_id = ?, claimed_by = ?, claimed_at = datetime('now') WHERE id = ?`,
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
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
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
    const todaySamples = await window.electronAPI.db.get<{count: number}>(
      `SELECT COUNT(*) as count FROM samples WHERE date(created_at) = ?`, [today]
    );
    
    const pendingSamples = await window.electronAPI.db.get<{count: number}>(
      `SELECT COUNT(*) as count FROM samples WHERE status = 'registered' OR status = 'in_progress'`
    );
    
    const completedSamples = await window.electronAPI.db.get<{count: number}>(
      `SELECT COUNT(*) as count FROM samples WHERE status = 'completed'`
    );
    
    const abnormalResults = await window.electronAPI.db.get<{count: number}>(
      `SELECT COUNT(*) as count FROM results WHERE flag IS NOT NULL AND flag != 'N' AND date(created_at) = ?`, [today]
    );
    
    const recentSamples = await window.electronAPI.db.all<{
      id: number;
      sample_id: string;
      patient_name: string;
      tests: string;
      status: string;
      time: string;
    }>(`
      SELECT s.id, s.sample_id, p.last_name || p.first_name as patient_name, 
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
  name_en?: string;
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

export interface Instrument {
  id: number;
  name: string;
  model: string;
  manufacturer?: string;
  connection_type: 'serial' | 'tcp' | 'file';
  protocol: 'astm' | 'hl7' | 'csv' | 'custom';
  port_path?: string;
  baud_rate?: number;
  is_active: boolean;
  is_connected: boolean;
  last_activity?: string;
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
