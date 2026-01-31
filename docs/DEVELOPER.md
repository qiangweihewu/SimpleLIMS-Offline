# SimpleLIMS-Offline Developer Documentation

Technical documentation for maintaining, building, and extending SimpleLIMS-Offline.

## 1. Architecture Overview

SimpleLIMS-Offline is an Electron-based application built with specialized technologies for offline capability and hardware integration.

### Tech Stack
*   **Runtime**: [Electron](https://www.electronjs.org/) (Chromium + Node.js)
*   **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **UI Library**: [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/)
*   **Database**: [better-sqlite3-multiple-ciphers](https://github.com/m4heshd/better-sqlite3-multiple-ciphers) (Encrypted SQLite)
*   **Hardware**: SerialPort (RS232), TCP/IP (Net module)

### Directory Structure
```
SimpleLIMS-Offline/
├── electron/           # Main Process Code (Node.js)
│   ├── database/       # SQLite schema & migration logic
│   ├── services/       # Business logic (Serial, Audit, Backup)
│   ├── main.ts         # Entry point
│   └── preload.ts      # Context Bridge
├── src/                # Renderer Process Code (React)
│   ├── components/     # Reusable UI components
│   ├── pages/          # Application Routes
│   ├── hooks/          # React Hooks (useAuth, useSettings)
│   └── types/          # Shared TypeScript interfaces
├── scripts/            # Build & utility scripts
└── resources/          # Static assets for the build
```

---

## 2. Development Setup

### Prerequisites
*   Node.js v18+ (v20 Recommended)
*   Python 3 (for `node-gyp` native module compilation)
*   Xcode Command Line Tools (macOS) or Visual Studio Build Tools (Windows)

### Installation
```bash
# 1. Clone the repository
git clone <repository_url>
cd SimpleLIMS-Offline

# 2. Install dependencies
npm install

# 3. Rebuild native modules (Important for SQLite/SerialPort)
npm run rebuild
```

### Running Locally
```bash
npm run dev
```
This starts the Vite dev server and launches the Electron window. Hot Module Replacement (HMR) is active for the frontend.

---

## 3. Database & Security

### Schema Management
The database schema is defined in `electron/database/schema.sql`. It is automatically applied on application startup if the database is new.
Migrations are currently manual—edits to schema must be handled carefully in `initDatabase` inside `electron/database/index.ts`.

### Encryption
The database is encrypted using SQLCipher via `better-sqlite3-multiple-ciphers`.
*   **Key**: `simplelims-offline-secret-key` (Hardcoded in `database/index.ts` for MVP, should be externalized for production).
*   **WAL Mode**: Enabled for performance and concurrency.

---

## 4. Hardware Integration (Instruments)

### Architecture
Instruments are managed by `InstrumentDriverManager`.
1.  **Connection**: Handled by `SerialService` or `TcpService`.
2.  **Parsing**: Raw data is passed to `ASTMParser` or `HL7Parser` (planned).
3.  **Mapping**: Test codes (e.g., `WBC`) are mapped to internal `Panel IDs` via `instrument_test_mappings` table.

### Adding a New Driver
To add support for a new protocol/instrument:
1.  Create a parser in `electron/services/parsers/`.
2.  Register it in `InstrumentDriverManager`.
3.  Ensure the instrument can be selected in the frontend `InstrumentsPage`.

---

## 5. Building & Distribution

We use `electron-builder` to package the application.

### macOS Build
```bash
npm run build:mac
```
*   Output: `release/SimpleLIMS-Offline-x.y.z.dmg`
*   **Note**: Requires code signing identity or ad-hoc signing (configured in `package.json`).

### Windows Build
```bash
npm run build:win
```
*   Output: `release/SimpleLIMS-Offline-Setup-x.y.z.exe`
*   **Note**: Native modules must be compiled for Windows. Recommended to build on a Windows machine.

### License Generation
A standalone script is provided to generate license keys.
```bash
# Generate a key for a specific Machine ID
npx tsx scripts/generate-license.ts <machine-id> <days> <type>
```

---

## 6. IPC API Reference (Renderer -> Main)

The `window.electronAPI` object exposes safe methods.

| Namespace | Method | Description |
|-----------|--------|-------------|
| `auth` | `login(u, p)` | Verify credentials |
| `db` | `run(sql)` | Execute raw SQL (Protected, use services in logic) |
| `serial` | `listPorts()` | Get available COM ports |
| `license` | `activate(k)` | Activate license key |
| `system` | `checkInit()` | Check if system is initialized |

---

## 7. Troubleshooting

*   **Native Module Errors**: Run `npm run rebuild`. Ensure python and build tools are installed.
*   **White Screen on Launch**: Check console for React runtime errors.
*   **Database Locked**: Ensure no other process (like an external SQLite viewer) has the DB file open. All DB access is synchronous/WAL-enabled.

---

*SimpleLIMS-Offline Developer Docs*
