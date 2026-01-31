import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Load private key
const privateKeyPath = path.resolve(__dirname, 'private_key.pem');
if (!fs.existsSync(privateKeyPath)) {
    console.error('Private key not found at', privateKeyPath);
    process.exit(1);
}
const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

interface LicensePayload {
    machineId: string;
    type: 'trial' | 'professional';
    expiresAt: string; // ISO date
    issuedAt: string;
}

function generateLicense(machineId: string, days: number = 365, type: 'trial' | 'professional' = 'professional') {
    const issuedAt = new Date().toISOString();
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresAt = expires.toISOString();

    const payload: LicensePayload = {
        machineId,
        type,
        expiresAt,
        issuedAt
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64');

    // Sign the payload
    const sign = crypto.createSign('SHA256');
    sign.update(payloadStr);
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    // License format: PAYLOAD_B64.SIGNATURE_B64
    const licenseKey = `${payloadB64}.${signature}`;

    return licenseKey;
}

// CLI args
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: npx tsx scripts/generate-license.ts <machine-id> [days] [type]');
    process.exit(0);
}

const machineId = args[0];
const days = args[1] ? parseInt(args[1]) : 365;
const type = (args[2] as 'trial' | 'professional') || 'professional';

console.log(`Generating license for Machine ID: ${machineId}`);
console.log(`Type: ${type}, Duration: ${days} days`);

const key = generateLicense(machineId, days, type);
console.log('\nLICENSE KEY:');
console.log(key);
console.log('\n');
