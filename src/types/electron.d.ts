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

  video: {
    listDevices: () => Promise<VideoDevice[]>;
    startPreview: (config: CaptureConfig) => Promise<string>;
    stopPreview: (devicePath: string) => Promise<void>;
    capture: (config: CaptureConfig, patientId?: string) => Promise<CapturedImage>;
    startRecording: (config: CaptureConfig, patientId?: string, duration?: number) => Promise<RecordingSession>;
    stopRecording: (sessionId: string) => Promise<string>;
    saveWebRecording: (buffer: ArrayBuffer, patientId: string, format?: string) => Promise<CapturedImage>;
    getCaptures: (patientId?: string) => Promise<CapturedImage[]>;
  };

  dicom: {
    wrap: (imagePath: string, patient: DicomPatient, study: DicomStudy) => Promise<string>;
    list: (patientId?: string) => Promise<DicomFile[]>;
  };

  orthanc: {
    test: () => Promise<{ success: boolean; error?: string }>;
    upload: (filePath: string) => Promise<{ success: boolean; instanceId?: string; error?: string }>;
    search: (query: any) => Promise<any[]>;
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
    getLogs: (currentUserRole: string, params?: { page?: number; pageSize?: number; filters?: any }) => Promise<{
      logs: any[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>;
  };

  system: {
    checkInit: () => Promise<{ initialized: boolean }>;
    createFirstAdmin: (data: { username: string; password: string; fullName: string }) => Promise<{ success: boolean; error?: string; id?: number }>;
  };

  license: {
    getMachineId: () => Promise<string>;
    getMachineIdFormatted: () => Promise<string>;
    activate: (key: string) => Promise<{ success: boolean; message: string; payload?: any }>;
    activateFromFile: (filePath: string) => Promise<{ success: boolean; message: string; payload?: any }>;
    getStatus: () => Promise<LicenseStatus>;
    canRun: () => Promise<{ allowed: boolean; reason: string; requiresActivation: boolean }>;
    getActivationUrl: () => Promise<string>;
    hasFeature: (feature: number) => Promise<boolean>;
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
    getAll: (currentUserRole: string) => Promise<any[]>;
    create: (currentUserRole: string, userData: any) => Promise<{ success: boolean; id?: number; error?: string }>;
    update: (currentUserRole: string, userData: any) => Promise<{ success: boolean; error?: string }>;
    toggleActive: (currentUserRole: string, id: number, isActive: boolean) => Promise<{ success: boolean; error?: string }>;
    delete: (currentUserRole: string, id: number) => Promise<{ success: boolean; error?: string }>;
  };

  debug: {
    testProtocol: (testPath?: string) => Promise<{
      success: boolean;
      testPath?: string;
      exists?: boolean;
      protocolUrl?: string;
      error?: string;
    }>;
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

export interface VideoDevice {
  id: string;
  name: string;
  path: string;
  type: 'camera' | 'capture_card' | 'virtual';
  capabilities?: {
    resolutions?: string[];
    formats?: string[];
  };
}

export interface CaptureConfig {
  devicePath: string;
  resolution?: string;
  format?: string;
  quality?: number;
}

export interface CapturedImage {
  id: string;
  path: string;
  patientId?: string;
  instrumentId?: number;
  capturedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RecordingSession {
  id: string;
  devicePath: string;
  outputPath: string;
  startedAt: Date;
  status: 'recording' | 'stopped' | 'error';
}

export interface DicomPatient {
  patientId: string;
  name: string;
}

export interface DicomStudy {
  modality: string;
  studyDescription?: string;
}

export interface DicomFile {
  id: string;
  path: string;
  sopInstanceUid: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  modality: string;
  patientId?: string;
  patientName?: string;
  studyDate?: string;
  studyDescription?: string;
  createdAt: string;
}

export interface LicenseStatus {
  activated: boolean;
  machineId: string;
  machineIdFormatted: string;
  activatedAt?: string;
  licenseType: 'trial' | 'professional' | 'enterprise';
  expiresAt?: string;
  trialDaysRemaining: number;
  isTrialExpired: boolean;
  isLicenseExpired: boolean;
  firstRunAt: string;
  features: number; // Bitmask
  integrityValid: boolean;
  timeIntegrityValid: boolean;
}

// License feature bitmask values
export enum LicenseFeature {
  BASIC_TESTING = 1 << 0,
  PATIENT_MANAGEMENT = 1 << 1,
  INSTRUMENT_CONNECT = 1 << 2,
  REPORT_GENERATION = 1 << 3,
  IMAGE_CAPTURE = 1 << 4,
  CLOUD_SYNC = 1 << 5,
  ADVANCED_REPORTS = 1 << 6,
  AUDIT_LOG = 1 << 7,
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
