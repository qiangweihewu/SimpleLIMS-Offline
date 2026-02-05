/**
 * SimpleLIMS License Activation API
 * 
 * POST /api/activate
 * 
 * Request body:
 * {
 *   "deviceCode": "K9P2-X5M8-A3B7",
 *   "serialNumber": "LIMS-2026-A7X9-P3M5",
 *   "captchaToken": "..." // Optional Cloudflare Turnstile token
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "licenseKey": "eyJtYWNoaW5lSWQiOiJLOVAyWDVNOEEzQjci...",
 *   "expiresAt": "2027-02-06T00:00:00Z",
 *   "type": "professional"
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign, createHash, createHmac } from 'crypto';
import { kv } from '@vercel/kv';

// ============= Configuration =============
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';
const MAX_ACTIVATIONS_PER_SN = 3;

// ============= Types =============
interface ActivationRequest {
    deviceCode: string;
    serialNumber: string;
    captchaToken?: string;
}

interface SNRecord {
    sn: string;
    type: 'trial' | 'professional' | 'enterprise';
    features: number;
    days: number;
    createdAt: string;
    activations: Array<{
        deviceCode: string;
        activatedAt: string;
        licenseExpiresAt: string;
    }>;
    revokedAt?: string;
    maxRebinds: number;
}

// ============= Feature Bitmask =============
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
    enterprise: 0xFF,
};

// ============= Rate Limiting =============
interface RateLimitEntry {
    count: number;
    firstAttempt: number;
    blocked: boolean;
    blockedUntil?: number;
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; message?: string }> {
    const key = `ratelimit:${ip}`;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour window
    const maxAttempts = 10;
    const blockDurationMs = 60 * 60 * 1000; // 1 hour block

    try {
        const entry = await kv.get<RateLimitEntry>(key);

        if (entry) {
            if (entry.blocked && entry.blockedUntil && now < entry.blockedUntil) {
                const remainingMinutes = Math.ceil((entry.blockedUntil - now) / 60000);
                return {
                    allowed: false,
                    message: `请求过于频繁，请 ${remainingMinutes} 分钟后再试`
                };
            }

            if (now - entry.firstAttempt > windowMs) {
                // Reset window
                await kv.set(key, { count: 1, firstAttempt: now, blocked: false }, { ex: 3600 });
            } else if (entry.count >= maxAttempts) {
                // Block the IP
                await kv.set(key, {
                    ...entry,
                    blocked: true,
                    blockedUntil: now + blockDurationMs
                }, { ex: 7200 });
                return { allowed: false, message: '请求过于频繁，请1小时后再试' };
            } else {
                // Increment count
                await kv.set(key, { ...entry, count: entry.count + 1 }, { ex: 3600 });
            }
        } else {
            await kv.set(key, { count: 1, firstAttempt: now, blocked: false }, { ex: 3600 });
        }

        return { allowed: true };
    } catch (err) {
        console.error('Rate limit check failed:', err);
        return { allowed: true }; // Allow on error to not block legitimate users
    }
}

// ============= Captcha Verification =============
async function verifyCaptcha(token: string): Promise<boolean> {
    if (!TURNSTILE_SECRET) return true; // Skip if not configured

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: TURNSTILE_SECRET,
                response: token
            })
        });

        const result = await response.json();
        return result.success === true;
    } catch {
        return false;
    }
}

// ============= License Generation =============
function normalizeMachineId(machineId: string): string {
    return machineId.replace(/-/g, '').toUpperCase();
}

function generateLicenseKey(
    machineId: string,
    sn: string,
    type: string,
    features: number,
    days: number
): { licenseKey: string; expiresAt: string } {
    if (!PRIVATE_KEY) {
        throw new Error('Private key not configured');
    }

    const issuedAt = new Date().toISOString();
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresAt = expires.toISOString();

    const payload = {
        machineId: normalizeMachineId(machineId),
        sn,
        type,
        features,
        expiresAt,
        issuedAt,
        maxRebinds: MAX_ACTIVATIONS_PER_SN
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64');

    // Sign the payload with RSA-SHA256
    const sign = createSign('SHA256');
    sign.update(payloadStr);
    sign.end();
    const signature = sign.sign(PRIVATE_KEY, 'base64');

    return {
        licenseKey: `${payloadB64}.${signature}`,
        expiresAt
    };
}

// ============= Main Handler =============
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

        // Rate limit check
        const rateLimit = await checkRateLimit(ip);
        if (!rateLimit.allowed) {
            return res.status(429).json({
                success: false,
                error: 'ERR_RATE_LIMITED',
                message: rateLimit.message
            });
        }

        const body = req.body as ActivationRequest;
        const { deviceCode, serialNumber, captchaToken } = body;

        // Validate input
        if (!deviceCode || !serialNumber) {
            return res.status(400).json({
                success: false,
                error: 'ERR_MISSING_FIELDS',
                message: '请提供设备码和序列号'
            });
        }

        // Verify captcha if configured
        if (TURNSTILE_SECRET && captchaToken) {
            const captchaValid = await verifyCaptcha(captchaToken);
            if (!captchaValid) {
                return res.status(400).json({
                    success: false,
                    error: 'ERR_CAPTCHA_FAILED',
                    message: '验证码校验失败'
                });
            }
        }

        // Normalize device code
        const normalizedDeviceCode = normalizeMachineId(deviceCode);

        // Look up serial number
        const snKey = `sn:${serialNumber.toUpperCase()}`;
        const snRecord = await kv.get<SNRecord>(snKey);

        if (!snRecord) {
            return res.status(404).json({
                success: false,
                error: 'ERR_INVALID_SN',
                message: '序列号无效'
            });
        }

        // Check if revoked
        if (snRecord.revokedAt) {
            return res.status(403).json({
                success: false,
                error: 'ERR_SN_REVOKED',
                message: '此序列号已被撤销'
            });
        }

        // Check if already activated for a different device
        const existingActivation = snRecord.activations.find(
            a => normalizeMachineId(a.deviceCode) !== normalizedDeviceCode
        );

        if (existingActivation && snRecord.activations.length >= snRecord.maxRebinds) {
            return res.status(403).json({
                success: false,
                error: 'ERR_MAX_REBINDS',
                message: `此序列号已绑定其他设备，已达到最大绑定次数 (${snRecord.maxRebinds})`
            });
        }

        // Check if this device already activated (return existing or regenerate)
        const thisDeviceActivation = snRecord.activations.find(
            a => normalizeMachineId(a.deviceCode) === normalizedDeviceCode
        );

        // Generate license
        const { licenseKey, expiresAt } = generateLicenseKey(
            normalizedDeviceCode,
            serialNumber,
            snRecord.type,
            snRecord.features,
            snRecord.days
        );

        // Update activation record
        if (!thisDeviceActivation) {
            snRecord.activations.push({
                deviceCode: normalizedDeviceCode,
                activatedAt: new Date().toISOString(),
                licenseExpiresAt: expiresAt
            });
            await kv.set(snKey, snRecord);
        }

        // Log activation
        console.log(`Activation: SN=${serialNumber}, Device=${normalizedDeviceCode}, IP=${ip}`);

        return res.status(200).json({
            success: true,
            licenseKey,
            expiresAt,
            type: snRecord.type,
            isNewActivation: !thisDeviceActivation
        });

    } catch (err: any) {
        console.error('Activation error:', err);
        return res.status(500).json({
            success: false,
            error: 'ERR_SERVER_ERROR',
            message: '服务器错误，请稍后再试'
        });
    }
}
