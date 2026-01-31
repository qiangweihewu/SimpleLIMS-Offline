# HL7 Implementation Quick Reference

## Files Added/Modified

| File | Purpose | Status |
|------|---------|--------|
| `electron/services/hl7-tcp-service.ts` | TCP/MLLP connection manager | ✅ New |
| `electron/services/hl7-parser.ts` | HL7 message parser (enhanced) | ✅ Enhanced |
| `electron/services/hl7-result-processor.ts` | Result processing & mapping | ✅ New |
| `electron/handlers/hl7-handler.ts` | IPC handler integration | ✅ New |
| `docs/HL7_ENHANCEMENT_GUIDE.md` | Full implementation guide | ✅ New |

## Quick Start: Setting Up HL7

### 1. Database Configuration
Add instrument entry to `instruments` table:
```sql
INSERT INTO instruments (name, model, protocol, connection_type, host, port, tcp_mode, is_active)
VALUES ('Roche Cobas e411', 'e411', 'hl7', 'tcp', '192.168.1.100', 2575, 'client', 1);
```

### 2. Test Code Mapping
Configure in `instrument_test_mappings` table:
```sql
INSERT INTO instrument_test_mappings (instrument_id, instrument_code, panel_id, conversion_factor)
VALUES 
  (1, 'WBC', 5, 1.0),      -- Maps to test_panels.id=5
  (1, 'RBC', 6, 1.0),
  (1, 'GLU', 20, 1.0);
```

### 3. Initialize in Main Process
```typescript
import { setupHL7Handlers } from './handlers/hl7-handler.js';

// In main.ts or app initialization
setupHL7Handlers(database);
```

### 4. Trigger Connection from Frontend
```typescript
// Call from React component
window.electronAPI.invoke('hl7:connect', instrumentId, {
  host: '192.168.1.100',
  port: 2575,
  mode: 'client'
});
```

## API Reference

### `hl7TcpService.connect(instrumentId, config)`
Establish TCP connection (client or server mode)
- **Returns**: `Promise<boolean>`
- **Events**: `connected`, `error`

### `hl7TcpService.disconnect(key)`
Close connection and clean up
- **Returns**: `Promise<void>`
- **Events**: `disconnected`

### `hl7TcpService.on('message', handler)`
Receive parsed HL7 message
```typescript
handler(event: {
  instrumentId: number;
  message: HL7Message;
  raw: string;
  timestamp: string;
})
```

### `HL7ResultProcessor.processMessage(message, mappings)`
Extract results from parsed message
- **Returns**: `ProcessedHL7Message` with mapped test codes
- **Throws**: Validation error if mapping missing

### `parseHL7Message(raw: string)`
Parse HL7 text into structured message
- **Returns**: `HL7Message`
- **Throws**: Only on MSH parse failure; other segments are tolerant

## Common Patterns

### Pattern 1: Connect & Listen (Server Mode)
```typescript
// Instrument connects to us
hl7TcpService.connect(instrumentId, {
  port: 2575,
  mode: 'server'
});

hl7TcpService.on('message', async (event) => {
  const processed = HL7ResultProcessor.processMessage(
    event.message,
    await getTestMappings(event.instrumentId)
  );
  await saveResults(processed);
});
```

### Pattern 2: Connect & Query (Client Mode)
```typescript
// We connect to instrument's LIS
await hl7TcpService.connect(instrumentId, {
  host: 'instrument.local',
  port: 2575,
  mode: 'client'
});

// Send query (e.g., ADT lookup)
await hl7TcpService.sendHL7Message(key, queryMessage);

// Receive response
hl7TcpService.on('message', handler);
```

### Pattern 3: Error Recovery
```typescript
hl7TcpService.on('error', (event) => {
  console.error(`Instrument ${event.instrumentId} error:`, event.error);
  // UI should show alert and offer retry
});

// Auto-reconnection is built-in for client mode
// Config: { reconnectInterval: 5000 } (default)
```

## Value Type Mapping

| HL7 Type | Example | Parsed As | Notes |
|----------|---------|-----------|-------|
| NM | "8.5" | `8.5` (number) | Numeric |
| ST | "Positive" | `"Positive"` (string) | String |
| TX | "Long text..." | `"Long text..."` (string) | Text |
| CE | "GLU^Glucose" | `"GLU^Glucose"` (string) | Coded, needs mapping |
| CWE | "POS^Positive" | `"POS^Positive"` (string) | Coded with exceptions |
| SN | "^8.5^" | `8.5` (number) | Structured numeric |
| DT | "20260129" | `"20260129"` (string) | Date (ISO) |
| TM | "120000" | `"120000"` (string) | Time (24hr) |

## Reference Range Parsing

| Format | Parsed Low | Parsed High | Notes |
|--------|-----------|------------|-------|
| "4.0-10.0" | 4.0 | 10.0 | Standard range |
| "100-200" | 100 | 200 | Integer range |
| ">0.5" | null | null | Operators not supported yet |
| "" (empty) | null | null | Returns null |

## Abnormal Flag Normalization

| Input | Normalized | Standard |
|-------|-----------|----------|
| "H", "HIGH", ">" | "H" | High |
| "L", "LOW", "<" | "L" | Low |
| "HH", "CRITICAL HIGH", ">>" | "HH" | Critical High |
| "LL", "CRITICAL LOW", "<<" | "LL" | Critical Low |
| "N", "NORMAL" | "N" | Normal |

## Troubleshooting

### "No MSH segment found"
- Ensure message starts with `MSH|^~\&|...`
- Check for character encoding issues
- Verify line endings are handled correctly

### "No mapping found for test code"
- Add entry to `instrument_test_mappings` table
- Check instrument code matches exactly (case-sensitive)
- Verify `panel_id` points to valid test panel

### Connection drops unexpectedly
- **Client mode**: Check `reconnectInterval` config (default 5s)
- **Server mode**: Instrument may timeout; adjust instrument settings
- Enable detailed logging: `[HL7TCP]` prefix in console

### Large message timeout
- Increase `timeout` config (default 30000ms)
- Check network MTU size
- Verify instrument isn't sending in fragments

## Performance Tips

1. **Test Mapping Cache**: Load once at startup, refresh on config change
2. **Batch Processing**: Buffer multiple messages for bulk insert
3. **Connection Pooling**: One connection per instrument (server handles multiple clients)
4. **Memory**: Each connection ~1KB buffer + message overhead
5. **CPU**: Parsing is fast (~1-5ms per message); focus on I/O bottlenecks

## Logging

All HL7 components use `[HL7...]` prefix for easy filtering:
```
[HL7TCP] Client connected...
[HL7Parser] Error parsing OBX segment...
[HL7Handler] Processing error...
```

Enable detailed logging in production for debugging:
```bash
DEBUG=hl7:* npm start
```

## Next: Frontend Integration

See `src/components/instruments/InstrumentSetupWizard.tsx` for UI:
- Add HL7 protocol option
- Configure host/port for TCP
- Select server vs client mode
- Real-time status display

## References

- Full Guide: `docs/HL7_ENHANCEMENT_GUIDE.md`
- Parser Tests: See `hl7-parser.ts` JSDoc examples
- Schema: `electron/database/schema.ts` (instruments table)
