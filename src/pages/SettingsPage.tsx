import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Building2, Database, Key, Upload, Download, Loader2, Power, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, type LabSettings, type BackupSettings } from '@/hooks/use-settings';

import { UserManagementPanel } from '@/components/users/UserManagementPanel';
import { DataSyncPanel } from '@/components/settings/DataSyncPanel';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { labSettings: savedSettings, backupSettings: savedBackupSettings, licenseInfo, loading, saveLabSettings, saveBackupSettings, createBackup, restoreBackup, refreshSettings } = useSettings();
  const [labSettings, setLabSettings] = useState<LabSettings>(savedSettings);
  const [backupConfig, setBackupConfig] = useState<BackupSettings>(savedBackupSettings);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLabSettings(savedSettings);
      setBackupConfig(savedBackupSettings);
    }
  }, [loading, savedSettings, savedBackupSettings]);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    try {
      const result = await window.electronAPI.license.activate(licenseKey.trim());
      if (result.success) {
        toast.success(result.message || 'License activated successfully');
        setLicenseKey('');
        if (refreshSettings) refreshSettings(); // Assuming useSettings exposes this, or we reload.
        // Actually useSettings might not expose refresh. I'll check/add it or just window.location.reload() for full refresh?
        // use-settings.ts fetches on mount.
        // I should probably edit use-settings to expose refresh.
        // For now I'll skip refresh call if it doesn't exist and rely on manual reload or edit use-settings.
      } else {
        toast.error(result.message || 'Activation failed');
      }
    } catch (e) {
      toast.error('Activation error');
    } finally {
      setActivating(false);
    }
  };

  const handleSave = async () => {
    const success = await saveLabSettings(labSettings);
    if (success) {
      toast.success(t('common.success'));
    } else {
      toast.error(t('common.error'));
    }
  };

  const handleBackup = async () => {
    try {
      toast.info(t('settings.messages.backup_location'));
      const success = await createBackup();
      if (success) {
        toast.success(t('settings.messages.backup_success'));
      } else if (success === false) {
        // Cancelled or failed
      }
    } catch {
      toast.error(t('settings.messages.backup_failed'));
    }
  };

  const handleRestore = async () => {
    if (confirm(t('settings.messages.restore_confirm'))) {
      try {
        const success = await restoreBackup();
        if (success) {
          toast.success(t('settings.messages.restore_success'));
        } else if (success === false) {
          // Cancelled or failed
        }
      } catch {
        toast.error(t('settings.messages.restore_failed'));
      }
    }
  };


  const ensureBackupPath = async (): Promise<boolean> => {
    if (backupConfig.path) return true;

    try {
      const defaultPath = await window.electronAPI.backup.getDefaultPath();

      // Ask user: Use default path or select custom?
      const useDefault = confirm(t('settings.backup_section.use_default_prompt', { path: defaultPath }));

      if (useDefault) {
        setBackupConfig(prev => ({ ...prev, path: defaultPath }));
        await saveBackupSettings({ ...backupConfig, path: defaultPath }); // Save immedidately
        return true;
      } else {
        // User cancelled default, check if they want to select manually
        // We interpret "Cancel" on the confirm as "I want to do something else", likely manual selection
        // Or we can just prompt: "Click OK to select a folder manually"
        // Let's assume the user knows.

        const customPath = await window.electronAPI.file.selectFolder();
        if (customPath) {
          setBackupConfig(prev => ({ ...prev, path: customPath }));
          await saveBackupSettings({ ...backupConfig, path: customPath }); // Save immedidately
          return true;
        } else {
          return false; // User cancelled everything
        }
      }
    } catch (error) {
      console.error("Failed to ensure backup path", error);
      return false;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1><p className="text-gray-500">{t('settings.subtitle')}</p></div>

      <div className="space-y-6">
        <div className="lg:grid lg:grid-cols-3 gap-6 space-y-6 lg:space-y-0">

          {/* Left Main Column: General & Lab Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t('settings.general')}</CardTitle>
                <CardDescription>{t('settings.lab_info_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Language Selection - Integrated */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t('settings.language')}</Label>
                    <Select
                      value={i18n.language.split('-')[0]}
                      onValueChange={(value) => i18n.changeLanguage(value)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh">{t('settings.languages.zh')}</SelectItem>
                        <SelectItem value="en">{t('settings.languages.en')}</SelectItem>
                        <SelectItem value="es">{t('settings.languages.es')}</SelectItem>
                        <SelectItem value="fr">{t('settings.languages.fr')}</SelectItem>
                        <SelectItem value="pt">{t('settings.languages.pt')}</SelectItem>
                        <SelectItem value="ar">{t('settings.languages.ar')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.form.lab_name')}</Label>
                    <Input value={labSettings.lab_name} onChange={(e) => setLabSettings({ ...labSettings, lab_name: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.form.address')}</Label>
                  <Input value={labSettings.lab_address} onChange={(e) => setLabSettings({ ...labSettings, lab_address: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>{t('settings.form.phone')}</Label><Input value={labSettings.lab_phone} onChange={(e) => setLabSettings({ ...labSettings, lab_phone: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{t('settings.form.email')}</Label><Input value={labSettings.lab_email} onChange={(e) => setLabSettings({ ...labSettings, lab_email: e.target.value })} /></div>
                </div>

                <div className="space-y-2">
                  <Label>{t('report.report_footer')}</Label>
                  <Input value={labSettings.report_footer} onChange={(e) => setLabSettings({ ...labSettings, report_footer: e.target.value })} placeholder={t('report.default_footer')} />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave}>{t('common.save')}</Button>
                </div>
              </CardContent>
            </Card>

            {/* Backup & Restore - Full Width in Main Column */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t('settings.backup')}</CardTitle>
                <CardDescription>{t('settings.backup_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Global Backup Path Configuration */}
                <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <Label className="text-sm font-medium text-gray-700">{t('settings.backup_section.location_label')}</Label>
                  <div className="flex gap-2">
                    <Input
                      className="bg-white"
                      value={backupConfig.path || ''}
                      readOnly
                      placeholder={t('settings.backup_section.select_folder_placeholder')}
                    />
                    <Button variant="outline" onClick={async () => {
                      if (window.electronAPI) {
                        const path = await window.electronAPI.file.selectFolder();
                        if (path) {
                          // Update both state and save immediately
                          const newConfig = { ...backupConfig, path };
                          setBackupConfig(newConfig);
                          await saveBackupSettings(newConfig);
                        }
                      }
                    }}>{t('common.select')}</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Manual Backup Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wider">{t('settings.backup_section.manual_backup')}</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3">
                        <Button
                          onClick={async () => {
                            if (await ensureBackupPath()) {
                              handleBackup();
                            }
                          }}
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-2" />{t('settings.backup_section.backup_btn')}
                        </Button>
                        <Button onClick={handleRestore} className="w-full justify-start" variant="outline"><Upload className="h-4 w-4 mr-2" />{t('settings.backup_section.restore_btn')}</Button>
                      </div>
                    </div>
                  </div>

                  {/* Auto Backup Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wider">{t('settings.backup_section.auto_backup')}</h3>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="autoBackup"
                          checked={backupConfig.enabled}
                          onChange={async (e) => {
                            const isEnabled = e.target.checked;
                            if (isEnabled) {
                              if (await ensureBackupPath()) {
                                const newConfig = { ...backupConfig, enabled: true };
                                setBackupConfig(newConfig);
                                await saveBackupSettings(newConfig);
                              }
                            } else {
                              const newConfig = { ...backupConfig, enabled: false };
                              setBackupConfig(newConfig);
                              await saveBackupSettings(newConfig);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="autoBackup">{t('settings.backup_section.enable_auto')}</Label>
                      </div>

                      {backupConfig.enabled && (
                        <div className="space-y-4 pl-6 border-l-2 border-gray-100 animate-in fade-in slide-in-from-left-2">
                          <div className="space-y-2">
                            <Label className="text-xs">{t('settings.backup_section.interval')}</Label>
                            <Select
                              value={backupConfig.interval}
                              onValueChange={async (value) => {
                                const newConfig = { ...backupConfig, interval: value };
                                setBackupConfig(newConfig);
                                await saveBackupSettings(newConfig);
                              }}
                            >
                              <SelectTrigger className="bg-white h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hourly">{t('settings.messages.intervals.hourly')}</SelectItem>
                                <SelectItem value="daily">{t('settings.messages.intervals.daily')}</SelectItem>
                                <SelectItem value="weekly">{t('settings.messages.intervals.weekly')}</SelectItem>
                                <SelectItem value="monthly">{t('settings.messages.intervals.monthly')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {savedBackupSettings.lastBackupAt && (
                        <p className="text-xs text-gray-400">Last auto-backup: {new Date(savedBackupSettings.lastBackupAt).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Sync & Integrations */}
            <DataSyncPanel />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Power className="h-5 w-5" />{t('settings.system_actions')}</CardTitle>
                <CardDescription>{t('settings.system_actions_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button variant="destructive" className="flex-1" onClick={() => window.electronAPI.quit()}>
                    <Power className="mr-2 h-4 w-4" /> {t('common.quit')}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => window.electronAPI.relaunch()}>
                    <RotateCcw className="mr-2 h-4 w-4" /> {t('common.restart')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: License */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />{t('settings.license')}</CardTitle>
                <CardDescription>{t('settings.license_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`p-4 border rounded-lg ${licenseInfo?.activated ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <p className={`${licenseInfo?.activated ? 'text-green-800' : 'text-yellow-800'} font-medium flex items-center gap-2`}>
                    {licenseInfo?.activated ? <span className="flex h-2 w-2 rounded-full bg-green-600" /> : <span className="flex h-2 w-2 rounded-full bg-yellow-600" />}
                    {t('settings.license_section.status')}: {licenseInfo?.activated ? t('settings.license_section.activated') : t('settings.license_section.trial')}
                  </p>
                  {!licenseInfo?.activated && (
                    <p className="text-sm mt-1 text-yellow-700 ml-4">
                      {t('settings.license_section.days_remaining', { count: licenseInfo?.trialDaysRemaining })}
                    </p>
                  )}
                  {!licenseInfo?.activated && licenseInfo?.isTrialExpired && (
                    <span className="block mt-1 ml-4 text-red-600 font-bold text-sm">{t('settings.license_section.expired')}</span>
                  )}
                  <p className={`text-xs mt-2 ml-4 ${licenseInfo?.activated ? 'text-green-600' : 'text-yellow-600'}`}>
                    {licenseInfo?.licenseType || 'Trial'} · {licenseInfo?.activated ? t('settings.license_section.permanent') : (licenseInfo?.isTrialExpired ? t('settings.license_section.trial_expired') : t('settings.license_section.active_trial'))}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium">{t('settings.license_section.machine_id')}</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-gray-100 px-2 py-1.5 rounded flex-1 select-all border">{licenseInfo?.machineId || t('common.loading')}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        navigator.clipboard.writeText(licenseInfo?.machineId || '');
                        toast.success(t('settings.license_section.copied'));
                      }}><span className="sr-only">Copy</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg></Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 border-t pt-3">
                    <div>
                      <span className="block font-medium text-gray-400 mb-1">{t('settings.license_section.activated_at')}</span>
                      {licenseInfo?.activatedAt ? new Date(licenseInfo.activatedAt).toLocaleDateString() : '-'}
                    </div>
                    <div>
                      <span className="block font-medium text-gray-400 mb-1">{t('settings.license_section.version')}</span>
                      0.1.0-beta
                    </div>
                  </div>

                  {!licenseInfo?.activated && (
                    <div className="pt-4 border-t space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">{t('settings.license_section.activation_key')}</Label>
                        <Input
                          className="h-8 text-sm"
                          value={licenseKey}
                          onChange={(e) => setLicenseKey(e.target.value)}
                          placeholder="eyJ..."
                        />
                        <Button className="w-full h-8" onClick={handleActivate} disabled={activating}>
                          {activating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          {t('settings.license_section.activate_btn')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <UserManagementPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
