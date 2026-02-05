/**
 * License Service - Unified license management for SimpleLIMS
 * 
 * Security measures:
 * 1. RSA-SHA256 signature verification (tamper-proof)
 * 2. Machine ID binding (one license per machine)
 * 3. Embedded public key (no external file dependency)
 * 4. Database integrity verification (prevents local tampering)
 * 5. Time drift detection (prevents clock manipulation)
 * 6. Feature bitmask support (fine-grained access control)
 * 7. Optional online heartbeat (when network available)
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import type Database from 'better-sqlite3-multiple-ciphers';

// ============= EMBEDDED PUBLIC KEY =============
// This is the RSA public key used to verify license signatures.
// The private key is kept secure server-side for generating licenses.
// Generated with: openssl rsa -in scripts/private_key.pem -pubout
const EMBEDDED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoQywWPn+d6WAzf57aSCT
b5bs8HuEG0FStGAlmJnm6WQQuU1chgS70VzHHcrh4xfmbMrQ/mY6XWwVwz6VytI+
e7iK6TykPN3Bh/i91kAAG1pEV3TllUJISirwx7dt4LIknHZChPGn4/Zuoy96K/DG
6ot+SFUqJBKnJJwRAdx5z06NXLHAvRqLdeiea/DI52B42Ok+MzWx/2eRJvM8P/Ex
YUG/USglL8pWGAmsiHgftrzGtpt0ZuYnvxVbwko8RFRrRLqizOusr9VThAmo8CiR
CQcG96iKbk1cpB31MOP0azGcba1phZSzDZxKChEvcYUAyUjDOvnQnst2lobXA4Eb
DwIDAQAB
-----END PUBLIC KEY-----`;

// ============= BASE58 ALPHABET =============
// Excludes easily confused characters: 0, O, I, l
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode bytes to Base58 string
 */
function encodeBase58(bytes: Buffer): string {
    let num = BigInt('0x' + bytes.toString('hex'));
    let result = '';

    while (num > 0) {
        const remainder = Number(num % 58n);
        result = BASE58_ALPHABET[remainder] + result;
        num = num / 58n;
    }

    // Handle leading zeros
    for (const byte of bytes) {
        if (byte === 0) {
            result = BASE58_ALPHABET[0] + result;
        } else {
            break;
        }
    }

    return result || BASE58_ALPHABET[0];
}

// ============= FEATURE BITMASK =============
export enum LicenseFeature {
    BASIC_TESTING = 1 << 0,      // 基础检验
    PATIENT_MANAGEMENT = 1 << 1, // 患者管理
    INSTRUMENT_CONNECT = 1 << 2, // 仪器对接
    REPORT_GENERATION = 1 << 3,  // 报告生成
    IMAGE_CAPTURE = 1 << 4,      // 影像采集
    CLOUD_SYNC = 1 << 5,         // 云同步
    ADVANCED_REPORTS = 1 << 6,   // 高级报表
    AUDIT_LOG = 1 << 7,          // 审计日志
}

// Default features for each license type
export const LICENSE_FEATURES: Record<string, number> = {
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

// ============= LICENSE PAYLOAD INTERFACE =============
export interface LicensePayload {
    machineId: string;
    sn?: string; // Serial number
    type: 'trial' | 'professional' | 'enterprise';
    features?: number; // Feature bitmask
    expiresAt: string; // ISO date string
    issuedAt: string;
    maxRebinds?: number;
}

export interface LicenseStatus {
    activated: boolean;
    machineId: string;
    machineIdFormatted: string; // Formatted with dashes
    activatedAt?: string;
    licenseType: 'trial' | 'professional' | 'enterprise';
    expiresAt?: string;
    trialDaysRemaining: number;
    isTrialExpired: boolean;
    isLicenseExpired: boolean;
    firstRunAt: string;
    features: number;
    integrityValid: boolean;
    timeIntegrityValid: boolean;
}

// ============= MACHINE ID GENERATION =============
/**
 * Generate a unique machine identifier based on hardware characteristics.
 * Uses Base58 encoding for human-readable output.
 * 
 * Characteristics used:
 * - OS platform (darwin/win32/linux)
 * - CPU architecture
 * - CPU model(s)
 * - Total memory
 * - Primary network MAC address
 * 
 * The resulting ID is 12 characters, formatted as XXXX-XXXX-XXXX
 */
export function generateMachineId(): string {
    const networkInterfaces = os.networkInterfaces();

    // Find the primary non-internal MAC address
    const primaryMac = Object.values(networkInterfaces)
        .flat()
        .find(iface => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00')?.mac || 'unknown';

    // Collect stable hardware characteristics
    const characteristics = [
        os.platform(),
        os.arch(),
        os.cpus().map(cpu => cpu.model).join('|'),
        os.totalmem().toString(),
        primaryMac
    ].join('::');

    // Generate SHA256 hash and take first 9 bytes (72 bits of entropy)
    const hash = crypto.createHash('sha256').update(characteristics).digest();
    const truncatedHash = hash.slice(0, 9);

    // Encode to Base58 and pad/truncate to exactly 12 characters
    let base58Id = encodeBase58(truncatedHash);
    base58Id = base58Id.padStart(12, BASE58_ALPHABET[0]).slice(0, 12);

    return base58Id.toUpperCase();
}

/**
 * Format machine ID with dashes for display: XXXX-XXXX-XXXX
 */
export function formatMachineId(machineId: string): string {
    const clean = machineId.replace(/-/g, '').toUpperCase();
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

/**
 * Normalize machine ID (remove dashes) for comparison
 */
export function normalizeMachineId(machineId: string): string {
    return machineId.replace(/-/g, '').toUpperCase();
}

// ============= TIME INTEGRITY CHECK =============
/**
 * Check for time manipulation (clock set backwards).
 * Returns false if current time is significantly before the last verified time.
 */
export function checkTimeIntegrity(db: Database.Database): boolean {
    try {
        const lastVerified = db.prepare(`SELECT value FROM settings WHERE key = 'last_verified_time'`).get() as { value: string } | undefined;
        const now = Date.now();

        if (lastVerified?.value) {
            const lastTime = parseInt(lastVerified.value, 10);
            // Allow 1 hour backward drift (timezone changes, DST, CMOS issues)
            const maxBackwardDrift = 60 * 60 * 1000; // 1 hour in ms

            if (now < lastTime - maxBackwardDrift) {
                console.warn('Time integrity check failed: clock appears to have been set backwards');
                return false;
            }
        }

        // Update last verified time
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('last_verified_time', ?)`).run(now.toString());
        return true;
    } catch {
        return true; // Don't block on errors
    }
}

// ============= LICENSE INTEGRITY VERIFICATION =============
/**
 * Generate an HMAC for stored license data to detect tampering.
 * Uses machine-specific secret to prevent copying between machines.
 */
function generateIntegrityHash(licenseKey: string, activatedAt: string): string {
    const machineId = generateMachineId();
    const secret = `${machineId}::SimpleLIMS::Integrity::v2`;
    return crypto.createHmac('sha256', secret)
        .update(`${licenseKey}::${activatedAt}`)
        .digest('hex');
}

/**
 * Verify the integrity of stored license data.
 */
export function verifyLicenseIntegrity(db: Database.Database): boolean {
    try {
        const licenseKey = db.prepare(`SELECT value FROM settings WHERE key = 'license_key'`).get() as { value: string } | undefined;
        const activatedAt = db.prepare(`SELECT value FROM settings WHERE key = 'license_activated_at'`).get() as { value: string } | undefined;
        const storedHash = db.prepare(`SELECT value FROM settings WHERE key = 'license_integrity_hash'`).get() as { value: string } | undefined;

        if (!licenseKey?.value || !activatedAt?.value || !storedHash?.value) {
            return false;
        }

        const expectedHash = generateIntegrityHash(licenseKey.value, activatedAt.value);
        return crypto.timingSafeEqual(
            Buffer.from(storedHash.value, 'hex'),
            Buffer.from(expectedHash, 'hex')
        );
    } catch {
        return false;
    }
}

// ============= LICENSE ACTIVATION =============
export interface ActivationResult {
    success: boolean;
    message: string;
    payload?: LicensePayload;
}

/**
 * Activate a license key.
 */
export function activateLicense(db: Database.Database, licenseKey: string): ActivationResult {
    try {
        // Step 1: Parse license format
        if (!licenseKey || !licenseKey.includes('.')) {
            return { success: false, message: '无效的许可证格式' };
        }

        const [payloadB64, signatureB64] = licenseKey.split('.');

        let payloadStr: string;
        let payload: LicensePayload;

        try {
            payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8');
            payload = JSON.parse(payloadStr);
        } catch {
            return { success: false, message: '许可证数据损坏' };
        }

        // Step 2: Verify signature
        const verify = crypto.createVerify('SHA256');
        verify.update(payloadStr);
        verify.end();

        let isValid: boolean;
        try {
            isValid = verify.verify(EMBEDDED_PUBLIC_KEY, signatureB64, 'base64');
        } catch {
            return { success: false, message: '签名验证失败' };
        }

        if (!isValid) {
            return { success: false, message: '许可证签名无效，可能是伪造的许可证' };
        }

        // Step 3: Verify machine ID (normalize for comparison)
        const currentMachineId = normalizeMachineId(generateMachineId());
        const payloadMachineId = normalizeMachineId(payload.machineId);

        if (payloadMachineId !== currentMachineId) {
            return {
                success: false,
                message: `许可证不属于此设备\n当前设备ID: ${formatMachineId(currentMachineId)}`
            };
        }

        // Step 4: Verify expiration
        const expiresAt = new Date(payload.expiresAt);
        const now = new Date();
        if (expiresAt < now) {
            return { success: false, message: '许可证已过期' };
        }

        // Step 5: Store license with integrity hash
        const activatedAt = new Date().toISOString();
        const integrityHash = generateIntegrityHash(licenseKey, activatedAt);
        const features = payload.features ?? LICENSE_FEATURES[payload.type] ?? 0;

        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_key', ?)`).run(licenseKey);
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_activated_at', ?)`).run(activatedAt);
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_type', ?)`).run(payload.type);
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_expires_at', ?)`).run(payload.expiresAt);
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_integrity_hash', ?)`).run(integrityHash);
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_features', ?)`).run(features.toString());

        if (payload.sn) {
            db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('license_sn', ?)`).run(payload.sn);
        }

        return {
            success: true,
            message: '许可证激活成功！',
            payload
        };

    } catch (err: any) {
        console.error('License activation error:', err);
        return { success: false, message: '激活失败: ' + err.message };
    }
}

/**
 * Activate from a .lic file
 */
export function activateFromFile(db: Database.Database, filePath: string): ActivationResult {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, message: '许可证文件不存在' };
        }

        const content = fs.readFileSync(filePath, 'utf-8').trim();

        // Try parsing as JSON first (structured license file)
        try {
            const licenseData = JSON.parse(content);
            if (licenseData.licenseKey) {
                return activateLicense(db, licenseData.licenseKey);
            }
        } catch {
            // Not JSON, treat as raw license key
        }

        // Treat as raw license key
        return activateLicense(db, content);
    } catch (err: any) {
        return { success: false, message: '读取许可证文件失败: ' + err.message };
    }
}

// ============= LICENSE STATUS =============
/**
 * Get the current license status.
 */
export function getLicenseStatus(db: Database.Database): LicenseStatus {
    const licenseKey = db.prepare(`SELECT value FROM settings WHERE key = 'license_key'`).get() as { value: string } | undefined;
    const activatedAt = db.prepare(`SELECT value FROM settings WHERE key = 'license_activated_at'`).get() as { value: string } | undefined;
    const licenseType = db.prepare(`SELECT value FROM settings WHERE key = 'license_type'`).get() as { value: string } | undefined;
    const expiresAt = db.prepare(`SELECT value FROM settings WHERE key = 'license_expires_at'`).get() as { value: string } | undefined;
    const featuresStr = db.prepare(`SELECT value FROM settings WHERE key = 'license_features'`).get() as { value: string } | undefined;

    // Get or set first run date for trial calculation
    let firstRunAt = db.prepare(`SELECT value FROM settings WHERE key = 'first_run_at'`).get() as { value: string } | undefined;
    if (!firstRunAt) {
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO settings (key, value) VALUES ('first_run_at', ?)`).run(now);
        firstRunAt = { value: now };
    }

    // Calculate trial status
    const firstRunDate = new Date(firstRunAt.value);
    const now = new Date();
    const diffMs = now.getTime() - firstRunDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const trialDuration = 30;
    const trialDaysRemaining = Math.max(0, trialDuration - diffDays);
    const isTrialExpired = diffDays > trialDuration;

    // Check license expiration
    let isLicenseExpired = false;
    if (expiresAt?.value) {
        isLicenseExpired = new Date(expiresAt.value) < now;
    }

    // Verify integrity
    const integrityValid = licenseKey?.value ? verifyLicenseIntegrity(db) : true;
    const timeIntegrityValid = checkTimeIntegrity(db);

    // Parse features
    const features = featuresStr?.value ? parseInt(featuresStr.value, 10) : LICENSE_FEATURES.trial;

    const machineId = generateMachineId();

    return {
        activated: !!licenseKey?.value && integrityValid && !isLicenseExpired && timeIntegrityValid,
        machineId,
        machineIdFormatted: formatMachineId(machineId),
        activatedAt: activatedAt?.value,
        licenseType: (licenseType?.value as LicenseStatus['licenseType']) || 'trial',
        expiresAt: expiresAt?.value,
        trialDaysRemaining,
        isTrialExpired,
        isLicenseExpired,
        firstRunAt: firstRunAt.value,
        features,
        integrityValid,
        timeIntegrityValid
    };
}

/**
 * Check if a specific feature is enabled
 */
export function hasFeature(db: Database.Database, feature: LicenseFeature): boolean {
    const status = getLicenseStatus(db);
    return (status.features & feature) !== 0;
}

// ============= ONLINE HEARTBEAT (OPTIONAL) =============
const HEARTBEAT_URL = 'https://api.simplelims.com/license/verify';

export interface HeartbeatResult {
    valid: boolean;
    message?: string;
    shouldBlock?: boolean;
}

/**
 * Optional online license verification.
 */
export async function verifyOnline(licenseKey: string): Promise<HeartbeatResult> {
    try {
        const machineId = generateMachineId();

        const response = await fetch(HEARTBEAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                licenseKey,
                machineId,
                appVersion: process.env.npm_package_version || '1.0.0',
                timestamp: new Date().toISOString()
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            return { valid: true, message: 'Network unavailable' };
        }

        const result = await response.json();
        return {
            valid: result.valid !== false,
            message: result.message,
            shouldBlock: result.revoked === true
        };

    } catch (error) {
        console.log('Online license verification skipped (offline mode)');
        return { valid: true, message: 'Offline mode' };
    }
}

// ============= LICENSE CHECK FOR APP STARTUP =============
/**
 * Check if the application should be allowed to run.
 */
export function canRunApplication(db: Database.Database): { allowed: boolean; reason: string; requiresActivation: boolean } {
    const status = getLicenseStatus(db);

    // Check time integrity first
    if (!status.timeIntegrityValid) {
        return {
            allowed: false,
            reason: '系统时间异常，请校正后重试',
            requiresActivation: false
        };
    }

    // Check activated license
    if (status.activated) {
        if (status.isLicenseExpired) {
            return { allowed: false, reason: '许可证已过期，请续费或联系技术支持', requiresActivation: true };
        }
        if (!status.integrityValid) {
            return { allowed: false, reason: '许可证数据已损坏，请重新激活', requiresActivation: true };
        }
        return { allowed: true, reason: '已激活', requiresActivation: false };
    }

    // Check trial period
    if (!status.isTrialExpired) {
        return {
            allowed: true,
            reason: `试用期剩余 ${status.trialDaysRemaining} 天`,
            requiresActivation: false
        };
    }

    return { allowed: false, reason: '试用期已结束，请激活许可证', requiresActivation: true };
}

// ============= GENERATE ACTIVATION URL =============
/**
 * Generate the activation URL for the user to visit
 */
export function getActivationUrl(baseUrl: string = 'https://lims.me'): string {
    const machineId = generateMachineId();
    return `${baseUrl}?mid=${formatMachineId(machineId)}`;
}
