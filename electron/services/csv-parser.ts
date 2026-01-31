/**
 * CSV/Text File Parser for Instrument Data
 * Supports custom column mapping and various CSV formats
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CSVParserConfig {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: 'utf8' | 'utf16le' | 'ascii' | 'latin1';
  skipEmptyLines?: boolean;
  trimWhitespace?: boolean;
  columnMapping: {
    sampleId?: number | string; // Column index or header name
    testCode?: number | string;
    result?: number | string;
    unit?: number | string;
    flag?: number | string;
    timestamp?: number | string;
    patientId?: number | string;
  };
}

export interface CSVResultRecord {
  sampleId?: string;
  patientId?: string;
  testCode: string;
  result: string;
  unit?: string;
  flag?: string;
  timestamp?: string;
  raw: string; // Original line
}

export class CSVParser {
  private config: CSVParserConfig;

  constructor(config: CSVParserConfig) {
    this.config = {
      delimiter: config.delimiter || ',',
      hasHeader: config.hasHeader ?? true,
      encoding: config.encoding || 'utf8',
      skipEmptyLines: config.skipEmptyLines ?? true,
      trimWhitespace: config.trimWhitespace ?? true,
      columnMapping: config.columnMapping,
    };
  }

  /**
   * Parse CSV file
   */
  parseFile(filePath: string): CSVResultRecord[] {
    try {
      const content = fs.readFileSync(filePath, this.config.encoding!);
      return this.parseContent(content);
    } catch (err) {
      console.error(`[CSV Parser] Error reading file ${filePath}:`, err);
      throw err;
    }
  }

  /**
   * Parse CSV content string
   */
  parseContent(content: string): CSVResultRecord[] {
    const lines = content.split(/\r?\n/);
    const results: CSVResultRecord[] = [];
    
    let headerRow: string[] = [];
    let dataStartIndex = 0;

    // Parse header if present
    if (this.config.hasHeader && lines.length > 0) {
      headerRow = this.parseLine(lines[0]);
      dataStartIndex = 1;
    }

    // Parse data rows
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines
      if (this.config.skipEmptyLines && !line.trim()) {
        continue;
      }

      try {
        const record = this.parseLine(line);
        const result = this.mapRecord(record, headerRow);
        
        if (result) {
          results.push(result);
        }
      } catch (err) {
        console.error(`[CSV Parser] Error parsing line ${i + 1}: ${line}`, err);
      }
    }

    console.log(`[CSV Parser] Parsed ${results.length} record(s) from CSV`);
    return results;
  }

  /**
   * Parse a single CSV line
   */
  private parseLine(line: string): string[] {
    const delimiter = this.config.delimiter!;
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        fields.push(this.config.trimWhitespace ? currentField.trim() : currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add last field
    fields.push(this.config.trimWhitespace ? currentField.trim() : currentField);

    return fields;
  }

  /**
   * Map parsed record to CSVResultRecord using column mapping
   */
  private mapRecord(fields: string[], headerRow: string[]): CSVResultRecord | null {
    const mapping = this.config.columnMapping;
    const raw = fields.join(this.config.delimiter!);

    const getValue = (key: number | string | undefined): string | undefined => {
      if (key === undefined) return undefined;

      if (typeof key === 'number') {
        // Direct column index
        return fields[key];
      } else {
        // Header name lookup
        const index = headerRow.findIndex(h => 
          h.toLowerCase() === key.toLowerCase()
        );
        return index >= 0 ? fields[index] : undefined;
      }
    };

    const testCode = getValue(mapping.testCode);
    const result = getValue(mapping.result);

    // TestCode and Result are required
    if (!testCode || !result) {
      return null;
    }

    return {
      sampleId: getValue(mapping.sampleId),
      patientId: getValue(mapping.patientId),
      testCode,
      result,
      unit: getValue(mapping.unit),
      flag: getValue(mapping.flag),
      timestamp: getValue(mapping.timestamp),
      raw,
    };
  }

  /**
   * Move processed file to archive
   */
  static archiveFile(sourcePath: string, archivePath: string): void {
    try {
      // Ensure archive directory exists
      if (!fs.existsSync(archivePath)) {
        fs.mkdirSync(archivePath, { recursive: true });
      }

      const fileName = path.basename(sourcePath);
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const archivedName = `${timestamp}_${fileName}`;
      const destination = path.join(archivePath, archivedName);

      fs.renameSync(sourcePath, destination);
      console.log(`[CSV Parser] Archived file to: ${destination}`);
    } catch (err) {
      console.error(`[CSV Parser] Error archiving file:`, err);
      throw err;
    }
  }

  /**
   * Delete processed file
   */
  static deleteFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
      console.log(`[CSV Parser] Deleted file: ${filePath}`);
    } catch (err) {
      console.error(`[CSV Parser] Error deleting file:`, err);
      throw err;
    }
  }
}

/**
 * Example usage and common presets
 */
export const CSVPresets = {
  /**
   * Generic CSV with header row
   * Columns: Sample ID, Test Code, Result, Unit, Flag
   */
  generic: {
    delimiter: ',',
    hasHeader: true,
    encoding: 'utf8' as const,
    columnMapping: {
      sampleId: 'Sample ID',
      testCode: 'Test',
      result: 'Result',
      unit: 'Unit',
      flag: 'Flag',
    },
  },

  /**
   * Tab-delimited format (common for many instruments)
   */
  tabDelimited: {
    delimiter: '\t',
    hasHeader: true,
    encoding: 'utf8' as const,
    columnMapping: {
      sampleId: 0,
      testCode: 1,
      result: 2,
      unit: 3,
      flag: 4,
    },
  },

  /**
   * Semicolon-delimited (common in Europe)
   */
  semicolon: {
    delimiter: ';',
    hasHeader: true,
    encoding: 'utf8' as const,
    columnMapping: {
      sampleId: 0,
      testCode: 1,
      result: 2,
    },
  },
};
