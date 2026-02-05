/**
 * License Management Web Server
 * 
 * A simple Express server for generating and managing licenses.
 * Run with: npx tsx scripts/license-server.ts
 * 
 * Endpoints:
 *   GET  /                     - Admin dashboard
 *   POST /api/generate         - Generate a new license
 *   GET  /api/licenses         - List all generated licenses
 *   POST /api/revoke/:id       - Revoke a license
 */

import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

// Load private key
const privateKeyPath = path.resolve(__dirname, 'private_key.pem');
if (!fs.existsSync(privateKeyPath)) {
    console.error('❌ Private key not found. Run this from the scripts directory.');
    process.exit(1);
}
const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

// Simple file-based license database
const licensesDbPath = path.resolve(__dirname, 'licenses.json');
interface LicenseRecord {
    id: string;
    machineId: string;
    customerEmail: string;
    customerName: string;
    type: 'trial' | 'professional' | 'enterprise';
    days: number;
    issuedAt: string;
    expiresAt: string;
    licenseKey: string;
    revoked: boolean;
}

function loadLicenses(): LicenseRecord[] {
    if (!fs.existsSync(licensesDbPath)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(licensesDbPath, 'utf-8'));
}

function saveLicenses(licenses: LicenseRecord[]): void {
    fs.writeFileSync(licensesDbPath, JSON.stringify(licenses, null, 2));
}

function generateLicense(
    machineId: string,
    days: number,
    type: 'trial' | 'professional' | 'enterprise'
): string {
    const issuedAt = new Date().toISOString();
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresAt = expires.toISOString();

    const payload = { machineId, type, expiresAt, issuedAt };
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64');

    const sign = crypto.createSign('SHA256');
    sign.update(payloadStr);
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    return `${payloadB64}.${signature}`;
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple auth (replace with proper authentication in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${ADMIN_PASSWORD}`) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// API Endpoints
app.post('/api/generate', requireAuth, (req, res) => {
    const { machineId, customerEmail, customerName, type = 'professional', days = 365 } = req.body;

    if (!machineId || !customerEmail) {
        return res.status(400).json({ error: 'machineId and customerEmail are required' });
    }

    // Validate machine ID format
    const machineIdPattern = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
    if (!machineIdPattern.test(machineId.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid Machine ID format' });
    }

    const licenseKey = generateLicense(machineId.toUpperCase(), days, type);

    const record: LicenseRecord = {
        id: crypto.randomUUID(),
        machineId: machineId.toUpperCase(),
        customerEmail,
        customerName: customerName || '',
        type,
        days,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
        licenseKey,
        revoked: false
    };

    const licenses = loadLicenses();
    licenses.push(record);
    saveLicenses(licenses);

    res.json({
        success: true,
        license: {
            id: record.id,
            machineId: record.machineId,
            licenseKey: record.licenseKey,
            expiresAt: record.expiresAt
        }
    });
});

app.get('/api/licenses', requireAuth, (req, res) => {
    const licenses = loadLicenses();
    res.json(licenses.map(l => ({
        ...l,
        licenseKey: l.licenseKey.substring(0, 20) + '...' // Truncate for display
    })));
});

app.post('/api/revoke/:id', requireAuth, (req, res) => {
    const licenses = loadLicenses();
    const license = licenses.find(l => l.id === req.params.id);

    if (!license) {
        return res.status(404).json({ error: 'License not found' });
    }

    license.revoked = true;
    saveLicenses(licenses);

    res.json({ success: true, message: 'License revoked' });
});

// Simple HTML dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimpleLIMS License Manager</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: 500; }
        input, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 4px; }
        .license-key { font-family: monospace; word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 4px; }
        .error { color: #dc3545; }
        .success { color: #28a745; }
    </style>
</head>
<body>
    <h1>🔐 SimpleLIMS License Manager</h1>
    
    <div class="form-group">
        <label>Admin Password:</label>
        <input type="password" id="password" placeholder="Enter admin password">
    </div>
    
    <hr>
    
    <h2>Generate New License</h2>
    <div class="form-group">
        <label>Machine ID:</label>
        <input type="text" id="machineId" placeholder="XXXX-XXXX-XXXX-XXXX" pattern="[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}">
    </div>
    <div class="form-group">
        <label>Customer Email:</label>
        <input type="email" id="customerEmail" placeholder="customer@example.com">
    </div>
    <div class="form-group">
        <label>Customer Name:</label>
        <input type="text" id="customerName" placeholder="Hospital Name / Customer Name">
    </div>
    <div class="form-group">
        <label>License Type:</label>
        <select id="type">
            <option value="professional">Professional (Standard)</option>
            <option value="enterprise">Enterprise (Full Features)</option>
            <option value="trial">Trial (Limited)</option>
        </select>
    </div>
    <div class="form-group">
        <label>Duration (days):</label>
        <input type="number" id="days" value="365" min="1">
    </div>
    <button onclick="generateLicense()">Generate License</button>
    
    <div id="result" class="result" style="display:none;"></div>

    <script>
        async function generateLicense() {
            const password = document.getElementById('password').value;
            const machineId = document.getElementById('machineId').value;
            const customerEmail = document.getElementById('customerEmail').value;
            const customerName = document.getElementById('customerName').value;
            const type = document.getElementById('type').value;
            const days = parseInt(document.getElementById('days').value);

            const resultDiv = document.getElementById('result');
            
            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + password
                    },
                    body: JSON.stringify({ machineId, customerEmail, customerName, type, days })
                });

                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = \`
                        <p class="success">✅ License generated successfully!</p>
                        <p><strong>Machine ID:</strong> \${data.license.machineId}</p>
                        <p><strong>Expires:</strong> \${new Date(data.license.expiresAt).toLocaleDateString()}</p>
                        <p><strong>License Key:</strong></p>
                        <div class="license-key">\${data.license.licenseKey}</div>
                        <button onclick="navigator.clipboard.writeText('\${data.license.licenseKey}'); alert('Copied!')">📋 Copy to Clipboard</button>
                    \`;
                } else {
                    resultDiv.innerHTML = \`<p class="error">❌ Error: \${data.error}</p>\`;
                }
                resultDiv.style.display = 'block';
            } catch (err) {
                resultDiv.innerHTML = \`<p class="error">❌ Network error: \${err.message}</p>\`;
                resultDiv.style.display = 'block';
            }
        }
    </script>
</body>
</html>
    `);
});

// Health check endpoint for online license verification
app.post('/license/verify', (req, res) => {
    const { licenseKey, machineId } = req.body;

    const licenses = loadLicenses();
    const license = licenses.find(l =>
        l.licenseKey === licenseKey &&
        l.machineId === machineId
    );

    if (!license) {
        return res.json({ valid: true }); // Unknown license, don't block offline usage
    }

    if (license.revoked) {
        return res.json({ valid: false, revoked: true, message: 'This license has been revoked' });
    }

    res.json({ valid: true });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           SimpleLIMS License Manager Server                   ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 Dashboard: http://localhost:${PORT}                         ║
║  🔑 API: http://localhost:${PORT}/api/generate                   ║
║                                                              ║
║  ⚠️  Set ADMIN_PASSWORD environment variable in production   ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
