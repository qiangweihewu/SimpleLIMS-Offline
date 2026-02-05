/**
 * License Key Generator
 * 
 * Usage: npx tsx scripts/generate-license.ts <machine-id> [options]
 * 
 * This script generates signed license keys that can be activated in SimpleLIMS.
 * The private key must be kept secure and never distributed.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Load private key
const privateKeyPath = path.resolve(__dirname, 'private_key.pem');
if (!fs.existsSync(privateKeyPath)) {
    console.error('❌ Private key not found at', privateKeyPath);
    console.log('\nTo generate a key pair, run:');
    console.log('  openssl genrsa -out scripts/private_key.pem 2048');
    console.log('  openssl rsa -in scripts/private_key.pem -pubout -out scripts/public_key.pem');
    console.log('\nThen update the EMBEDDED_PUBLIC_KEY in electron/services/license-service.ts');
    process.exit(1);
}
const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

// ============= Feature Bitmask (must match license-service.ts) =============
enum LicenseFeature {
    BASIC_TESTING = 1 << 0,
    PATIENT_MANAGEMENT = 1 << 1,
    INSTRUMENT_CONNECT = 1 << 2,
    REPORT_GENERATION = 1 << 3,
    IMAGE_CAPTURE = 1 << 4,
    CLOUD_SYNC = 1 << 5,
    ADVANCED_REPORTS = 1 << 6,
    AUDIT_LOG = 1 << 7,
}

const LICENSE_FEATURES: Record<string, number> = {
    trial: LicenseFeature.BASIC_TESTING | LicenseFeature.PATIENT_MANAGEMENT,
    professional:
        LicenseFeature.BASIC_TESTING |
        LicenseFeature.PATIENT_MANAGEMENT |
        LicenseFeature.INSTRUMENT_CONNECT |
        LicenseFeature.REPORT_GENERATION |
        LicenseFeature.IMAGE_CAPTURE |
        LicenseFeature.AUDIT_LOG,
    enterprise: 0xFF, // All features
};

interface LicensePayload {
    machineId: string;
    sn?: string;
    type: 'trial' | 'professional' | 'enterprise';
    features: number;
    expiresAt: string;
    issuedAt: string;
    maxRebinds?: number;
}

function normalizeMachineId(machineId: string): string {
    return machineId.replace(/-/g, '').toUpperCase();
}

function formatMachineId(machineId: string): string {
    const clean = normalizeMachineId(machineId);
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

function generateLicense(
    machineId: string,
    days: number = 365,
    type: 'trial' | 'professional' | 'enterprise' = 'professional',
    sn?: string,
    customFeatures?: number
): string {
    const issuedAt = new Date().toISOString();
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresAt = expires.toISOString();

    const features = customFeatures ?? LICENSE_FEATURES[type] ?? 0;

    const payload: LicensePayload = {
        machineId: normalizeMachineId(machineId),
        type,
        features,
        expiresAt,
        issuedAt,
        ...(sn && { sn }),
        maxRebinds: 3
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64');

    // Sign the payload with RSA-SHA256
    const sign = crypto.createSign('SHA256');
    sign.update(payloadStr);
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    // License format: PAYLOAD_B64.SIGNATURE_B64
    return `${payloadB64}.${signature}`;
}

function saveLicenseFile(licenseKey: string, machineId: string): string {
    const licenseData = {
        licenseKey,
        machineId: formatMachineId(machineId),
        generatedAt: new Date().toISOString(),
        instructions: '将此文件拷贝到离线设备，在SimpleLIMS中选择"从文件导入"'
    };

    const filename = `SimpleLIMS_License_${machineId.slice(0, 8)}.lic`;
    const filepath = path.resolve(__dirname, filename);
    fs.writeFileSync(filepath, JSON.stringify(licenseData, null, 2));
    return filepath;
}

// ============= CLI Interface =============

const args = process.argv.slice(2);

if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
SimpleLIMS License Generator (v2.1)
====================================

Usage: npx tsx scripts/generate-license.ts <machine-id> [options]

Arguments:
  machine-id    The unique machine ID from the user's SimpleLIMS installation
                Format: XXXX-XXXX-XXXX (12 chars) or XXXXXXXXXXXX (no dashes)

Options:
  --days, -d    License duration in days (default: 365)
  --type, -t    License type: trial | professional | enterprise (default: professional)
  --sn, -s      Serial number to associate with this license
  --save        Save as .lic file for USB transfer

Examples:
  npx tsx scripts/generate-license.ts K9P2X5M8A3B7
  npx tsx scripts/generate-license.ts K9P2-X5M8-A3B7
  npx tsx scripts/generate-license.ts K9P2X5M8A3B7 --days 730 --type enterprise
  npx tsx scripts/generate-license.ts K9P2X5M8A3B7 --sn LIMS-2026-A7X9 --save
    `);
    process.exit(0);
}

// Parse arguments
const machineIdInput = args[0];
let days = 365;
let type: 'trial' | 'professional' | 'enterprise' = 'professional';
let sn: string | undefined;
let saveFile = false;

for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if ((arg === '--days' || arg === '-d') && nextArg) {
        days = parseInt(nextArg);
        i++;
    } else if ((arg === '--type' || arg === '-t') && nextArg) {
        type = nextArg as typeof type;
        i++;
    } else if ((arg === '--sn' || arg === '-s') && nextArg) {
        sn = nextArg;
        i++;
    } else if (arg === '--save') {
        saveFile = true;
    } else if (!arg.startsWith('-')) {
        // Legacy positional arguments support
        if (!isNaN(parseInt(arg))) {
            days = parseInt(arg);
        } else if (['trial', 'professional', 'enterprise'].includes(arg)) {
            type = arg as typeof type;
        }
    }
}

// Normalize and validate machine ID
const machineId = normalizeMachineId(machineIdInput);

// New format: 12 Base58 characters
const machineIdPattern12 = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/i;
// Legacy format: 16 hex characters (XXXX-XXXX-XXXX-XXXX without dashes)
const machineIdPattern16 = /^[A-F0-9]{16}$/i;

if (!machineIdPattern12.test(machineId) && !machineIdPattern16.test(machineId)) {
    console.error('❌ Invalid Machine ID format.');
    console.error('   Expected: XXXX-XXXX-XXXX (12 chars, Base58)');
    console.error('   Or legacy: XXXX-XXXX-XXXX-XXXX (16 hex chars)');
    console.error(`   Received: ${machineIdInput} (normalized: ${machineId})`);
    process.exit(1);
}

const formattedId = formatMachineId(machineId);
const features = LICENSE_FEATURES[type];

console.log(`
╔══════════════════════════════════════════════════════════════╗
║              SimpleLIMS License Generator v2.1               ║
╠══════════════════════════════════════════════════════════════╣
║  Machine ID: ${formattedId.padEnd(45)}║
║  Type:       ${type.padEnd(45)}║
║  Duration:   ${(days + ' days').padEnd(45)}║
║  Features:   ${('0b' + features.toString(2).padStart(8, '0')).padEnd(45)}║
║  SN:         ${(sn || 'N/A').padEnd(45)}║
╚══════════════════════════════════════════════════════════════╝
`);

const licenseKey = generateLicense(machineId, days, type, sn);

console.log('✅ LICENSE KEY GENERATED:\n');
console.log('─'.repeat(70));
console.log(licenseKey);
console.log('─'.repeat(70));

if (saveFile) {
    const filepath = saveLicenseFile(licenseKey, machineId);
    console.log(`\n📁 License file saved to: ${filepath}`);
    console.log('   Copy this file to USB and import in SimpleLIMS.');
}

console.log(`
📋 Copy the license key above and provide it to the customer.
⚠️  Keep your private_key.pem secure and never share it!
`);
