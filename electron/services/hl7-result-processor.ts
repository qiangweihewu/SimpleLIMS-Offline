/**
 * HL7 Result Processor
 * Processes HL7 messages and integrates with database.service
 * Handles instrument test code mapping and result storage
 */

import type { HL7Message, OBXSegment } from './hl7-parser.js';
import type { InstrumentTestMapping } from '../types/instrument-driver.js';

export interface ProcessedHL7Result {
  testCode: string; // Mapped LIMS test code
  value: string | number | null;
  units?: string;
  referenceRange?: string;
  abnormalFlag?: string;
  resultStatus?: 'F' | 'P' | 'C'; // Final, Preliminary, Correction
  analysisDateTime?: string;
  instrumentCode: string; // Original code from instrument
}

export interface ProcessedHL7Message {
  messageControlId: string;
  patientId?: string;
  sampleId?: string;
  results: ProcessedHL7Result[];
  errors: string[];
  parseDateTime: string;
}

export class HL7ResultProcessor {
  /**
   * Process HL7 message and extract mapped results
   */
  static processMessage(
    message: HL7Message,
    testMappings: InstrumentTestMapping[]
  ): ProcessedHL7Message {
    const processed: ProcessedHL7Message = {
      messageControlId: message.msh.messageControlId,
      patientId: message.pid?.patientId,
      sampleId: message.obr[0]?.fillerOrderNumber || message.obr[0]?.placerOrderNumber,
      results: [],
      errors: [],
      parseDateTime: new Date().toISOString(),
    };

    // Build mapping lookup
    const mappingMap = new Map<string, InstrumentTestMapping>();
    for (const mapping of testMappings) {
      mappingMap.set(mapping.instrument_code.toUpperCase(), mapping);
    }

    // Process OBX segments
    for (const obx of message.obx) {
      try {
        const result = this.processOBXSegment(obx, mappingMap);
        if (result) {
          processed.results.push(result);
        }
      } catch (error) {
        processed.errors.push(
          `Failed to process OBX result: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (processed.results.length === 0 && processed.errors.length === 0) {
      processed.errors.push('No results found in message');
    }

    return processed;
  }

  /**
   * Process single OBX segment
   */
  private static processOBXSegment(
    obx: OBXSegment,
    mappingMap: Map<string, InstrumentTestMapping>
  ): ProcessedHL7Result | null {
    // Extract test code from observation ID (format: "code^description")
    const testCodeRaw = obx.observationId.split('^')[0];
    if (!testCodeRaw) {
      throw new Error('OBX-3 (observation ID) is empty');
    }

    // Look up mapping
    const mapping = mappingMap.get(testCodeRaw.toUpperCase());
    if (!mapping) {
      throw new Error(`No mapping found for test code: ${testCodeRaw}`);
    }

    // Apply value type conversions
    let value: string | number | null = obx.observationValue;

    // For numeric values, apply conversion factor
    if (typeof value === 'number' && mapping.conversion_factor) {
      value = value * mapping.conversion_factor;
    }

    return {
      testCode: mapping.panel_id?.toString() || '', // Would be joined with test_panels
      value,
      units: obx.units,
      referenceRange: obx.referenceRange,
      abnormalFlag: obx.abnormalFlags,
      resultStatus: obx.resultStatus as 'F' | 'P' | 'C' | undefined,
      analysisDateTime: obx.analysisDateTime,
      instrumentCode: testCodeRaw,
    };
  }

  /**
   * Extract patient identifier for sample matching
   */
  static extractPatientIdentifier(message: HL7Message): string | null {
    // Try different patient ID sources in priority order
    if (message.pid?.patientIdList) return message.pid.patientIdList;
    if (message.pid?.patientId) return message.pid.patientId;
    
    // Some instruments send patient ID in OBR
    if (message.obr[0]?.placerOrderNumber) {
      // Extract patient ID if it's part of order number format
      const match = message.obr[0].placerOrderNumber.match(/^([A-Z0-9-]+)/);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Extract sample identifier for tracking
   */
  static extractSampleIdentifier(message: HL7Message): string | null {
    // Try different sample ID sources
    if (message.obr[0]?.fillerOrderNumber) return message.obr[0].fillerOrderNumber;
    if (message.obr[0]?.placerOrderNumber) return message.obr[0].placerOrderNumber;

    // Some systems put specimen ID in order number
    return null;
  }

  /**
   * Validate processed results for quality
   */
  static validateResults(processed: ProcessedHL7Message): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for unmatched results
    if (processed.results.length === 0) {
      issues.push('No results extracted from message');
    }

    // Check for missing identifiers
    if (!processed.patientId && !processed.sampleId) {
      issues.push('No patient or sample ID found');
    }

    // Check for mapping errors
    if (processed.errors.length > 0) {
      issues.push(`Mapping errors: ${processed.errors.join('; ')}`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
