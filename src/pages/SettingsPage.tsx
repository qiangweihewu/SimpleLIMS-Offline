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
      toast.info('请选择备份保存位置...');
      const success = await createBackup();
      if (success) {
        toast.success('数据库备份成功');
      } else if (success === false) {
        // Cancelled or failed
      }
    } catch {
      toast.error('备份失败');
    }
  };

  const handleRestore = async () => {
    if (confirm(t('common.confirm'))) {
      try {
        const success = await restoreBackup();
        if (success) {
          toast.success('数据库恢复成功，请重启应用');
        } else if (success === false) {
          // Cancelled or failed
        }
      } catch {
        toast.error('恢复失败');
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1><p className="text-gray-500">配置实验室信息和系统参数</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />{t('settings.general')}</CardTitle><CardDescription>语言和显示设置</CardDescription></CardHeader>
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
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t('settings.lab_info')}</CardTitle><CardDescription>这些信息将显示在报告抬头</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>实验室名称</Label><Input value={labSettings.lab_name} onChange={(e) => setLabSettings({ ...labSettings, lab_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>地址</Label><Input value={labSettings.lab_address} onChange={(e) => setLabSettings({ ...labSettings, lab_address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>电话</Label><Input value={labSettings.lab_phone} onChange={(e) => setLabSettings({ ...labSettings, lab_phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>邮箱</Label><Input value={labSettings.lab_email} onChange={(e) => setLabSettings({ ...labSettings, lab_email: e.target.value })} /></div>
            </div>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t('settings.backup')}</CardTitle><CardDescription>定期备份数据以防止数据丢失</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">数据库位置</p>
              <p className="font-mono text-sm">~/SimpleLIMS/simplelims.db</p>
              <p className="text-xs text-gray-400 mt-1">请定期备份至外部存储设备</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={handleBackup}><Download className="h-4 w-4 mr-2" />备份数据库</Button>
              <Button variant="outline" onClick={handleRestore}><Upload className="h-4 w-4 mr-2" />恢复数据库</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />安全设置</CardTitle><CardDescription>管理用户账户和访问权限</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium">admin</p><p className="text-sm text-gray-500">管理员</p></div><Button variant="outline" size="sm">修改密码</Button></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium">technician1</p><p className="text-sm text-gray-500">检验技师</p></div><Button variant="outline" size="sm">修改密码</Button></div>
            </div>
            <Button variant="outline">添加用户</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />许可证</CardTitle><CardDescription>软件授权信息</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 border rounded-lg ${licenseInfo?.activated ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <p className={`${licenseInfo?.activated ? 'text-green-800' : 'text-yellow-800'} font-medium`}>许可证状态: {licenseInfo?.activated ? '已激活' : '试用版'}</p>
              <p className={`text-sm ${licenseInfo?.activated ? 'text-green-600' : 'text-yellow-600'}`}>{licenseInfo?.licenseType || 'Trial'} · {licenseInfo?.activated ? '永久授权' : '未激活'}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">机器 ID</span><span className="font-mono">{licenseInfo?.machineId || 'Loading...'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">激活日期</span><span>{licenseInfo?.activatedAt || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">版本</span><span>v0.1.0</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
