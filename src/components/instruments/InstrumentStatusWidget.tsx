/**
 * Instrument Status Widget Component
 * Real-time display of connected instruments with live status updates
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Zap,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface InstrumentStatusWidgetProps {
  instrumentId?: number;
  compact?: boolean;
  onDetailsClick?: (instrumentId: number) => void;
}

interface InstrumentWithStatus {
  id: number;
  name: string;
  protocol: string;
  connection_type: string;
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastActivity?: Date;
  messagesReceived?: number;
  errorMessage?: string;
  isMonitoring?: boolean;
}

export function InstrumentStatusWidget({
  instrumentId,
  compact = false,
  onDetailsClick
}: InstrumentStatusWidgetProps) {
  const { t } = useTranslation();
  const [instruments, setInstruments] = useState<InstrumentWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize: fetch instruments and their statuses
    loadInstruments();

    // Setup IPC listeners for real-time updates
    const unlisteners: (() => void)[] = [];

    if (window.electronAPI?.on) {
      // Listen for HL7 connection events via IPC
      const unlistenConnected = window.electronAPI.on('instrument:connected', (data: any) => {
        console.log('[InstrumentStatusWidget] Instrument connected:', data);
        updateInstrumentStatus(data.instrumentId, 'connected');
        toast.success(t('instruments.connected', 'Instrument connected'));
      });

      const unlistenDisconnected = window.electronAPI.on('instrument:disconnected', (data: any) => {
        console.log('[InstrumentStatusWidget] Instrument disconnected:', data);
        updateInstrumentStatus(data.instrumentId, 'disconnected');
        toast.info(t('instruments.disconnected', 'Instrument disconnected'));
      });

      const unlistenError = window.electronAPI.on('instrument:error', (data: any) => {
        console.error('[InstrumentStatusWidget] Instrument error:', data);
        updateInstrumentStatus(data.instrumentId, 'error', data.error);
        toast.error(t('instruments.error', `Error: ${data.error}`));
      });

      const unlistenClientConnected = window.electronAPI.on('instrument:clientConnected', (data: any) => {
        console.log('[InstrumentStatusWidget] Client connected:', data);
        updateInstrumentStatus(data.instrumentId, 'connected');
        toast.success(t('instruments.connected', `Client connected from ${data.remoteAddress}`));
      });

      const unlistenClientDisconnected = window.electronAPI.on('instrument:clientDisconnected', (data: any) => {
        console.log('[InstrumentStatusWidget] Client disconnected:', data);
        // For server mode, don't mark as fully disconnected
        setInstruments(prev =>
          prev.map(i =>
            i.id === data.instrumentId
              ? { ...i, lastActivity: new Date() }
              : i
          )
        );
      });

      unlisteners.push(unlistenConnected, unlistenDisconnected, unlistenError, unlistenClientConnected, unlistenClientDisconnected);
    }

    // Cleanup
    return () => {
      unlisteners.forEach(fn => fn?.());
    };
  }, [t]);

  const loadInstruments = async () => {
    try {
      setLoading(true);
      if (window.electronAPI?.db?.query) {
        // Query instruments from database
        const data = await window.electronAPI.db.query('SELECT id, name, protocol, connection_type FROM instruments');
        // Map to status format
        const withStatus = (data || []).map((instr: any) => ({
          id: instr.id,
          name: instr.name,
          protocol: instr.protocol,
          connection_type: instr.connection_type,
          status: 'disconnected' as const,
          messagesReceived: 0,
          isMonitoring: false,
        }));
        setInstruments(withStatus);
      }
    } catch (error) {
      console.error('[InstrumentStatusWidget] Error loading instruments:', error);
      // Don't show toast on initial load - just log
      console.warn('[InstrumentStatusWidget] Instruments table might not exist yet');
    } finally {
      setLoading(false);
    }
  };

  const updateInstrumentStatus = (
    id: number,
    newStatus: 'connected' | 'disconnected' | 'error' | 'reconnecting',
    errorMsg?: string
  ) => {
    setInstruments(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, status: newStatus, errorMessage: errorMsg, lastActivity: new Date() }
          : i
      )
    );
  };

  const handleToggleMonitoring = async (id: number, shouldMonitor: boolean) => {
    try {
      if (shouldMonitor) {
        // Trigger connection via IPC
        const instr = instruments.find(i => i.id === id);
        if (instr) {
          await window.electronAPI?.ipc?.invoke?.('hl7:connect', id, {
            port: 9001, // Default HL7 port, would be configured
            mode: 'server',
          });
        }
        toast.success(t('instruments.monitoring_started'));
      } else {
        await window.electronAPI?.ipc?.invoke?.('hl7:disconnect', `${id}`);
        toast.success(t('instruments.monitoring_stopped'));
      }

      setInstruments(prev =>
        prev.map(i =>
          i.id === id ? { ...i, isMonitoring: shouldMonitor } : i
        )
      );
    } catch (error) {
      console.error('[InstrumentStatusWidget] Toggle monitoring error:', error);
      toast.error(t('common.error'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return t('instruments.status.connected');
      case 'disconnected':
        return t('instruments.status.disconnected');
      case 'error':
        return t('instruments.status.error');
      case 'reconnecting':
        return t('instruments.status.reconnecting');
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.instrument_status', 'Instrument Status')}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (instruments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.instrument_status', 'Instrument Status')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 p-6 text-gray-500 border border-dashed rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">{t('dashboard.no_instruments', 'No Instruments')}</p>
              <p className="text-sm">{t('dashboard.configure_instruments', 'Configure instruments in settings')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredInstruments = instrumentId
    ? instruments.filter(i => i.id === instrumentId)
    : instruments;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {t('dashboard.instrument_status', 'Instrument Status')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {filteredInstruments.map(instr => (
            <div
              key={instr.id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer"
              onClick={() => onDetailsClick?.(instr.id)}
            >
              {/* Header with status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(instr.status)}`} />
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{instr.name}</h4>
                    <p className="text-xs text-gray-500">{instr.protocol.toUpperCase()}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleMonitoring(instr.id, !instr.isMonitoring);
                  }}
                  className="h-6 w-6 p-0"
                >
                  {instr.isMonitoring ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>

              {/* Status info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('instruments.form.connection_type')}</span>
                  <span className="font-medium text-gray-700">{t(`instruments.connections.${instr.connection_type}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('common.status')}</span>
                  <span className={`font-medium ${instr.status === 'connected' ? 'text-green-600' :
                    instr.status === 'error' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                    {getStatusLabel(instr.status)}
                  </span>
                </div>
                {instr.messagesReceived !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('instruments.messages_received')}</span>
                    <span className="font-medium">{instr.messagesReceived}</span>
                  </div>
                )}
                {instr.lastActivity && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('common.last_activity')}</span>
                    <span className="font-medium text-gray-600">
                      {new Date(instr.lastActivity).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {instr.errorMessage && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
                    {instr.errorMessage}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
