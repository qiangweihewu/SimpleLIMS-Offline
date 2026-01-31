/**
 * Instrument Driver Configuration Types
 * Used for dynamic instrument driver loading and configuration
 */

export type ConnectionType = 'serial' | 'tcp' | 'file';
export type Protocol = 'astm' | 'hl7' | 'csv' | 'custom';

export interface SerialConfig {
  baudRate: 9600 | 19200 | 38400 | 57600 | 115200;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl?: boolean;
}

export interface TcpConfig {
  host: string;
  port: number;
  mode: 'client' | 'server';
}

export interface FileConfig {
  watchPath: string;
  filePattern?: string; // glob pattern like "*.csv"
  archivePath?: string;
  deleteAfterProcessing?: boolean;
}

export interface TestMapping {
  [instrumentTestCode: string]: string; // Maps to test_panels.code
}

export interface InstrumentTestMapping {
  id?: number;
  instrument_id: number;
  instrument_code: string;
  panel_id?: number;
  conversion_factor?: number;
}

/**
 * Main driver configuration schema
 */
export interface InstrumentDriverConfig {
  // Basic info
  id: string; // Unique driver ID
  name: string; // Display name
  manufacturer: string;
  model: string;
  category?: 'hematology' | 'chemistry' | 'immuno' | 'coagulation' | 'urinalysis' | 'other';
  
  // Connection settings
  connection: ConnectionType;
  protocol: Protocol;
  
  // Protocol-specific config
  serialConfig?: SerialConfig;
  tcpConfig?: TcpConfig;
  fileConfig?: FileConfig;
  
  // Test code mapping
  testMapping: TestMapping;
  
  // Protocol-specific options
  protocolOptions?: {
    // ASTM specific
    astm?: {
      frameDelimiter?: string;
      recordDelimiter?: string;
      fieldDelimiter?: string;
      repeatDelimiter?: string;
      escapeDelimiter?: string;
      sendAck?: boolean;
    };
    
    // HL7 specific
    hl7?: {
      fieldSeparator?: string;
      componentSeparator?: string;
      repetitionSeparator?: string;
      escapeCharacter?: string;
      subcomponentSeparator?: string;
    };
    
    // CSV specific
    csv?: {
      delimiter?: string;
      hasHeader?: boolean;
      encoding?: string;
      columnMapping?: {
        sampleId?: number | string;
        testCode?: number | string;
        result?: number | string;
        unit?: number | string;
        flag?: number | string;
        timestamp?: number | string;
      };
    };
  };
  
  // Data processing options
  dataOptions?: {
    filterHistogram?: boolean;
    trimWhitespace?: boolean;
    autoMatchSample?: boolean;
    resultTimeout?: number; // seconds
  };
  
  // Metadata
  version?: string;
  description?: string;
  notes?: string;
}

/**
 * Validate driver configuration
 */
export function validateDriverConfig(config: any): config is InstrumentDriverConfig {
  if (!config.id || !config.name || !config.manufacturer || !config.model) {
    return false;
  }
  
  if (!['serial', 'tcp', 'file'].includes(config.connection)) {
    return false;
  }
  
  if (!['astm', 'hl7', 'csv', 'custom'].includes(config.protocol)) {
    return false;
  }
  
  if (config.connection === 'serial' && !config.serialConfig) {
    return false;
  }
  
  if (config.connection === 'tcp' && !config.tcpConfig) {
    return false;
  }
  
  if (config.connection === 'file' && !config.fileConfig) {
    return false;
  }
  
  if (!config.testMapping || typeof config.testMapping !== 'object') {
    return false;
  }
  
  return true;
}
