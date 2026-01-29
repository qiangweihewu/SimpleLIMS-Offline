export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;

  db: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
    run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
    get: <T>(sql: string, params?: unknown[]) => Promise<T | undefined>;
    all: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  };

  instrument: {
    listPorts: () => Promise<PortInfo[]>;
    connect: (portPath: string, options: SerialPortOptions) => Promise<boolean>;
    disconnect: (portPath: string) => Promise<void>;
    onData: (callback: (data: InstrumentData) => void) => void;
    onStatus: (callback: (status: InstrumentStatus) => void) => () => void;
  };

  file: {
    selectFolder: () => Promise<string | null>;
    selectFile: (filters?: FileFilter[]) => Promise<string | null>;
    saveFile: (defaultPath: string, content: string) => Promise<string | null>;
  };

  backup: {
    create: (targetPath: string) => Promise<boolean>;
    restore: (sourcePath: string) => Promise<boolean>;
  };

  license: {
    getMachineId: () => Promise<string>;
    activate: (key: string) => Promise<{ success: boolean; message: string }>;
    getStatus: () => Promise<LicenseStatus>;
  };
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

export interface SerialPortOptions {
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 1.5 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
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
