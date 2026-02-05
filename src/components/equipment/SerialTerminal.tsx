import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    Terminal, Play, Square, RefreshCw, Trash2, Download,
    AlertTriangle, Search, Zap, Copy
} from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
    timestamp: Date;
    type: 'rx' | 'tx' | 'info' | 'error' | 'status' | 'match';
    content: string;
    matchedPattern?: string;
}

interface PatternRule {
    id: string;
    name: string;
    pattern: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
    enabled: boolean;
}

// Predefined error code patterns for common medical equipment
const DEFAULT_PATTERNS: PatternRule[] = [
    {
        id: 'error_generic',
        name: 'Generic Error Code',
        pattern: '(?:Error|ERR|FAULT|ALARM)\\s*[:\\s]?\\s*(\\w+\\d+|\\d+)',
        severity: 'critical',
        description: 'Matches common error code formats like Error E01, ERR 302, FAULT:001',
        enabled: true
    },
    {
        id: 'voltage_warning',
        name: 'Voltage Warning',
        pattern: '(?:VOLTAGE|V)\\s*[:<>=]?\\s*([0-9.]+)\\s*(?:V|VOLT)?',
        severity: 'warning',
        description: 'Captures voltage readings from equipment output',
        enabled: true
    },
    {
        id: 'temperature',
        name: 'Temperature Reading',
        pattern: '(?:TEMP|T)\\s*[:<>=]?\\s*([0-9.]+)\\s*(?:C|°C|F)?',
        severity: 'info',
        description: 'Captures temperature values from equipment',
        enabled: true
    },
    {
        id: 'pressure',
        name: 'Pressure Reading',
        pattern: '(?:PRESSURE|P|PSI|BAR)\\s*[:<>=]?\\s*([0-9.]+)',
        severity: 'info',
        description: 'Captures pressure readings',
        enabled: true
    },
    {
        id: 'boot_fail',
        name: 'Boot/Init Failure',
        pattern: '(?:BOOT|INIT|START).*(?:FAIL|ERROR|ABORT)',
        severity: 'critical',
        description: 'Detects boot or initialization failures',
        enabled: true
    },
    {
        id: 'checksum',
        name: 'Checksum/CRC Error',
        pattern: '(?:CHECKSUM|CRC|PARITY)\\s*(?:ERROR|FAIL|MISMATCH)',
        severity: 'warning',
        description: 'Detects data integrity errors',
        enabled: true
    }
];

export function SerialTerminal() {
    const { t } = useTranslation();
    const [ports, setPorts] = useState<any[]>([]);
    const [selectedPort, setSelectedPort] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [patterns, setPatterns] = useState<PatternRule[]>(DEFAULT_PATTERNS);
    const [newPatternInput, setNewPatternInput] = useState('');
    const [filterText, setFilterText] = useState('');
    const [showOnlyMatches, setShowOnlyMatches] = useState(false);

    // Connection settings
    const [baudRate, setBaudRate] = useState('9600');
    const [dataBits, setDataBits] = useState('8');
    const [parity, setParity] = useState('none');
    const [stopBits, setStopBits] = useState('1');

    const scrollRef = useRef<HTMLDivElement>(null);
    const logCountRef = useRef(0);

    useEffect(() => {
        loadPorts();
        loadSavedPatterns();

        const removeDataListener = window.electronAPI.instrument.onData((data: any) => {
            if (typeof data === 'object' && data.path && selectedPort && data.path !== selectedPort) return;
            const content = typeof data === 'string' ? data : (data.raw || JSON.stringify(data));
            addLog('rx', content);
        });

        const removeStatusListener = window.electronAPI.instrument.onStatus((status: any) => {
            if (status.path === selectedPort) {
                if (status.status === 'connected') setIsConnected(true);
                if (status.status === 'disconnected') setIsConnected(false);
                addLog('status', `Status: ${status.status}`);
            }
        });

        return () => {
            if (typeof removeDataListener === 'function') removeDataListener();
            if (typeof removeStatusListener === 'function') removeStatusListener();
        };
    }, [selectedPort]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            const scrollableNode = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollableNode) {
                scrollableNode.scrollTop = scrollableNode.scrollHeight;
            }
        }
    }, [logs]);

    const loadPorts = async () => {
        setLoading(true);
        try {
            const availablePorts = await window.electronAPI.instrument.listPorts();
            setPorts(availablePorts);
            const virtual = availablePorts.find((p: any) => p.path.startsWith('VIRTUAL'));
            if (virtual && !selectedPort) {
                setSelectedPort(virtual.path);
            }
        } catch (err) {
            console.error('Failed to list ports', err);
            addLog('error', 'Failed to list serial ports');
        } finally {
            setLoading(false);
        }
    };

    const loadSavedPatterns = async () => {
        try {
            const saved = localStorage.getItem('serial_patterns');
            if (saved) {
                setPatterns(JSON.parse(saved));
            }
        } catch (err) {
            console.error('Failed to load saved patterns');
        }
    };

    const savePatterns = (newPatterns: PatternRule[]) => {
        setPatterns(newPatterns);
        localStorage.setItem('serial_patterns', JSON.stringify(newPatterns));
    };

    const checkPatterns = useCallback((content: string): { matched: boolean; pattern?: PatternRule } => {
        for (const rule of patterns) {
            if (!rule.enabled) continue;
            try {
                const regex = new RegExp(rule.pattern, 'gi');
                if (regex.test(content)) {
                    return { matched: true, pattern: rule };
                }
            } catch (err) {
                console.error(`Invalid regex pattern: ${rule.pattern}`);
            }
        }
        return { matched: false };
    }, [patterns]);

    const addLog = useCallback((type: LogEntry['type'], content: string) => {
        logCountRef.current++;
        const { matched, pattern } = checkPatterns(content);

        const entry: LogEntry = {
            timestamp: new Date(),
            type: matched ? 'match' : type,
            content,
            matchedPattern: pattern?.name
        };

        setLogs(prev => [...prev.slice(-499), entry]);

        // Show toast for critical matches
        if (matched && pattern?.severity === 'critical') {
            toast.error(`${pattern.name}: ${content.slice(0, 100)}`, {
                description: pattern.description,
                duration: 10000
            });
        } else if (matched && pattern?.severity === 'warning') {
            toast.warning(`${pattern.name}: ${content.slice(0, 80)}`, { duration: 5000 });
        }
    }, [checkPatterns]);

    const handleConnect = async () => {
        if (!selectedPort) return;
        setLoading(true);
        try {
            addLog('info', `Connecting to ${selectedPort} (${baudRate} baud)...`);
            await window.electronAPI.instrument.connect(selectedPort, {
                instrumentId: 9999,
                baudRate: parseInt(baudRate),
                dataBits: parseInt(dataBits) as 7 | 8,
                parity: parity as 'none' | 'even' | 'odd',
                stopBits: parseFloat(stopBits) as 1 | 1.5 | 2
            });
            setIsConnected(true);
            addLog('info', 'Connected successfully');
        } catch (err: any) {
            addLog('error', `Connection failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!selectedPort) return;
        setLoading(true);
        try {
            await window.electronAPI.instrument.disconnect(selectedPort);
            setIsConnected(false);
            addLog('info', 'Disconnected');
        } catch (err: any) {
            addLog('error', `Disconnect failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const exportLogs = () => {
        const content = logs.map(log =>
            `[${format(log.timestamp, 'yyyy-MM-dd HH:mm:ss.SSS')}] [${log.type.toUpperCase()}] ${log.content}`
        ).join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `serial_log_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('equipment.terminal.export_success'));
    };

    const clearLogs = () => {
        setLogs([]);
        logCountRef.current = 0;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(t('equipment.terminal.copied'));
    };

    const filteredLogs = logs.filter(log => {
        if (showOnlyMatches && log.type !== 'match') return false;
        if (filterText && !log.content.toLowerCase().includes(filterText.toLowerCase())) return false;
        return true;
    });

    const matchCount = logs.filter(l => l.type === 'match').length;

    return (
        <Card className="h-[700px] flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-base font-medium">{t('equipment.terminal.title')}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {matchCount > 0 && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {matchCount} {t('equipment.terminal.matches')}
                            </Badge>
                        )}
                        <Badge variant={isConnected ? "default" : "secondary"}>
                            {isConnected ? t('equipment.terminal.connected') : t('equipment.terminal.disconnected')}
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                <Tabs defaultValue="terminal" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="self-start">
                        <TabsTrigger value="terminal">{t('equipment.terminal.console')}</TabsTrigger>
                        <TabsTrigger value="patterns">{t('equipment.terminal.patterns')}</TabsTrigger>
                        <TabsTrigger value="settings">{t('equipment.terminal.settings')}</TabsTrigger>
                    </TabsList>

                    {/* Terminal Console */}
                    <TabsContent value="terminal" className="flex-1 flex flex-col gap-4 overflow-hidden mt-4">
                        {/* Connection Controls */}
                        <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 rounded-lg border">
                            <div className="grid gap-1.5 min-w-[180px]">
                                <Label className="text-xs">{t('equipment.terminal.port')}</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedPort} onValueChange={setSelectedPort} disabled={isConnected}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder={t('equipment.terminal.select_port')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ports.map((port: any) => (
                                                <SelectItem key={port.path} value={port.path}>
                                                    <span className="font-medium">{port.path}</span>
                                                    {port.manufacturer && <span className="text-gray-400 ml-2">({port.manufacturer})</span>}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" onClick={loadPorts} disabled={isConnected}>
                                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-1.5 w-24">
                                <Label className="text-xs">{t('equipment.terminal.baud')}</Label>
                                <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['9600', '19200', '38400', '57600', '115200'].map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                {!isConnected ? (
                                    <Button onClick={handleConnect} disabled={!selectedPort || loading}>
                                        <Play className="h-4 w-4 mr-2" />
                                        {t('equipment.terminal.connect')}
                                    </Button>
                                ) : (
                                    <Button onClick={handleDisconnect} variant="destructive" disabled={loading}>
                                        <Square className="h-4 w-4 mr-2" />
                                        {t('equipment.terminal.disconnect')}
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1" />

                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={exportLogs} title={t('equipment.terminal.export')}>
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={clearLogs} className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder={t('equipment.terminal.filter')}
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button
                                variant={showOnlyMatches ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowOnlyMatches(!showOnlyMatches)}
                            >
                                <Zap className="h-4 w-4 mr-2" />
                                {t('equipment.terminal.only_matches')}
                            </Button>
                            <span className="text-sm text-gray-500">
                                {filteredLogs.length} / {logs.length} {t('equipment.terminal.entries')}
                            </span>
                        </div>

                        {/* Console Output */}
                        <div className="flex-1 rounded-md border bg-gray-900 p-4 font-mono text-sm overflow-hidden flex flex-col shadow-inner">
                            <ScrollArea className="flex-1" ref={scrollRef}>
                                <div className="space-y-1">
                                    {filteredLogs.length === 0 && (
                                        <div className="text-gray-500 italic text-center py-8">
                                            {t('equipment.terminal.waiting')}
                                        </div>
                                    )}
                                    {filteredLogs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={`flex gap-2 break-all group hover:bg-white/5 px-1 rounded ${log.type === 'match' ? 'bg-red-900/30 border-l-2 border-red-500' : ''
                                                }`}
                                        >
                                            <span className="text-gray-500 shrink-0 select-none">
                                                [{format(log.timestamp, 'HH:mm:ss.SSS')}]
                                            </span>
                                            <span className={`flex-1 ${log.type === 'rx' ? 'text-green-400' : ''
                                                }${log.type === 'tx' ? 'text-blue-400' : ''
                                                }${log.type === 'error' ? 'text-red-400' : ''
                                                }${log.type === 'info' ? 'text-yellow-400' : ''
                                                }${log.type === 'status' ? 'text-gray-400' : ''
                                                }${log.type === 'match' ? 'text-red-300 font-semibold' : ''
                                                }`}>
                                                {log.type === 'rx' ? '◀ ' : log.type === 'tx' ? '▶ ' : ''}
                                                {log.content}
                                                {log.matchedPattern && (
                                                    <span className="ml-2 text-xs bg-red-500/30 px-1 rounded">
                                                        {log.matchedPattern}
                                                    </span>
                                                )}
                                            </span>
                                            <button
                                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white"
                                                onClick={() => copyToClipboard(log.content)}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </TabsContent>

                    {/* Pattern Rules Tab */}
                    <TabsContent value="patterns" className="flex-1 overflow-auto mt-4">
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">{t('equipment.terminal.patterns_desc')}</p>

                            {patterns.map((rule) => (
                                <Card key={rule.id} className={`${!rule.enabled ? 'opacity-50' : ''}`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">{rule.name}</h4>
                                                    <Badge variant={
                                                        rule.severity === 'critical' ? 'destructive' :
                                                            rule.severity === 'warning' ? 'secondary' : 'outline'
                                                    }>
                                                        {rule.severity}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block font-mono">
                                                    {rule.pattern}
                                                </code>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const updated = patterns.map(p =>
                                                        p.id === rule.id ? { ...p, enabled: !p.enabled } : p
                                                    );
                                                    savePatterns(updated);
                                                }}
                                            >
                                                {rule.enabled ? t('equipment.terminal.disable') : t('equipment.terminal.enable')}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Card className="border-dashed">
                                <CardContent className="p-4">
                                    <h4 className="font-medium mb-2">{t('equipment.terminal.add_pattern')}</h4>
                                    <div className="grid gap-3">
                                        <Input
                                            placeholder="Pattern name"
                                            id="new-pattern-name"
                                        />
                                        <Input
                                            placeholder="Regular expression (e.g., Error\\s+\\d+)"
                                            value={newPatternInput}
                                            onChange={(e) => setNewPatternInput(e.target.value)}
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const nameInput = document.getElementById('new-pattern-name') as HTMLInputElement;
                                                if (newPatternInput && nameInput?.value) {
                                                    const newRule: PatternRule = {
                                                        id: `custom_${Date.now()}`,
                                                        name: nameInput.value,
                                                        pattern: newPatternInput,
                                                        severity: 'warning',
                                                        description: 'Custom pattern',
                                                        enabled: true
                                                    };
                                                    savePatterns([...patterns, newRule]);
                                                    setNewPatternInput('');
                                                    nameInput.value = '';
                                                    toast.success(t('equipment.terminal.pattern_added'));
                                                }
                                            }}
                                        >
                                            {t('equipment.terminal.add_pattern')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Connection Settings Tab */}
                    <TabsContent value="settings" className="mt-4">
                        <div className="grid grid-cols-2 gap-4 max-w-md">
                            <div className="space-y-2">
                                <Label>{t('equipment.terminal.baud')}</Label>
                                <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['9600', '19200', '38400', '57600', '115200'].map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('equipment.terminal.data_bits')}</Label>
                                <Select value={dataBits} onValueChange={setDataBits} disabled={isConnected}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="7">7</SelectItem>
                                        <SelectItem value="8">8</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('equipment.terminal.parity')}</Label>
                                <Select value={parity} onValueChange={setParity} disabled={isConnected}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="even">Even</SelectItem>
                                        <SelectItem value="odd">Odd</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('equipment.terminal.stop_bits')}</Label>
                                <Select value={stopBits} onValueChange={setStopBits} disabled={isConnected}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
