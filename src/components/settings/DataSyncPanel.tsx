import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { RefreshCw, Upload, Download, Globe, Share2, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Config Interfaces
interface CloudConfig {
    enabled?: boolean;
    serverUrl?: string;
    lastSync?: string;
}

interface DHIS2Config {
    enabled?: boolean;
    baseUrl?: string;
    username?: string;
    password?: string;
    orgUnitId?: string;
    dataSetId?: string;
}

interface OpenMRSConfig {
    enabled?: boolean;
    baseUrl?: string;
    username?: string;
    password?: string;
}

export function DataSyncPanel() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);

    // Config States
    const [cloudConfig, setCloudConfig] = useState<CloudConfig>({});
    const [dhis2Config, setDhis2Config] = useState<DHIS2Config>({});
    const [openMrsConfig, setOpenMrsConfig] = useState<OpenMRSConfig>({});

    // Loading States
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setLoading(true);
        try {
            if (window.electronAPI) {
                const cloud = await window.electronAPI.sync.getConfig();
                const dhis2 = await window.electronAPI.dhis2.getConfig();
                const openmrs = await window.electronAPI.openmrs.getConfig();
                setCloudConfig(cloud || {});
                setDhis2Config(dhis2 || {});
                setOpenMrsConfig(openmrs || {});
            }
        } catch (error) {
            console.error('Failed to load sync configs:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveCloudConfig = async () => {
        try {
            await window.electronAPI.sync.setConfig(cloudConfig);
            toast.success(t('sync.messages.save_success'));
        } catch (e) {
            console.error(e);
            toast.error(t('sync.messages.save_failed'));
        }
    };

    const saveDhis2Config = async () => {
        try {
            await window.electronAPI.dhis2.setConfig(dhis2Config);
            toast.success(t('sync.messages.save_success'));
        } catch (e) {
            console.error(e);
            toast.error(t('sync.messages.save_failed'));
        }
    };

    const saveOpenMrsConfig = async () => {
        try {
            await window.electronAPI.openmrs.setConfig(openMrsConfig);
            toast.success(t('sync.messages.save_success'));
        } catch (e) {
            console.error(e);
            toast.error(t('sync.messages.save_failed'));
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Default since: 30 days ago or last sync time
            const since = '2020-01-01'; // Simplified for POC
            const password = 'demo'; // Simplified for POC, should prompt user

            const path = await window.electronAPI.sync.exportOffline(since, password);
            toast.success(t('sync.messages.export_success', { path }));
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : t('sync.messages.export_failed');
            toast.error(msg);
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const filePaths = await window.electronAPI.file.selectFile([{ name: 'LIMS Package', extensions: ['dat'] }]);
            if (filePaths) {
                const password = 'demo'; // Simplified
                const result = await window.electronAPI.sync.importOffline(filePaths, password);
                if (result.success) {
                    toast.success(t('sync.messages.import_success', { count: result.recordsImported }));
                } else {
                    toast.error(result.message);
                }
            }
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : t('sync.messages.import_failed');
            toast.error(msg);
        } finally {
            setImporting(false);
        }
    };

    const handleManualSync = async () => {
        setSyncing(true);
        try {
            const result = await window.electronAPI.sync.manual();
            if (result.success) {
                toast.success(t('sync.messages.sync_success'));
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error(error);
            toast.error(t('sync.messages.sync_failed'));
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return <div>{t('common.loading')}</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />{t('sync.title')}</CardTitle>
                <CardDescription>{t('sync.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="cloud">
                    <TabsList className="mb-4">
                        <TabsTrigger value="cloud">{t('sync.cloud_sync')}</TabsTrigger>
                        <TabsTrigger value="dhis2">{t('sync.dhis2')}</TabsTrigger>
                        <TabsTrigger value="openmrs">{t('sync.openmrs')}</TabsTrigger>
                    </TabsList>

                    {/* Cloud / Offline Sync */}
                    <TabsContent value="cloud" className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="cloud-enable"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={cloudConfig.enabled || false}
                                    onChange={(e) => setCloudConfig({ ...cloudConfig, enabled: e.target.checked })}
                                />
                                <Label htmlFor="cloud-enable">{t('sync.enable')}</Label>
                            </div>
                            <Badge variant={cloudConfig.enabled ? "default" : "secondary"} className="flex gap-1">
                                {cloudConfig.enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                {cloudConfig.enabled ? t('common.active') : t('common.inactive')}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Online Settings (Optional) */}
                            <div className="space-y-4 border p-4 rounded bg-gray-50/50">
                                <h4 className="font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> {t('sync.online_sync', 'Online Sync')}</h4>
                                <div className="space-y-2">
                                    <Label>{t('sync.server_url')}</Label>
                                    <Input
                                        value={cloudConfig.serverUrl || ''}
                                        onChange={(e) => setCloudConfig({ ...cloudConfig, serverUrl: e.target.value })}
                                        placeholder="https://api.simplelims.org/sync"
                                        disabled={!cloudConfig.enabled}
                                    />
                                </div>
                                <Button
                                    onClick={handleManualSync}
                                    disabled={!cloudConfig.enabled || !cloudConfig.serverUrl || syncing}
                                    size="sm"
                                >
                                    {syncing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                    {t('sync.manual_sync')}
                                </Button>
                            </div>

                            {/* Offline Package (Always available) */}
                            <div className="space-y-4 border p-4 rounded bg-gray-50/50">
                                <h4 className="font-medium flex items-center gap-2"><Share2 className="h-4 w-4" /> {t('sync.offline_transfer', 'Offline Transfer')}</h4>
                                <p className="text-xs text-gray-500">{t('sync.offline_transfer_desc', 'Transfer data between sites via encrypted file.')}</p>
                                <div className="flex gap-2">
                                    <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm" className="flex-1">
                                        <Download className="h-4 w-4 mr-2" /> {t('sync.export_offline')}
                                    </Button>
                                    <Button onClick={handleImport} disabled={importing} variant="outline" size="sm" className="flex-1">
                                        <Upload className="h-4 w-4 mr-2" /> {t('sync.import_offline')}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button onClick={saveCloudConfig}>{t('sync.save_config')}</Button>
                        </div>
                    </TabsContent>

                    {/* DHIS2 */}
                    <TabsContent value="dhis2" className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="dhis2-enable"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={dhis2Config.enabled || false}
                                    onChange={(e) => setDhis2Config({ ...dhis2Config, enabled: e.target.checked })}
                                />
                                <Label htmlFor="dhis2-enable">{t('sync.enable')}</Label>
                            </div>
                            <Badge variant={dhis2Config.enabled ? "default" : "secondary"} className="flex gap-1">
                                {dhis2Config.enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                {dhis2Config.enabled ? t('common.active') : t('common.inactive')}
                            </Badge>
                        </div>

                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('sync.server_url')}</Label>
                                    <Input value={dhis2Config.baseUrl || ''} onChange={(e) => setDhis2Config({ ...dhis2Config, baseUrl: e.target.value })} placeholder="https://debug.dhis2.org/..." disabled={!dhis2Config.enabled} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('sync.org_unit_id')}</Label>
                                    <Input value={dhis2Config.orgUnitId || ''} onChange={(e) => setDhis2Config({ ...dhis2Config, orgUnitId: e.target.value })} placeholder="ImspTQPwCqd" disabled={!dhis2Config.enabled} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('sync.username')}</Label>
                                    <Input value={dhis2Config.username || ''} onChange={(e) => setDhis2Config({ ...dhis2Config, username: e.target.value })} disabled={!dhis2Config.enabled} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('sync.password')}</Label>
                                    <Input type="password" value={dhis2Config.password || ''} onChange={(e) => setDhis2Config({ ...dhis2Config, password: e.target.value })} disabled={!dhis2Config.enabled} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('sync.dataset_id')}</Label>
                                <Input value={dhis2Config.dataSetId || ''} onChange={(e) => setDhis2Config({ ...dhis2Config, dataSetId: e.target.value })} placeholder="BfMAe6Itzgt" disabled={!dhis2Config.enabled} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={async () => {
                                try {
                                    const dailyData = await window.electronAPI.dhis2.generateDaily(new Date().toISOString().split('T')[0]);
                                    const result = await window.electronAPI.dhis2.submit(dailyData);
                                    if (result.success) toast.success(result.message);
                                    else toast.error(result.message);
                                } catch (error) {
                                    console.error(error);
                                    const msg = error instanceof Error ? error.message : 'Error';
                                    toast.error(msg);
                                }
                            }} disabled={!dhis2Config.enabled}>
                                {t('sync.manual_sync')}
                            </Button>
                            <Button onClick={saveDhis2Config}>{t('sync.save_config')}</Button>
                        </div>
                    </TabsContent>

                    {/* OpenMRS */}
                    <TabsContent value="openmrs" className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="openmrs-enable"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={openMrsConfig.enabled || false}
                                    onChange={(e) => setOpenMrsConfig({ ...openMrsConfig, enabled: e.target.checked })}
                                />
                                <Label htmlFor="openmrs-enable">{t('sync.enable')}</Label>
                            </div>
                            <Badge variant={openMrsConfig.enabled ? "default" : "secondary"} className="flex gap-1">
                                {openMrsConfig.enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                {openMrsConfig.enabled ? t('common.active') : t('common.inactive')}
                            </Badge>
                        </div>

                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>{t('sync.server_url')}</Label>
                                <Input value={openMrsConfig.baseUrl || ''} onChange={(e) => setOpenMrsConfig({ ...openMrsConfig, baseUrl: e.target.value })} placeholder="http://localhost:8080/openmrs" disabled={!openMrsConfig.enabled} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('sync.username')}</Label>
                                    <Input value={openMrsConfig.username || ''} onChange={(e) => setOpenMrsConfig({ ...openMrsConfig, username: e.target.value })} disabled={!openMrsConfig.enabled} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('sync.password')}</Label>
                                    <Input type="password" value={openMrsConfig.password || ''} onChange={(e) => setOpenMrsConfig({ ...openMrsConfig, password: e.target.value })} disabled={!openMrsConfig.enabled} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={async () => {
                                /* Test Search */
                                try {
                                    const patient = await window.electronAPI.openmrs.findPatient('1001'); // Test ID
                                    if (patient) toast.success(t('sync.messages.patient_found', { id: patient.id }));
                                    else toast.info(t('sync.messages.no_patient_found'));
                                } catch (error) {
                                    console.error(error);
                                    const msg = error instanceof Error ? error.message : t('sync.messages.connection_failed');
                                    toast.error(t('sync.messages.connection_failed') + ': ' + msg);
                                }
                            }} disabled={!openMrsConfig.enabled}>
                                {t('sync.test_connection')}
                            </Button>
                            <Button onClick={saveOpenMrsConfig}>{t('sync.save_config')}</Button>
                        </div>
                    </TabsContent>

                </Tabs>
            </CardContent>
        </Card>
    );
}
