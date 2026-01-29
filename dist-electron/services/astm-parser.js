/**
 * ASTM E1381/E1394 Protocol Parser
 * Handles communication with laboratory instruments using ASTM protocol
 */
// Control characters
export const CTRL = {
    SOH: 0x01, // Start of Header
    STX: 0x02, // Start of Text
    ETX: 0x03, // End of Text
    EOT: 0x04, // End of Transmission
    ENQ: 0x05, // Enquiry
    ACK: 0x06, // Acknowledge
    NAK: 0x15, // Negative Acknowledge
    ETB: 0x17, // End of Transmission Block
    LF: 0x0A, // Line Feed
    CR: 0x0D, // Carriage Return
};
/**
 * Calculate ASTM checksum
 * Sum all characters from STX to ETX/ETB (inclusive), mod 256, as 2-char hex
 */
export function calculateChecksum(data, startIdx, endIdx) {
    let sum = 0;
    for (let i = startIdx; i <= endIdx; i++) {
        sum += data[i];
    }
    return (sum % 256).toString(16).toUpperCase().padStart(2, '0');
}
/**
 * Verify checksum of an ASTM frame
 */
export function verifyChecksum(frame) {
    const stxIdx = frame.indexOf(CTRL.STX);
    const etxIdx = frame.indexOf(CTRL.ETX);
    const etbIdx = frame.indexOf(CTRL.ETB);
    const endIdx = etxIdx !== -1 ? etxIdx : etbIdx;
    if (stxIdx === -1 || endIdx === -1)
        return false;
    const checksumStart = endIdx + 1;
    if (checksumStart + 2 > frame.length)
        return false;
    const providedChecksum = frame.slice(checksumStart, checksumStart + 2).toString('ascii');
    const calculatedChecksum = calculateChecksum(frame, stxIdx + 1, endIdx);
    return providedChecksum === calculatedChecksum;
}
/**
 * Parse a single ASTM record line
 */
export function parseRecord(line, delimiter = '|') {
    const fields = line.split(delimiter);
    const recordType = fields[0]?.charAt(0);
    switch (recordType) {
        case 'H':
            return parseHeaderRecord(fields);
        case 'P':
            return parsePatientRecord(fields);
        case 'O':
            return parseOrderRecord(fields);
        case 'R':
            return parseResultRecord(fields);
        case 'L':
            return parseTerminatorRecord(fields);
        default:
            return { type: 'unknown', raw: line };
    }
}
function parseHeaderRecord(fields) {
    return {
        type: 'H',
        delimiter: fields[1] || '|',
        messageControlId: fields[2],
        accessPassword: fields[3],
        senderName: fields[4],
        senderAddress: fields[5],
        reservedField: fields[6],
        senderPhone: fields[7],
        characteristicsOfSender: fields[8],
        receiverId: fields[9],
        comment: fields[10],
        processingId: fields[11],
        versionNumber: fields[12],
        timestamp: fields[13],
    };
}
function parsePatientRecord(fields) {
    return {
        type: 'P',
        sequenceNumber: parseInt(fields[1]) || 1,
        practicePatientId: fields[2],
        labPatientId: fields[3],
        patientId3: fields[4],
        patientName: fields[5],
        mothersMaidenName: fields[6],
        birthdate: fields[7],
        sex: fields[8],
        race: fields[9],
        address: fields[10],
        phone: fields[11],
        attendingPhysician: fields[12],
    };
}
function parseOrderRecord(fields) {
    return {
        type: 'O',
        sequenceNumber: parseInt(fields[1]) || 1,
        specimenId: fields[2],
        instrumentSpecimenId: fields[3],
        universalTestId: fields[4],
        priority: fields[5],
        requestedDateTime: fields[6],
        collectionDateTime: fields[7],
    };
}
function parseResultRecord(fields) {
    return {
        type: 'R',
        sequenceNumber: parseInt(fields[1]) || 1,
        universalTestId: fields[2],
        dataValue: fields[3],
        units: fields[4],
        referenceRanges: fields[5],
        abnormalFlags: fields[6],
        natureOfAbnormality: fields[7],
        resultStatus: fields[8],
        dateOfChange: fields[9],
        operatorId: fields[10],
        dateTimeStarted: fields[11],
        dateTimeCompleted: fields[12],
        instrumentId: fields[13],
    };
}
function parseTerminatorRecord(fields) {
    return {
        type: 'L',
        sequenceNumber: parseInt(fields[1]) || 1,
        terminationCode: fields[2],
    };
}
/**
 * Parse complete ASTM message from raw data
 */
export function parseASTMMessage(rawData) {
    const message = {
        patients: [],
        orders: [],
        results: [],
        raw: rawData,
    };
    // Remove control characters (codes 0-31) and split into lines
    const cleanData = rawData
        .split('')
        .map(char => char.charCodeAt(0) < 32 ? '\n' : char)
        .join('')
        .split('\n')
        .filter(line => line.trim().length > 0);
    let delimiter = '|';
    for (const line of cleanData) {
        const recordType = line.charAt(0);
        switch (recordType) {
            case 'H': {
                const header = parseHeaderRecord(line.split(delimiter));
                message.header = header;
                if (header.delimiter) {
                    delimiter = header.delimiter.charAt(0) || '|';
                }
                break;
            }
            case 'P':
                message.patients.push(parsePatientRecord(line.split(delimiter)));
                break;
            case 'O':
                message.orders.push(parseOrderRecord(line.split(delimiter)));
                break;
            case 'R':
                message.results.push(parseResultRecord(line.split(delimiter)));
                break;
            case 'L':
                message.terminator = parseTerminatorRecord(line.split(delimiter));
                break;
        }
    }
    return message;
}
/**
 * Extract test code from universal test ID
 * Format varies: ^^^WBC^001 or ^^^WBC or just WBC
 */
export function extractTestCode(universalTestId) {
    if (!universalTestId)
        return '';
    const parts = universalTestId.split('^');
    // Find first non-empty part after carets
    for (const part of parts) {
        if (part && part.length > 0 && !/^\d+$/.test(part)) {
            return part;
        }
    }
    return universalTestId;
}
/**
 * Parse numeric value from result string
 */
export function parseResultValue(value) {
    if (!value)
        return { numeric: null, text: '' };
    const trimmed = value.trim();
    const numeric = parseFloat(trimmed);
    return {
        numeric: isNaN(numeric) ? null : numeric,
        text: trimmed,
    };
}
/**
 * Map abnormal flags to standard flags
 */
export function mapAbnormalFlag(flag) {
    if (!flag)
        return null;
    const upper = flag.toUpperCase().trim();
    switch (upper) {
        case 'N':
        case 'NORMAL':
            return 'N';
        case 'H':
        case 'HIGH':
        case '>':
            return 'H';
        case 'L':
        case 'LOW':
        case '<':
            return 'L';
        case 'HH':
        case 'CRITICAL HIGH':
        case '>>':
            return 'HH';
        case 'LL':
        case 'CRITICAL LOW':
        case '<<':
            return 'LL';
        default:
            return null;
    }
}
//# sourceMappingURL=astm-parser.js.map