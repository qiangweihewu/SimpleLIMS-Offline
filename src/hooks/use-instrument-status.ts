/**
 * Hook: Real-time instrument status monitoring
 * Listens to instrument connection/disconnection events via IPC
 */

import { useEffect, useState, useCallback } from 'react';

export interface InstrumentStatusEvent {
  instrumentId: number;
  status: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  timestamp: string;
  message?: string;
  error?: string;
}

export function useInstrumentStatus(instrumentId?: number) {
  const [status, setStatus] = useState<InstrumentStatusEvent | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Setup IPC listeners for real-time updates
    const setupListeners = () => {
      if (!window.electronAPI) return;

      // Listen for connection events
      const unlistenConnected = window.electronAPI.on?.('instrument:connected', (data: any) => {
        if (!instrumentId || data.instrumentId === instrumentId) {
          setStatus({
            instrumentId: data.instrumentId,
            status: 'connected',
            timestamp: data.timestamp,
            message: `Connected to ${data.host}:${data.port}`,
          });
          setLastUpdate(new Date());
        }
      });

      const unlistenDisconnected = window.electronAPI.on?.('instrument:disconnected', (data: any) => {
        if (!instrumentId || data.instrumentId === instrumentId) {
          setStatus({
            instrumentId: data.instrumentId,
            status: 'disconnected',
            timestamp: data.timestamp,
            message: 'Disconnected',
          });
          setLastUpdate(new Date());
        }
      });

      const unlistenError = window.electronAPI.on?.('instrument:error', (data: any) => {
        if (!instrumentId || data.instrumentId === instrumentId) {
          setStatus({
            instrumentId: data.instrumentId,
            status: 'error',
            timestamp: data.timestamp,
            error: data.error,
          });
          setLastUpdate(new Date());
        }
      });

      if (unlistenConnected) unlisteners.push(unlistenConnected);
      if (unlistenDisconnected) unlisteners.push(unlistenDisconnected);
      if (unlistenError) unlisteners.push(unlistenError);
    };

    setupListeners();

    return () => {
      unlisteners.forEach(fn => fn?.());
    };
  }, [instrumentId]);

  return { status, lastUpdate };
}

/**
 * Hook: Listen for HL7 messages
 */
export function useHL7Messages(instrumentId?: number) {
  const [messages, setMessages] = useState<any[]>([]);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const unlistener = window.electronAPI?.on?.('hl7:message', (data: any) => {
      if (!instrumentId || data.instrumentId === instrumentId) {
        setMessages(prev => [data, ...prev].slice(0, 100)); // Keep last 100 messages
        setLastMessage(data);
      }
    });

    return () => unlistener?.();
  }, [instrumentId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  return { messages, lastMessage, clearMessages };
}
