import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Building2, Database, Shield, Key, Upload, Download, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, type LabSettings } from '@/hooks/use-settings';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { labSettings: savedSettings, licenseInfo, loading, saveLabSettings, createBackup, restoreBackup } = useSettings();
  const [labSettings, setLabSettings] = useState<LabSettings>(savedSettings);

  useEffect(() => {
    if (!loading) {
      setLabSettings(savedSettings);
    }
  }, [loading, savedSettings]);

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

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1><p className="text-gray-500">{t('settings.subtitle')}</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />{t('settings.general')}</CardTitle><CardDescription>{t('settings.display_settings')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.language')}</Label>
              <Select value={i18n.language.split('-')[0]} onChange={(e) => i18n.changeLanguage(e.target.value)}>
                <option value="zh">中文 (简体)</option>
                <option value="en">English</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t('settings.lab_info')}</CardTitle><CardDescription>{t('settings.lab_info_desc')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>{t('settings.form.lab_name')}</Label><Input value={labSettings.lab_name} onChange={(e) => setLabSettings({ ...labSettings, lab_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('settings.form.address')}</Label><Input value={labSettings.lab_address} onChange={(e) => setLabSettings({ ...labSettings, lab_address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('settings.form.phone')}</Label><Input value={labSettings.lab_phone} onChange={(e) => setLabSettings({ ...labSettings, lab_phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t('settings.form.email')}</Label><Input value={labSettings.lab_email} onChange={(e) => setLabSettings({ ...labSettings, lab_email: e.target.value })} /></div>
            </div>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t('settings.backup')}</CardTitle><CardDescription>{t('settings.backup_desc')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{t('settings.backup_section.location')}</p>
              <p className="font-mono text-sm">~/SimpleLIMS/simplelims.db</p>
              <p className="text-xs text-gray-400 mt-1">{t('settings.backup_section.note')}</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={handleBackup}><Download className="h-4 w-4 mr-2" />{t('settings.backup_section.backup_btn')}</Button>
              <Button variant="outline" onClick={handleRestore}><Upload className="h-4 w-4 mr-2" />{t('settings.backup_section.restore_btn')}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />{t('settings.security')}</CardTitle><CardDescription>{t('settings.security_desc')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium">admin</p><p className="text-sm text-gray-500">{t('settings.users.admin')}</p></div><Button variant="outline" size="sm">{t('settings.users.change_password')}</Button></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium">technician1</p><p className="text-sm text-gray-500">{t('settings.users.technician')}</p></div><Button variant="outline" size="sm">{t('settings.users.change_password')}</Button></div>
            </div>
            <Button variant="outline">{t('settings.users.add_user')}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />{t('settings.license')}</CardTitle><CardDescription>{t('settings.license_desc')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 border rounded-lg ${licenseInfo?.activated ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <p className={`${licenseInfo?.activated ? 'text-green-800' : 'text-yellow-800'} font-medium`}>{t('settings.license_section.status')}: {licenseInfo?.activated ? t('settings.license_section.activated') : t('settings.license_section.trial')}</p>
              <p className={`text-sm ${licenseInfo?.activated ? 'text-green-600' : 'text-yellow-600'}`}>{licenseInfo?.licenseType || 'Trial'} · {licenseInfo?.activated ? t('settings.license_section.permanent') : t('settings.license_section.inactive')}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t('settings.license_section.machine_id')}</span><span className="font-mono">{licenseInfo?.machineId || t('common.loading')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('settings.license_section.activated_at')}</span><span>{licenseInfo?.activatedAt || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('settings.license_section.version')}</span><span>v0.1.0</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
