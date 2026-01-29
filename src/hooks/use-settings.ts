import { useState, useEffect } from 'react';
import { settingsService } from '@/services/database.service';

export interface LabSettings {
  lab_name: string;
  lab_address: string;
  lab_phone: string;
  lab_email: string;
}

export interface LicenseStatus {
  activated: boolean;
  machineId: string;
  expiresAt?: string;
  licenseType?: 'trial' | 'standard' | 'professional';
  activatedAt?: string;
}

export function useSettings() {
  const [labSettings, setLabSettings] = useState<LabSettings>({
    lab_name: '',
    lab_address: '',
    lab_phone: '',
    lab_email: ''
  });
  const [licenseInfo, setLicenseInfo] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const allSettings = await settingsService.getAll();
      const settingsMap = allSettings.reduce((acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      setLabSettings({
        lab_name: settingsMap.lab_name || 'SimpleLIMS Laboratory',
        lab_address: settingsMap.lab_address || 'Lab Address',
        lab_phone: settingsMap.lab_phone || '',
        lab_email: settingsMap.lab_email || ''
      });
      
      if (window.electronAPI) {
        const status = await window.electronAPI.license.getStatus();
        setLicenseInfo(status);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveLabSettings = async (settings: LabSettings) => {
    try {
      await settingsService.set('lab_name', settings.lab_name);
      await settingsService.set('lab_address', settings.lab_address);
      await settingsService.set('lab_phone', settings.lab_phone);
      await settingsService.set('lab_email', settings.lab_email);
      setLabSettings(settings);
      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      return false;
    }
  };

  const createBackup = async () => {
    if (!window.electronAPI) return false;
    try {
      const path = await window.electronAPI.file.selectFolder();
      if (path) {
        const result = await window.electronAPI.backup.create(path);
        return result;
      }
      return false;
    } catch (err) {
      console.error('Backup failed:', err);
      throw err;
    }
  };
  
  const restoreBackup = async () => {
    if (!window.electronAPI) return false;
    try {
        const path = await window.electronAPI.file.selectFile([{ name: 'Database Backup', extensions: ['db', 'sqlite', 'bak'] }]);
        if (path) {
            const result = await window.electronAPI.backup.restore(path);
            return result;
        }
        return false;
    } catch (err) {
        console.error('Restore failed:', err);
        throw err;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { labSettings, licenseInfo, loading, saveLabSettings, createBackup, restoreBackup };
}
