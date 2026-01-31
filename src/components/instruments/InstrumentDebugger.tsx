
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, Square, RefreshCw, Terminal, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
    timestamp: Date;
    type: 'rx' | 'tx' | 'info' | 'error' | 'status';
    content: string;
}

export function InstrumentDebugger() {
    const { t } = useTranslation();
    const [ports, setPorts] = useState<any[]>([]);
    const [selectedPort, setSelectedPort] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadPorts();

        // Listen for data
        // Note: In a real app we might need to filter data by port if multiple are open, 
        // but here we just show everything for debug.

        const removeDataListener = window.electronAPI.instrument.onData((data: any) => {
            // Data might be: { instrumentId, path, data (string), ... }
            if (typeof data === 'object' && data.path && selectedPort && data.path !== selectedPort) return;

            const content = typeof data === 'string' ? data : (data.raw || JSON.stringify(data));
            addLog('rx', content);
        });

        const removeStatusListener = window.electronAPI.instrument.onStatus((status: any) => {
            // Status: { instrumentId, path, status }
            if (status.path === selectedPort) {
                if (status.status === 'connected') setIsConnected(true);
                if (status.status === 'disconnected') setIsConnected(false);
                addLog('status', t('instruments.debugger.status_changed', { status: status.status }));
            }
        });

        return () => {
            if (typeof removeDataListener === 'function') (removeDataListener as any)();
            if (typeof removeStatusListener === 'function') (removeStatusListener as any)();
        };
    }, [selectedPort]);

    // Auto-scroll logs
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
            // Auto-select virtual port if available
            const virtual = availablePorts.find((p: any) => p.path.startsWith('VIRTUAL'));
            if (virtual && !selectedPort) {
                setSelectedPort(virtual.path);
            }
        } catch (err) {
            console.error('Failed to list ports', err);
            addLog('error', 'Failed to list ports');
        } finally {
            setLoading(false);
        }
    };

    const addLog = (type: LogEntry['type'], content: string) => {
        setLogs(prev => [...prev.slice(-99), { timestamp: new Date(), type, content }]);
    };

    const handleConnect = async () => {
        if (!selectedPort) return;
        setLoading(true);
        try {
            addLog('info', `Connecting to ${selectedPort}...`);
            // Use a dummy instrument ID (e.g. 9999) for debugging without creating a DB record
            // Or 0. SerialService doesn't check DB, just passes ID back in events.
            await window.electronAPI.instrument.connect(selectedPort, {
                instrumentId: 9999, // Debug ID
                baudRate: 9600
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
            setSimulating(false);
            addLog('info', 'Disconnected');
        } catch (err: any) {
            addLog('error', `Disconnect failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSimulate = async () => {
        if (!isConnected) return;
        try {
            setSimulating(true);
            addLog('tx', 'Starting simulation sequence...');
            await window.electronAPI.instrument.simulate(selectedPort);
        } catch (err: any) {
            addLog('error', `Simulation failed: ${err.message}`);
            setSimulating(false);
        }
    };

    const clearLogs = () => setLogs([]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-gray-500" />
                        <CardTitle className="text-base font-medium">{t('instruments.debugger.title')}</CardTitle>
                    </div>
                    <Badge variant={isConnected ? "success" : "secondary"}>
                        {isConnected ? t('instruments.debugger.connected') : t('instruments.debugger.disconnected')}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                {/* Controls */}
                <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 rounded-lg border">
                    <div className="grid gap-1.5 flex-1 min-w-[200px]">
                        <label className="text-xs font-medium text-gray-500">Port</label>
                        <div className="flex gap-2">
                            <Select value={selectedPort} onValueChange={setSelectedPort} disabled={isConnected}>
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder={t('instruments.debugger.select_port', 'Select port')} />
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

                    <div className="flex gap-2">
                        {!isConnected ? (
                            <Button onClick={handleConnect} disabled={!selectedPort || loading} className="min-w-[100px]">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                {t('instruments.debugger.connect')}
                            </Button>
                        ) : (
                            <Button onClick={handleDisconnect} variant="destructive" disabled={loading} className="min-w-[100px]">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                                {t('instruments.debugger.disconnect')}
                            </Button>
                        )}
                    </div>

                    <div className="w-px h-8 bg-gray-300 mx-2" />

                    <Button
                        onClick={handleSimulate}
                        disabled={!isConnected || !selectedPort.includes('VIRTUAL') || simulating}
                        variant="secondary"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${simulating ? 'animate-spin' : ''}`} />
                        {t('instruments.debugger.simulate')}
                    </Button>

                    <Button variant="ghost" size="icon" onClick={clearLogs} className="ml-auto text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Console Log */}
                <div className="flex-1 rounded-md border bg-black p-4 font-mono text-sm overflow-hidden flex flex-col shadow-inner">
                    <ScrollArea className="flex-1" ref={scrollRef}>
                        <div className="space-y-1">
                            {logs.length === 0 && (
                                <div className="text-gray-600 italic text-center py-8">{t('instruments.debugger.ready')}</div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2 break-all">
                                    <span className="text-gray-600 shrink-0 select-none">
                                        [{format(log.timestamp, 'HH:mm:ss.SSS')}]
                                    </span>
                                    <span className={`
                    ${log.type === 'rx' ? 'text-green-400' : ''}
                    ${log.type === 'tx' ? 'text-blue-400' : ''}
                    ${log.type === 'error' ? 'text-red-400' : ''}
                    ${log.type === 'info' ? 'text-yellow-400' : ''}
                    ${log.type === 'status' ? 'text-gray-400' : ''}
                  `}>
                                        {log.type === 'rx' ? '<< ' : log.type === 'tx' ? '>> ' : ''}
                                        {log.content}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}
