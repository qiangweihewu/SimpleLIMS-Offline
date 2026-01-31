import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { instrumentService, type Instrument } from '@/services/database.service';
import { toast } from 'sonner';

export function useInstruments() {
  const { t } = useTranslation();
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
    if (instrument.connection_type === 'file') {
      toast.error(t('instruments.messages.error_unsupported_file_mode'));
      return;
    }

    if (instrument.connection_type === 'serial' && !instrument.port_path) {
      toast.error(t('instruments.messages.error_no_serial_port'));
      return;
    }

    if (instrument.connection_type === 'tcp' && !instrument.port) {
      toast.error(t('instruments.messages.error_no_tcp_port'));
      return;
    }

    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.instrument.connect(
          instrument.port_path || '', // For TCP this might be empty, IPC handler handles it
          {
            connectionType: instrument.connection_type as 'serial' | 'tcp',
            // Serial
            baudRate: instrument.baud_rate || 9600,
            dataBits: instrument.data_bits as 5 | 6 | 7 | 8 | undefined,
            stopBits: instrument.stop_bits as 1 | 1.5 | 2 | undefined,
            parity: instrument.parity as 'none' | 'even' | 'odd' | undefined,
            // TCP
            host: instrument.host,
            port: instrument.port,
            mode: instrument.tcp_mode || 'client',

            instrumentId: instrument.id
          }
        );

        if (success) {
          toast.success(t('instruments.messages.connected', { name: instrument.name }));
          fetchInstruments();
        } else {
          toast.error(t('instruments.messages.connect_failed'));
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
      toast.error(t('instruments.messages.connect_error'));
    }
  };

  const disconnectInstrument = async (instrument: Instrument) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.instrument.disconnect(
          instrument.port_path || '',
          {
            instrumentId: instrument.id,
            connectionType: instrument.connection_type as 'serial' | 'tcp',
            host: instrument.host,
            port: instrument.port,
            mode: instrument.tcp_mode || 'client'
          }
        );
        toast.success(t('instruments.messages.disconnected', { name: instrument.name }));
        fetchInstruments();
      }
    } catch (err) {
      console.error('Disconnection error:', err);
      toast.error(t('instruments.messages.disconnect_error'));
    }
  };

  const addInstrument = async (data: Omit<Instrument, 'id' | 'is_active' | 'is_connected' | 'last_activity'>) => {
    try {
      await instrumentService.create(data);
      toast.success(t('instruments.messages.add_success'));
      fetchInstruments();
      return true;
    } catch (err) {
      console.error('Failed to add instrument:', err);
      toast.error(t('instruments.messages.add_failed'));
      return false;
    }
  };

  const updateInstrument = async (id: number, data: Partial<Instrument>) => {
    try {
      await instrumentService.update(id, data);
      toast.success(t('instruments.messages.update_success'));
      fetchInstruments();
      return true;
    } catch (err) {
      console.error('Failed to update instrument:', err);
      toast.error(t('instruments.messages.update_failed'));
      return false;
    }
  };

  const deleteInstrument = async (id: number) => {
    try {
      await instrumentService.delete(id);
      toast.success(t('instruments.messages.delete_success'));
      fetchInstruments();
      return true;
    } catch (err) {
      console.error('Failed to delete instrument:', err);
      toast.error(t('instruments.messages.delete_failed'));
      return false;
    }
  };

  const getTestMappings = async (instrumentId: number) => {
    try {
      if (window.electronAPI) {
        return await instrumentService.getTestMappings(instrumentId);
      }
      return [];
    } catch (err) {
      console.error('Failed to get mappings:', err);
      return [];
    }
  };

  const createTestMapping = async (data: any) => {
    try {
      if (window.electronAPI) {
        await instrumentService.createTestMapping(data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to create mapping:', err);
      toast.error('Failed to create mapping');
      return false;
    }
  };

  const deleteTestMapping = async (id: number) => {
    try {
      if (window.electronAPI) {
        await instrumentService.deleteTestMapping(id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete mapping:', err);
      toast.error('Failed to delete mapping');
      return false;
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

  return {
    instruments,
    loading,
    refresh: fetchInstruments,
    connectInstrument,
    disconnectInstrument,
    addInstrument,
    updateInstrument,
    deleteInstrument,
    getTestMappings,
    createTestMapping,
    deleteTestMapping
  };
}
