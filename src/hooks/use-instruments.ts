import { useState, useEffect } from 'react';
import { instrumentService, type Instrument } from '@/services/database.service';
import { toast } from 'sonner';

export function useInstruments() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInstruments = async () => {
    try {
      setLoading(true);
      const data = await instrumentService.getAll();
      setInstruments(data);
    } catch (err) {
      console.error('Failed to fetch instruments:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectInstrument = async (instrument: Instrument) => {
    if (instrument.connection_type !== 'serial') {
      toast.error('目前只支持串口连接');
      return;
    }

    if (!instrument.port_path) {
      toast.error('未配置串口路径');
      return;
    }

    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.instrument.connect(
          instrument.port_path,
          {
            baudRate: instrument.baud_rate || 9600,
            instrumentId: instrument.id
          }
        );
        
        if (success) {
          toast.success(`已连接 ${instrument.name}`);
          fetchInstruments();
        } else {
          toast.error(`连接失败`);
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
      toast.error('连接出错');
    }
  };

  const disconnectInstrument = async (instrument: Instrument) => {
    if (!instrument.port_path) return;

    try {
      if (window.electronAPI) {
        await window.electronAPI.instrument.disconnect(instrument.port_path);
        toast.success(`已断开 ${instrument.name}`);
        fetchInstruments();
      }
    } catch (err) {
      console.error('Disconnection error:', err);
      toast.error('断开出错');
    }
  };

  useEffect(() => {
    fetchInstruments();

    // Listen for status updates from main process
    if (window.electronAPI) {
      const cleanup = window.electronAPI.instrument.onStatus((data) => {
        console.log('Instrument status update:', data);
        fetchInstruments();
      });
      return cleanup;
    }
  }, []);

  return { instruments, loading, refresh: fetchInstruments, connectInstrument, disconnectInstrument };
}
