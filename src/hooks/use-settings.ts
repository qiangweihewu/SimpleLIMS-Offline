import { useState, useEffect } from 'react';
import { settingsService } from '@/services/database.service';

export interface LabSettings {
  lab_name: string;
  lab_address: string;
  lab_phone: string;
  lab_email: string;
  report_footer?: string;
}

export interface LicenseStatus {
  activated: boolean;
  machineId: string;
  expiresAt?: string;
  licenseType?: 'trial' | 'standard' | 'professional';
  activatedAt?: string;
  trialDaysRemaining?: number;
  isTrialExpired?: boolean;
  firstRunAt?: string;
}

export interface BackupSettings {
  enabled: boolean;
  path: string;
  interval: string;
  lastBackupAt?: string;
}

export function useSettings() {
  const [labSettings, setLabSettings] = useState<LabSettings>({
    lab_name: '',
    lab_address: '',
    lab_phone: '',
    lab_email: '',
    report_footer: ''
  });
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    enabled: false,
    path: '',
    interval: 'daily'
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
        lab_email: settingsMap.lab_email || '',
        report_footer: settingsMap.report_footer || ''
      });

      setBackupSettings({
        enabled: settingsMap.auto_backup_enabled === 'true',
        path: settingsMap.auto_backup_path || '',
        interval: settingsMap.auto_backup_interval || 'daily',
        lastBackupAt: settingsMap.last_backup_at
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
      await settingsService.set('report_footer', settings.report_footer || '');
      setLabSettings(settings);
      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      return false;
    }
  };

  const saveBackupSettings = async (settings: BackupSettings) => {
    try {
      if (!window.electronAPI) return false;
      // Use IPC to save and reload service
      const result = await window.electronAPI.backup.updateSettings({
        enabled: settings.enabled,
        path: settings.path,
        interval: settings.interval
      });
      if (result.success) {
        setBackupSettings(settings);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save backup settings:', err);
      return false;
    }
  };

  const createBackup = async () => {
    if (!window.electronAPI) return false;
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const defaultName = `simplelims_backup_${dateStr}.db`;

      const path = await window.electronAPI.file.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'Database Backup', extensions: ['db'] }]
      });

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

  return {
    labSettings,
    backupSettings,
    licenseInfo,
    loading,
    saveLabSettings,
    saveBackupSettings,
    createBackup,
    restoreBackup,
    refreshSettings: fetchSettings
  };
}
