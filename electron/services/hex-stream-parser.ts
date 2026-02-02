/**
 * Hex Stream Parser Service
 * 
 * Parses binary/proprietary protocols from legacy medical devices
 * using JSON-based field definitions (offset, length, type).
 */

import { EventEmitter } from 'events';
import { trafficLogger } from './traffic-logger.js';
import { dataQualityMonitor } from './data-quality-monitor.js';
import { timeSyncService } from './time-sync-service.js';

// Supported data types for field extraction
export type HexFieldType = 
  | 'uint8' 
  | 'uint16_le' 
  | 'uint16_be' 
  | 'int16_le' 
  | 'int16_be'
  | 'uint32_le'
  | 'uint32_be'
  | 'int32_le'
  | 'int32_be'
  | 'float32_le'
  | 'float32_be'
  | 'float64_le'
  | 'float64_be'
  | 'bcd'           // Binary-coded decimal
  | 'ascii'
  | 'hex';          // Raw hex string

export interface HexFieldDefinition {
  name: string;              // Field name (e.g., "WBC", "HR")
  offset: number;            // Byte offset in frame
  length: number;            // Number of bytes
  type: HexFieldType;        // Data type
  scale?: number;            // Scale factor (e.g., 0.01)
  unit?: string;             // Unit string (e.g., "bpm", "10^9/L")
  bitmask?: number;          // Optional bitmask for flag extraction
  bitOffset?: number;        // Bit offset within byte (for boolean flags)
  enumMap?: Record<number, string>;  // Enum value mapping
}

export interface HexProtocolDefinition {
  id: string;
  name: string;
  description?: string;
  startMarker?: number[];    // Frame start bytes (e.g., [0x02, 0x00])
  endMarker?: number[];      // Frame end bytes (e.g., [0x03])
  lengthField?: {            // Dynamic length field
    offset: number;
    type: 'uint8' | 'uint16_le' | 'uint16_be';
    includesHeader?: boolean;
  };
  fixedLength?: number;      // Fixed frame length
  checksumType?: 'none' | 'xor' | 'sum8' | 'crc16_modbus' | 'crc16_ccitt';
  checksumOffset?: number;   // Offset of checksum in frame (negative = from end)
  checksumLength?: number;   // Checksum length in bytes
  checksumRange?: [number, number];  // Range to calculate checksum over
  fields: HexFieldDefinition[];
}

export interface ParsedResult {
  success: boolean;
  instrumentId?: number;
  values: Record<string, { 
    raw: any; 
    value: any; 
    unit?: string;
    name: string;
  }>;
  rawFrame: Buffer;
  hexDump: string;
  receiptTimestamp: string;
  errors?: string[];
}

export class HexStreamParser extends EventEmitter {
  private definition: HexProtocolDefinition;
  private buffer: Buffer = Buffer.alloc(0);
  private instrumentId?: number;

  constructor(definition: HexProtocolDefinition) {
    super();
    this.definition = definition;
  }

  /**
   * Set instrument ID for logging
   */
  setInstrumentId(id: number): void {
    this.instrumentId = id;
  }

  /**
   * Feed data into parser buffer
   */
  feed(data: Buffer): ParsedResult[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    return this.extractAndParse();
  }

  /**
   * Extract complete frames from buffer and parse them
   */
  private extractAndParse(): ParsedResult[] {
    const results: ParsedResult[] = [];
    const frames = this.extractFrames();
    
    for (const frame of frames) {
      const result = this.parse(frame);
      results.push(result);
      this.emit('frame', result);
    }
    
    return results;
  }

  /**
   * Extract complete frames from buffer
   */
  extractFrames(): Buffer[] {
    const frames: Buffer[] = [];
    
    while (this.buffer.length > 0) {
      const frame = this.tryExtractFrame();
      if (!frame) break;
      frames.push(frame);
    }
    
    return frames;
  }

  /**
   * Try to extract a single frame from buffer
   */
  private tryExtractFrame(): Buffer | null {
    const { startMarker, endMarker, fixedLength, lengthField } = this.definition;
    
    // Find start marker
    let startIdx = 0;
    if (startMarker && startMarker.length > 0) {
      startIdx = this.findMarker(this.buffer, startMarker);
      if (startIdx === -1) {
        // No start marker found, keep last few bytes in case marker is split
        if (this.buffer.length > startMarker.length) {
          this.buffer = this.buffer.slice(-(startMarker.length - 1));
        }
        return null;
      }
    }
    
    // Determine frame length
    let frameLength: number;
    
    if (fixedLength) {
      frameLength = fixedLength;
    } else if (lengthField) {
      const lengthOffset = startIdx + lengthField.offset;
      if (this.buffer.length < lengthOffset + 2) return null;
      
      frameLength = this.readLength(this.buffer, lengthOffset, lengthField.type);
      if (lengthField.includesHeader) {
        // Length includes header bytes
      } else {
        frameLength += lengthField.offset + (lengthField.type === 'uint8' ? 1 : 2);
      }
    } else if (endMarker && endMarker.length > 0) {
      const endIdx = this.findMarker(this.buffer, endMarker, startIdx + 1);
      if (endIdx === -1) return null;
      frameLength = endIdx + endMarker.length - startIdx;
    } else {
      console.warn('[HexParser] No frame boundary defined');
      return null;
    }
    
    // Check if we have complete frame
    if (this.buffer.length < startIdx + frameLength) {
      return null;
    }
    
    // Extract frame
    const frame = this.buffer.slice(startIdx, startIdx + frameLength);
    this.buffer = this.buffer.slice(startIdx + frameLength);
    
    return frame;
  }

  /**
   * Find marker bytes in buffer
   */
  private findMarker(buffer: Buffer, marker: number[], startFrom: number = 0): number {
    for (let i = startFrom; i <= buffer.length - marker.length; i++) {
      let found = true;
      for (let j = 0; j < marker.length; j++) {
        if (buffer[i + j] !== marker[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  /**
   * Read length field
   */
  private readLength(buffer: Buffer, offset: number, type: 'uint8' | 'uint16_le' | 'uint16_be'): number {
    switch (type) {
      case 'uint8': return buffer.readUInt8(offset);
      case 'uint16_le': return buffer.readUInt16LE(offset);
      case 'uint16_be': return buffer.readUInt16BE(offset);
    }
  }

  /**
   * Parse a complete frame
   */
  parse(frame: Buffer): ParsedResult {
    const receiptTimestamp = timeSyncService.getReceiptTimestamp();
    const hexDump = this.formatHexDump(frame);
    const errors: string[] = [];
    
    // Validate checksum
    if (this.definition.checksumType && this.definition.checksumType !== 'none') {
      if (!this.validateChecksum(frame)) {
        if (this.instrumentId) {
          dataQualityMonitor.recordChecksumError(this.instrumentId);
        }
        return {
          success: false,
          instrumentId: this.instrumentId,
          values: {},
          rawFrame: frame,
          hexDump,
          receiptTimestamp,
          errors: ['Checksum validation failed']
        };
      }
    }
    
    // Parse fields
    const values: ParsedResult['values'] = {};
    
    for (const field of this.definition.fields) {
      try {
        const rawValue = this.extractField(frame, field);
        const scaledValue = field.scale ? rawValue * field.scale : rawValue;
        
        values[field.name] = {
          raw: rawValue,
          value: scaledValue,
          unit: field.unit,
          name: field.name
        };
      } catch (err) {
        errors.push(`Failed to parse field ${field.name}: ${err}`);
      }
    }
    
    if (this.instrumentId) {
      if (errors.length === 0) {
        dataQualityMonitor.recordSuccess(this.instrumentId);
      } else {
        dataQualityMonitor.recordIncompleteData(this.instrumentId);
      }
    }
    
    return {
      success: errors.length === 0,
      instrumentId: this.instrumentId,
      values,
      rawFrame: frame,
      hexDump,
      receiptTimestamp,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Extract a single field from frame
   */
  private extractField(frame: Buffer, field: HexFieldDefinition): any {
    const { offset, length, type, bitmask, bitOffset, enumMap } = field;
    
    if (offset + length > frame.length) {
      throw new Error(`Field extends beyond frame: offset=${offset}, length=${length}, frameLength=${frame.length}`);
    }
    
    let value: any;
    
    switch (type) {
      case 'uint8':
        value = frame.readUInt8(offset);
        break;
      case 'uint16_le':
        value = frame.readUInt16LE(offset);
        break;
      case 'uint16_be':
        value = frame.readUInt16BE(offset);
        break;
      case 'int16_le':
        value = frame.readInt16LE(offset);
        break;
      case 'int16_be':
        value = frame.readInt16BE(offset);
        break;
      case 'uint32_le':
        value = frame.readUInt32LE(offset);
        break;
      case 'uint32_be':
        value = frame.readUInt32BE(offset);
        break;
      case 'int32_le':
        value = frame.readInt32LE(offset);
        break;
      case 'int32_be':
        value = frame.readInt32BE(offset);
        break;
      case 'float32_le':
        value = frame.readFloatLE(offset);
        break;
      case 'float32_be':
        value = frame.readFloatBE(offset);
        break;
      case 'float64_le':
        value = frame.readDoubleLE(offset);
        break;
      case 'float64_be':
        value = frame.readDoubleBE(offset);
        break;
      case 'bcd':
        value = this.decodeBCD(frame.slice(offset, offset + length));
        break;
      case 'ascii':
        value = frame.slice(offset, offset + length).toString('ascii').replace(/\0/g, '').trim();
        break;
      case 'hex':
        value = frame.slice(offset, offset + length).toString('hex').toUpperCase();
        break;
      default:
        throw new Error(`Unsupported field type: ${type}`);
    }
    
    // Apply bitmask if specified
    if (bitmask !== undefined && typeof value === 'number') {
      value = value & bitmask;
      if (bitOffset !== undefined) {
        value = value >> bitOffset;
      }
    }
    
    // Apply enum mapping if specified
    if (enumMap && typeof value === 'number') {
      value = enumMap[value] ?? value;
    }
    
    return value;
  }

  /**
   * Decode BCD (Binary-Coded Decimal)
   */
  private decodeBCD(data: Buffer): number {
    let result = 0;
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      const high = (byte >> 4) & 0x0F;
      const low = byte & 0x0F;
      result = result * 100 + high * 10 + low;
    }
    return result;
  }

  /**
   * Validate checksum
   */
  validateChecksum(frame: Buffer): boolean {
    const { checksumType, checksumOffset, checksumLength, checksumRange } = this.definition;
    
    if (!checksumType || checksumType === 'none') return true;
    
    const csOffset = checksumOffset !== undefined 
      ? (checksumOffset < 0 ? frame.length + checksumOffset : checksumOffset)
      : frame.length - (checksumLength || 1);
    
    const csLength = checksumLength || (checksumType === 'crc16_modbus' || checksumType === 'crc16_ccitt' ? 2 : 1);
    
    const dataStart = checksumRange ? checksumRange[0] : 0;
    const dataEnd = checksumRange ? checksumRange[1] : csOffset;
    const data = frame.slice(dataStart, dataEnd);
    
    const received = csLength === 1 
      ? frame.readUInt8(csOffset)
      : frame.readUInt16LE(csOffset);
    
    let calculated: number;
    
    switch (checksumType) {
      case 'xor':
        calculated = this.calculateXOR(data);
        break;
      case 'sum8':
        calculated = this.calculateSum8(data);
        break;
      case 'crc16_modbus':
        calculated = this.calculateCRC16Modbus(data);
        break;
      case 'crc16_ccitt':
        calculated = this.calculateCRC16CCITT(data);
        break;
      default:
        return true;
    }
    
    return received === calculated;
  }

  /**
   * Calculate XOR checksum
   */
  private calculateXOR(data: Buffer): number {
    let xor = 0;
    for (let i = 0; i < data.length; i++) {
      xor ^= data[i];
    }
    return xor;
  }

  /**
   * Calculate Sum8 checksum (modulo 256)
   */
  private calculateSum8(data: Buffer): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum = (sum + data[i]) & 0xFF;
    }
    return sum;
  }

  /**
   * Calculate CRC-16 Modbus
   */
  private calculateCRC16Modbus(data: Buffer): number {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }

  /**
   * Calculate CRC-16 CCITT
   */
  private calculateCRC16CCITT(data: Buffer): number {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
      }
    }
    return crc & 0xFFFF;
  }

  /**
   * Format buffer as hex dump
   */
  private formatHexDump(data: Buffer): string {
    return Array.from(data)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  /**
   * Clear internal buffer
   */
  clear(): void {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Get current buffer length
   */
  getBufferLength(): number {
    return this.buffer.length;
  }
}

/**
 * Create parser from JSON definition file
 */
export function createParserFromDefinition(definition: HexProtocolDefinition): HexStreamParser {
  return new HexStreamParser(definition);
}
