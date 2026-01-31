export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  quit: () => Promise<void>;
  relaunch: () => Promise<void>;

  // Optional: Listen for database status updates
  onStatusUpdate?: (callback: () => void) => () => void;

  db: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
    run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
    get: <T>(sql: string, params?: unknown[]) => Promise<T | undefined>;
    all: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  };

  worklist: {
    start: (orderId: number) => Promise<{ success: boolean; error?: string }>;
  };

  instrument: {
    listPorts: () => Promise<PortInfo[]>;
    connect: (portPath: string, options: ConnectionOptions) => Promise<boolean>;
    disconnect: (portPath: string, options?: ConnectionOptions) => Promise<void>;
    onData: (callback: (data: InstrumentData) => void) => () => void;
    onStatus: (callback: (status: InstrumentStatus) => void) => () => void;
    simulate: (portPath: string, type?: string) => Promise<boolean>;
  };

  file: {
    selectFolder: () => Promise<string | null>;
    selectFile: (filters?: FileFilter[]) => Promise<string | null>;
    showSaveDialog: (options?: { defaultPath?: string; filters?: FileFilter[] }) => Promise<string | null>;
    saveFile: (defaultPath: string, content: string) => Promise<string | null>;
  };

  backup: {
    create: (targetPath: string) => Promise<boolean>;
    restore: (sourcePath: string) => Promise<boolean>;
    updateSettings: (settings: { enabled: boolean; path: string; interval: string }) => Promise<{ success: boolean; error?: string }>;
  };

  audit: {
    getLogs: (params?: { page?: number; pageSize?: number; filters?: any }) => Promise<{ logs: any[]; total: number; page: number; pageSize: number; totalPages: number }>;
  };

  system: {
    checkInit: () => Promise<{ initialized: boolean }>;
    createFirstAdmin: (data: { username: string; password: string; fullName: string }) => Promise<{ success: boolean; error?: string; id?: number }>;
  };

  license: {
    getMachineId: () => Promise<string>;
    activate: (key: string) => Promise<{ success: boolean; message: string }>;
    getStatus: () => Promise<LicenseStatus>;
  };

  report: {
    printToPDF: (options: { filename?: string }) => Promise<{ success: boolean; path?: string; data?: Buffer; error?: string }>;
    print: () => Promise<{ success: boolean }>;
  };

  driver: {
    getAll: () => Promise<InstrumentDriverConfig[]>;
    get: (id: string) => Promise<InstrumentDriverConfig | undefined>;
  };

  auth: {
    login: (creds: { username: string; password: string }) => Promise<{ success: boolean; user?: any; error?: string }>;
  };

  user: {
    getAll: () => Promise<any[]>;
    create: (data: any) => Promise<{ success: boolean; id?: number; error?: string }>;
    update: (data: any) => Promise<{ success: boolean; error?: string }>;
    toggleActive: (id: number, isActive: boolean) => Promise<{ success: boolean; error?: string }>;
    delete: (id: number) => Promise<{ success: boolean; error?: string }>;
  };
}

export interface InstrumentDriverConfig {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category?: string;
  connection: 'serial' | 'tcp' | 'file';
  protocol: 'astm' | 'hl7' | 'csv' | 'custom';
  serialConfig?: {
    baudRate: 9600 | 19200 | 38400 | 57600 | 115200;
    dataBits: 7 | 8;
    stopBits: 1 | 2;
    parity: 'none' | 'even' | 'odd';
  };
  tcpConfig?: {
    host: string;
    port: number;
    mode: 'client' | 'server';
  };
  testMapping: Record<string, string>;
  description?: string;
}

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface ConnectionOptions {
  connectionType?: 'serial' | 'tcp';
  // Serial
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  // TCP
  host?: string;
  port?: number;
  mode?: 'client' | 'server';

  instrumentId?: number;
}

export interface InstrumentData {
  portPath: string;
  timestamp: string;
  raw: string;
  parsed?: ParsedResult;
}

export interface ParsedResult {
  sampleId: string;
  patientId?: string;
  testResults: TestResult[];
}

export interface TestResult {
  testCode: string;
  value: string | number;
  unit?: string;
  flag?: 'H' | 'L' | 'N' | 'C';
}

export interface InstrumentStatus {
  portPath: string;
  connected: boolean;
  lastActivity?: string;
  error?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface LicenseStatus {
  activated: boolean;
  machineId: string;
  expiresAt?: string;
  licenseType?: 'trial' | 'standard' | 'professional';
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
