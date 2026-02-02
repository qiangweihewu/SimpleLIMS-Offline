# Project Improvement Plan: Legacy Medical Device Integration

## Goal
Enable **SimpleLIMS-Offline** to seamlessly connect with, acquire data from, and manage legacy medical devices. This plan is tailored to the existing Electron architecture, maximizing code reuse while addressing critical gaps identified in industry reports (timestamp drift, semantic interoperability).

## Codebase Analysis & Reuse Strategy
*   **Existing Connectivity:** [electron/services/serial-service.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/serial-service.ts) and [tcp-service.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/tcp-service.ts) are robust and can be reused as the core foundation.
*   **Existing Parsers:** [astm-parser.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/astm-parser.ts) and [hl7-parser.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/hl7-parser.ts) are already implemented. We will extend them rather than rewrite.
*   **Driver Management:** [instrument-driver-manager.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/instrument-driver-manager.ts) handles JSON-based configs effectively. We will expand the JSON schema to support complex legacy mappings.

## Proposed Architecture

### 1. Device Access Layer (Electron Main Process)
*   **Reuse:** `SerialService`, `TcpService` for physical connections.
*   **New - `TimeSyncService`**: 
    *   Implements NTP client to fetch atomic time.
    *   Calculates drift and "tags" incoming data with `receipt_timestamp` to correct device clock errors (critical for legacy devices).
*   **New - `LegacyAdapterService`**: 
    *   Explicit guidance/config for **GPIB/LPT** devices using USB-to-Serial bridges.
    *   Treats them as "Virtual COM Ports" within the existing `SerialService` logic.

### 2. Data Processing & Protocol Layer
*   **Reuse:** [InstrumentDriverManager](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/instrument-driver-manager.ts#12-205) to load device capabilities.
*   **Enhancement - `HexStreamParser`**: 
    *   New parser for proprietary binary formats (e.g., Mindray hex streams) that `astm-parser` cannot handle.
    *   Will uses "Definition Files" (offset, length, type) to extract values.
*   **New - `SemanticMapper`**: 
    *   **Layer 1**: Maps raw device fields to **openEHR Archetypes** (intermediate normalized format).
    *   **Layer 2**: Converts Archetypes to **FHIR Resources** (e.g., `Observation`).
    *   *Why*: Decouples internal logic from specific device weirdness.

### 3. Application Layer (Renderer)
*   **Enhancement - Device Dashboard**: 
    *   Add "Signal Quality" and "Drift Offset" to the existing device status view.
*   **New - `RawTrafficLogger`**: 
    *   Extend [audit-service.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/audit-service.ts) to log **ALL** ingress raw byte streams to a secure `device_traffic_log` table (for forensics/debugging), distinct from the high-level audit log.

### 4. Security & Reliability
*   **Enhancement - Encryption**: 
    *   Integrate `SQLCipher` or field-level encryption for the `results` table (currently plain text SQLite).
*   **Reliability**: 
    *   Implement "Passive Listening" buffers in `SerialService` to handle unsolicited data bursts from older instruments.

## Roadmap & Priorities

### Phase 1: Foundation & Time Sync (Weeks 1-2)
*   [ ] Implement `TimeSyncService` to detect system clock drift.
*   [ ] Update `SerialService` to attach accurate timestamps to all incoming data events.
*   [ ] Enhancement: Add "Raw Data Logging" to [audit-service.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/audit-service.ts).

### Phase 2: Advanced Parsing (Weeks 3-4)
*   [ ] Create `HexStreamParser` for binary protocols.
*   [ ] Extend [InstrumentDriverManager](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/electron/services/instrument-driver-manager.ts#12-205) to support "Bitmask" and "Hex" rules in JSON drivers.
*   [ ] Verify **GPIB-to-USB** workflow with a mock virtual COM port.

### Phase 3: Semantic Interoperability (Weeks 5-6)
*   [ ] Implement `SemanticMapper` class.
*   [ ] Create standard **openEHR Archetypes** (JSON format) for:
    *   `Blood Pressure`
    *   `Hemogram` (CBC)
*   [ ] Update [database.service.ts](file:///Users/zachlai/www/coding/saas/SimpleLIMS-Offline/src/services/database.service.ts) to store/retrieve FHIR-compatible JSON blobs.

## Verification Plan
### Automated Tests
*   **Unit**: Test `HexStreamParser` with captured binary payloads.
*   **Integration**: Simulate a "drifting" device clock and verify `TimeSyncService` corrects the record time.

### Manual Verification
*   **Legacy Simulation**: Use `socat` to pipe a hex dump file (simulating an old MRI) to a virtual serial port and verify correct parsing.
