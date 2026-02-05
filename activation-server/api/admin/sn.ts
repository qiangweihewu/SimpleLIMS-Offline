/**
 * Serial Number Management API
 * 
 * POST /api/admin/sn/generate - Generate new serial numbers
 * GET /api/admin/sn/list - List all serial numbers
 * POST /api/admin/sn/revoke - Revoke a serial number
 * POST /api/admin/sn/unbind - Unbind a device from serial number
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { randomBytes } from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// ============= Types =============
interface SNRecord {
    sn: string;
    type: 'trial' | 'professional' | 'enterprise';
    features: number;
    days: number;
    createdAt: string;
    customerName?: string;
    customerEmail?: string;
    notes?: string;
    activations: Array<{
        deviceCode: string;
        activatedAt: string;
        licenseExpiresAt: string;
    }>;
    revokedAt?: string;
    maxRebinds: number;
}

// ============= Feature Bitmask =============
const LICENSE_FEATURES: Record<string, number> = {
    trial: 0b00000011,
    professional: 0b01011111,
    enterprise: 0xFF,
};

// ============= Auth Check =============
function checkAuth(req: VercelRequest): boolean {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }
    return authHeader.slice(7) === ADMIN_PASSWORD;
}

// ============= Generate Serial Number =============
function generateSN(): string {
    const bytes = randomBytes(6);
    const hex = bytes.toString('hex').toUpperCase();
    return `LIMS-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// ============= Main Handler =============
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Auth check
    if (!checkAuth(req)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { action } = req.query;

    try {
        switch (action) {
            case 'generate':
                return await handleGenerate(req, res);
            case 'list':
                return await handleList(req, res);
            case 'revoke':
                return await handleRevoke(req, res);
            case 'unbind':
                return await handleUnbind(req, res);
            case 'get':
                return await handleGet(req, res);
            default:
                return res.status(400).json({ success: false, error: 'Unknown action' });
        }
    } catch (err: any) {
        console.error('Admin API error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}

// ============= Generate SNs =============
async function handleGenerate(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const {
        count = 1,
        type = 'professional',
        days = 365,
        customerName,
        customerEmail,
        notes
    } = req.body;

    const features = LICENSE_FEATURES[type] || LICENSE_FEATURES.professional;
    const generatedSNs: string[] = [];

    for (let i = 0; i < Math.min(count, 100); i++) {
        const sn = generateSN();
        const record: SNRecord = {
            sn,
            type,
            features,
            days,
            createdAt: new Date().toISOString(),
            customerName,
            customerEmail,
            notes,
            activations: [],
            maxRebinds: 3
        };

        await kv.set(`sn:${sn}`, record);
        generatedSNs.push(sn);
    }

    return res.status(200).json({
        success: true,
        serialNumbers: generatedSNs,
        count: generatedSNs.length
    });
}

// ============= List SNs =============
async function handleList(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { offset = 0, limit = 50 } = req.query;

    // Get all SN keys
    const keys = await kv.keys('sn:*');
    const paginatedKeys = keys.slice(Number(offset), Number(offset) + Number(limit));

    const records: SNRecord[] = [];
    for (const key of paginatedKeys) {
        const record = await kv.get<SNRecord>(key);
        if (record) {
            records.push(record);
        }
    }

    return res.status(200).json({
        success: true,
        total: keys.length,
        offset: Number(offset),
        limit: Number(limit),
        records
    });
}

// ============= Get Single SN =============
async function handleGet(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { sn } = req.query;
    if (!sn) {
        return res.status(400).json({ success: false, error: 'Missing serial number' });
    }

    const record = await kv.get<SNRecord>(`sn:${String(sn).toUpperCase()}`);

    if (!record) {
        return res.status(404).json({ success: false, error: 'Serial number not found' });
    }

    return res.status(200).json({
        success: true,
        record
    });
}

// ============= Revoke SN =============
async function handleRevoke(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { serialNumber, reason } = req.body;
    if (!serialNumber) {
        return res.status(400).json({ success: false, error: 'Missing serial number' });
    }

    const snKey = `sn:${serialNumber.toUpperCase()}`;
    const record = await kv.get<SNRecord>(snKey);

    if (!record) {
        return res.status(404).json({ success: false, error: 'Serial number not found' });
    }

    record.revokedAt = new Date().toISOString();
    record.notes = `${record.notes || ''}\nRevoked: ${reason || 'No reason provided'}`.trim();

    await kv.set(snKey, record);

    return res.status(200).json({
        success: true,
        message: 'Serial number revoked'
    });
}

// ============= Unbind Device =============
async function handleUnbind(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { serialNumber, deviceCode, reason } = req.body;
    if (!serialNumber) {
        return res.status(400).json({ success: false, error: 'Missing serial number' });
    }

    const snKey = `sn:${serialNumber.toUpperCase()}`;
    const record = await kv.get<SNRecord>(snKey);

    if (!record) {
        return res.status(404).json({ success: false, error: 'Serial number not found' });
    }

    if (deviceCode) {
        // Unbind specific device
        const normalizedCode = deviceCode.replace(/-/g, '').toUpperCase();
        record.activations = record.activations.filter(
            a => a.deviceCode.replace(/-/g, '').toUpperCase() !== normalizedCode
        );
    } else {
        // Unbind all devices
        record.activations = [];
    }

    record.notes = `${record.notes || ''}\nUnbind: ${deviceCode || 'all'} - ${reason || 'No reason'}`.trim();

    await kv.set(snKey, record);

    return res.status(200).json({
        success: true,
        message: 'Device unbound successfully',
        remainingActivations: record.activations.length
    });
}
