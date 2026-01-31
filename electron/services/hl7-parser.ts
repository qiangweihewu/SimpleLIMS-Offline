/**
 * HL7 v2.x Parser for Laboratory Results
 * Focuses on ORU^R01 (Observation Result) messages
 * Robust parsing with fault tolerance for various instrument implementations
 */

// MLLP Frame characters
export const MLLP = {
  VT: 0x0b, // Vertical Tab - Start of message
  FS: 0x1c, // File Separator - End of message
  CR: 0x0d, // Carriage Return
};

export interface HL7Message {
  msh: MSHSegment;
  pid?: PIDSegment;
  obr: OBRSegment[];
  obx: OBXSegment[];
  raw: string;
  parsedAt: string;
}

export interface MSHSegment {
  fieldSeparator: string;
  encodingCharacters: string;
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  dateTime?: string;
  messageType: string;
  messageControlId: string;
  processingId?: string;
  versionId?: string;
  version?: string; // e.g., "2.5"
}

export interface PIDSegment {
  patientId?: string;
  patientIdList?: string;
  patientName?: string;
  dateOfBirth?: string;
  sex?: string;
  patientName1stComponent?: string; // Parsed first name
  patientNameLastComponent?: string; // Parsed last name
}

export interface OBRSegment {
  setId: number;
  placerOrderNumber?: string;
  fillerOrderNumber?: string;
  universalServiceId?: string;
  observationDateTime?: string;
  specimenSource?: string;
}

/**
 * OBX segment with multiple value type support:
 * - NM: Numeric
 * - ST: String (text)
 * - TX: Text (longer text)
 * - CF: Coded Entry (code^text^system)
 * - CE: Coded Element
 * - DT: Date
 * - TM: Time
 * - DTM: Date/Time
 * - CWE: Coded with Exceptions
 * - SN: Structured Numeric
 * - IS: Coded value for user-defined tables
 * - FT: Formatted Text
 * - ED: Encapsulated Data (binary, base64, etc.)
 */
export interface OBXSegment {
  setId: number;
  valueType: string; // NM, ST, TX, CF, CE, CWE, etc.
  observationId: string; // Test code (e.g., "WBC^White Blood Cell Count")
  observationSubId?: string;
  observationValue: string | number | null; // Numeric or string
  observationValueRaw?: string; // Original string before parsing
  units?: string;
  referenceRange?: string;
  refRangeLow?: number;
  refRangeHigh?: number;
  abnormalFlags?: string; // N, H, L, HH, LL, etc.
  resultStatus?: string; // F (Final), P (Preliminary), C (Correction)
  observationMethod?: string; // How test was performed
  analysisDateTime?: string; // When test was run
  performingOrganization?: string;
}

/**
 * Safe field access with default empty string
 */
function getField(fields: string[], index: number, defaultValue: string = ''): string {
  return (fields[index] ?? '').trim() || defaultValue;
}

/**
 * Safe component access within a field
 * Fields are separated by |, components within fields by ^
 */
function getComponent(field: string, index: number, componentSep: string = '^'): string {
  if (!field) return '';
  const components = field.split(componentSep);
  return (components[index] ?? '').trim();
}

/**
 * Parse reference range from string (e.g., "100-200", ">50", "0.5-2.5")
 * Returns { low, high } or { low: null, high: null } if parse fails
 */
function parseReferenceRange(rangeStr: string | undefined): { low?: number; high?: number } {
  if (!rangeStr) return {};

  try {
    // Try simple range format: "100-200"
    const simpleMatch = rangeStr.match(/^([\d.]+)-([\d.]+)$/);
    if (simpleMatch) {
      return {
        low: parseFloat(simpleMatch[1]),
        high: parseFloat(simpleMatch[2]),
      };
    }

    // Try ranges with operators: ">100", "<200", ">=50-<=500"
    // For now, just return empty if format is complex
    return {};
  } catch (error) {
    console.warn(`[HL7Parser] Failed to parse reference range: ${rangeStr}`);
    return {};
  }
}

/**
 * Safe numeric value extraction with type checking
 */
function parseNumericValue(value: string | undefined, valueType: string): number | string | null {
  if (!value) return null;

  const trimmed = value.trim();
  
  // For numeric types, try to parse as number
  if (['NM', 'SN', 'IS'].includes(valueType)) {
    const numeric = parseFloat(trimmed);
    return isNaN(numeric) ? trimmed : numeric;
  }

  // For structured numeric (SN), extract just the value part if format is "^value^"
  if (valueType === 'SN' && trimmed.startsWith('^')) {
    const parts = trimmed.split('^');
    if (parts[1]) {
      const numeric = parseFloat(parts[1]);
      return isNaN(numeric) ? parts[1] : numeric;
    }
  }

  // For coded types, return raw string (let application layer handle decoding)
  if (['CF', 'CE', 'CWE'].includes(valueType)) {
    return trimmed;
  }

  // For text and other types, return as string
  return trimmed;
}

/**
 * Strip MLLP frame from buffer
 * MLLP format: VT + message + FS + CR
 */
export function stripMLLP(data: Buffer): string {
  let start = 0;
  let end = data.length;

  if (data.length > 0 && data[0] === MLLP.VT) {
    start = 1;
  }

  for (let i = data.length - 1; i >= start; i--) {
    if (data[i] === MLLP.FS || data[i] === MLLP.CR) {
      end = i;
    } else {
      break;
    }
  }

  return data.subarray(start, end).toString('utf-8');
}

/**
 * Parse MSH (Message Header) segment
 * Special handling: MSH-1 is the field separator itself
 */
export function parseMSH(segment: string, fieldSep: string): MSHSegment {
  try {
    // MSH is special: MSH-1 is the field separator itself, MSH-2 is encoding chars
    // Format: MSH|^~\&|field3|field4|...
    const afterMsh = segment.substring(4); // Skip "MSH|"
    const fields = afterMsh.split(fieldSep);

    return {
      fieldSeparator: fieldSep,
      encodingCharacters: getField(fields, 0), // MSH-2
      sendingApplication: getComponent(getField(fields, 1), 0), // MSH-3
      sendingFacility: getComponent(getField(fields, 2), 0), // MSH-4
      receivingApplication: getComponent(getField(fields, 3), 0), // MSH-5
      receivingFacility: getComponent(getField(fields, 4), 0), // MSH-6
      dateTime: getField(fields, 5), // MSH-7
      messageType: getField(fields, 7), // MSH-9
      messageControlId: getField(fields, 8), // MSH-10
      processingId: getField(fields, 9), // MSH-11
      versionId: getField(fields, 10), // MSH-12
      version: getComponent(getField(fields, 10), 0), // Version from MSH-12 (e.g., 2.5)
    };
  } catch (error) {
    console.error(`[HL7Parser] Error parsing MSH segment:`, error);
    throw new Error(`Failed to parse MSH segment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse PID (Patient Identification) segment
 */
export function parsePID(segment: string, fieldSep: string): PIDSegment {
  try {
    const fields = segment.split(fieldSep);

    // Parse patient name: may be "LastName^FirstName^MiddleName^Suffix^Prefix"
    const patientNameField = getField(fields, 5);
    const nameParts = patientNameField.split('^');

    return {
      patientId: getField(fields, 2), // PID-2
      patientIdList: getField(fields, 3), // PID-3
      patientName: patientNameField, // PID-5 (full raw)
      patientNameLastComponent: nameParts[0], // Last name
      patientName1stComponent: nameParts[1], // First name
      dateOfBirth: getField(fields, 7), // PID-7
      sex: getField(fields, 8), // PID-8
    };
  } catch (error) {
    console.error(`[HL7Parser] Error parsing PID segment:`, error);
    throw new Error(`Failed to parse PID segment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse OBR (Observation Request) segment
 */
export function parseOBR(segment: string, fieldSep: string): OBRSegment {
  try {
    const fields = segment.split(fieldSep);

    const setIdStr = getField(fields, 1);
    const setId = setIdStr ? parseInt(setIdStr, 10) : 1;

    return {
      setId: isNaN(setId) ? 1 : setId, // OBR-1
      placerOrderNumber: getField(fields, 2), // OBR-2
      fillerOrderNumber: getField(fields, 3), // OBR-3
      universalServiceId: getField(fields, 4), // OBR-4
      observationDateTime: getField(fields, 7), // OBR-7
      specimenSource: getField(fields, 15), // OBR-15 (specimen source)
    };
  } catch (error) {
    console.error(`[HL7Parser] Error parsing OBR segment:`, error);
    throw new Error(`Failed to parse OBR segment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse OBX (Observation Result) segment
 * Handles various value types: NM (numeric), ST (string), TX (text), CE/CWE (coded), etc.
 */
export function parseOBX(segment: string, fieldSep: string): OBXSegment {
  try {
    const fields = segment.split(fieldSep);

    const setIdStr = getField(fields, 1);
    const setId = setIdStr ? parseInt(setIdStr, 10) : 1;

    const valueType = getField(fields, 2); // OBX-2
    const rawValue = getField(fields, 5); // OBX-5 (raw observation value)
    const referenceRangeStr = getField(fields, 7); // OBX-7

    // Parse numeric value based on type
    const parsedValue = parseNumericValue(rawValue, valueType);

    // Parse reference range
    const refRangeObj = parseReferenceRange(referenceRangeStr);

    // Normalize abnormal flags
    const flagStr = getField(fields, 8);
    const normalizedFlag = flagStr ? normalizeAbnormalFlag(flagStr) : undefined;

    return {
      setId: isNaN(setId) ? 1 : setId, // OBX-1
      valueType, // OBX-2
      observationId: getField(fields, 3), // OBX-3 (may contain code^text)
      observationSubId: getField(fields, 4) || undefined, // OBX-4
      observationValue: parsedValue, // OBX-5 (parsed)
      observationValueRaw: rawValue, // OBX-5 (original)
      units: getField(fields, 6) || undefined, // OBX-6
      referenceRange: referenceRangeStr || undefined, // OBX-7 (raw)
      refRangeLow: refRangeObj.low,
      refRangeHigh: refRangeObj.high,
      abnormalFlags: normalizedFlag, // OBX-8 (normalized)
      resultStatus: getField(fields, 11) || undefined, // OBX-11 (F/P/C)
      observationMethod: getField(fields, 17) || undefined, // OBX-17
      analysisDateTime: getField(fields, 19) || undefined, // OBX-19
      performingOrganization: getField(fields, 23) || undefined, // OBX-23
    };
  } catch (error) {
    console.error(`[HL7Parser] Error parsing OBX segment:`, error);
    throw new Error(`Failed to parse OBX segment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalize abnormal flags to standard format
 */
function normalizeAbnormalFlag(flag: string): string | undefined {
  if (!flag) return undefined;

  const upper = flag.trim().toUpperCase();
  const mapping: Record<string, string> = {
    'N': 'N',
    'NORMAL': 'N',
    'H': 'H',
    'HIGH': 'H',
    '>': 'H',
    'L': 'L',
    'LOW': 'L',
    '<': 'L',
    'HH': 'HH',
    'CRITICAL HIGH': 'HH',
    '>>': 'HH',
    'LL': 'LL',
    'CRITICAL LOW': 'LL',
    '<<': 'LL',
  };

  return mapping[upper] || flag;
}

/**
 * Parse complete HL7 v2.x message
 * Robust parsing with per-segment error handling
 */
export function parseHL7Message(raw: string): HL7Message {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Invalid HL7 message: not a string');
  }

  try {
    // Normalize line endings
    const normalized = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
    const segments = normalized.split('\r').filter((s) => s.trim().length > 0);

    if (segments.length === 0) {
      throw new Error('No segments found in HL7 message');
    }

    // Find MSH and extract field separator
    const mshSegment = segments.find((s) => s.startsWith('MSH'));
    if (!mshSegment) {
      throw new Error('No MSH segment found in HL7 message');
    }

    // MSH-1 is the 4th character (after "MSH")
    // Standard is "|", but could be other characters
    const fieldSep = mshSegment.charAt(3) || '|';

    let parsedMsh: MSHSegment;
    try {
      parsedMsh = parseMSH(mshSegment, fieldSep);
    } catch (error) {
      throw new Error(`MSH segment parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const message: HL7Message = {
      msh: parsedMsh,
      obr: [],
      obx: [],
      raw,
      parsedAt: new Date().toISOString(),
    };

    // Parse remaining segments with per-segment error handling
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentType = segment.substring(0, 3).toUpperCase();

      try {
        switch (segmentType) {
          case 'MSH':
            // Already parsed
            break;
          case 'PID':
            message.pid = parsePID(segment, fieldSep);
            break;
          case 'OBR':
            message.obr.push(parseOBR(segment, fieldSep));
            break;
          case 'OBX':
            message.obx.push(parseOBX(segment, fieldSep));
            break;
          // Ignore unknown segment types
          default:
            console.debug(`[HL7Parser] Skipping unknown segment type: ${segmentType}`);
            break;
        }
      } catch (error) {
        // Log warning but continue parsing
        console.warn(
          `[HL7Parser] Failed to parse ${segmentType} segment (line ${i + 1}): ${error instanceof Error ? error.message : String(error)}`
        );
        // Don't throw - allow partial message parsing
      }
    }

    // Validate we have at least MSH and some results
    if (message.obx.length === 0 && message.obr.length === 0) {
      console.warn('[HL7Parser] Warning: Message has no OBX or OBR segments');
    }

    return message;
  } catch (error) {
    console.error('[HL7Parser] Fatal error parsing HL7 message:', error);
    throw error;
  }
}

/**
 * Validate that a segment has correct structure
 */
export function validateHL7Segment(segment: string, expectedType: string): boolean {
  if (!segment || typeof segment !== 'string') return false;
  if (segment.length < 3) return false;

  const type = segment.substring(0, 3).toUpperCase();
  return type === expectedType.toUpperCase();
}

export function isHL7Message(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('MSH|') || trimmed.startsWith('MSH^');
}

export function isMLLPFramed(data: Buffer): boolean {
  return data.length > 0 && data[0] === MLLP.VT;
}
