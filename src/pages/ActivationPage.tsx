/**
 * License Activation Page
 * 
 * This page is shown when:
 * - Trial period has expired
 * - License needs to be activated
 * - License has expired and needs renewal
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Key,
    Monitor,
    Globe,
    FileInput,
    CheckCircle2,
    AlertTriangle,
    Copy,
    ExternalLink,
    Loader2,
    QrCode
} from 'lucide-react';
import { toast } from 'sonner';

interface LicenseStatus {
    activated: boolean;
    machineId: string;
    machineIdFormatted: string;
    trialDaysRemaining: number;
    isTrialExpired: boolean;
    isLicenseExpired: boolean;
    licenseType: string;
    expiresAt?: string;
}

export default function ActivationPage() {
    const navigate = useNavigate();

    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [activationKey, setActivationKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activationUrl, setActivationUrl] = useState('');

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        try {
            const licenseStatus = await window.electronAPI.license.getStatus();
            setStatus(licenseStatus);

            const url = await window.electronAPI.license.getActivationUrl();
            setActivationUrl(url);
        } catch (err) {
            console.error('Failed to load license status:', err);
        }
    };

    const handleActivate = async () => {
        if (!activationKey.trim()) {
            setError('请输入激活码');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await window.electronAPI.license.activate(activationKey.trim());

            if (result.success) {
                toast.success('激活成功！', {
                    description: '许可证已成功激活，正在跳转...'
                });

                // Reload status and navigate to main app
                setTimeout(() => {
                    navigate('/');
                    window.location.reload();
                }, 1500);
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(err.message || '激活失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileImport = async () => {
        try {
            // Open file dialog
            const result = await window.electronAPI.dialog.showOpenDialog({
                title: '选择许可证文件',
                filters: [
                    { name: 'License Files', extensions: ['lic', 'license', 'txt'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths[0]) {
                return;
            }

            setIsLoading(true);
            setError(null);

            const activateResult = await window.electronAPI.license.activateFromFile(result.filePaths[0]);

            if (activateResult.success) {
                toast.success('激活成功！', {
                    description: '许可证已成功激活'
                });

                setTimeout(() => {
                    navigate('/');
                    window.location.reload();
                }, 1500);
            } else {
                setError(activateResult.message);
            }
        } catch (err: any) {
            setError(err.message || '导入失败');
        } finally {
            setIsLoading(false);
        }
    };

    const copyMachineId = () => {
        if (status?.machineIdFormatted) {
            navigator.clipboard.writeText(status.machineIdFormatted);
            toast.success('已复制设备码');
        }
    };

    const openActivationUrl = () => {
        if (activationUrl) {
            window.electronAPI.shell.openExternal(activationUrl);
        }
    };

    const skipToTrial = () => {
        navigate('/');
    };

    if (!status) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const canUseTrial = !status.isTrialExpired && status.trialDaysRemaining > 0;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
            <div className="w-full max-w-2xl space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                            <Key className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        SimpleLIMS 激活
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        {status.isTrialExpired
                            ? '试用期已结束，请激活许可证以继续使用'
                            : status.isLicenseExpired
                                ? '许可证已过期，请续费或重新激活'
                                : '激活您的 SimpleLIMS 许可证'}
                    </p>
                </div>

                {/* Trial Status Alert */}
                {canUseTrial && (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-700 dark:text-blue-300">
                            试用期剩余 <strong>{status.trialDaysRemaining}</strong> 天。
                            您可以继续试用或立即激活。
                            <Button
                                variant="link"
                                className="text-blue-700 dark:text-blue-300 p-0 h-auto ml-2"
                                onClick={skipToTrial}
                            >
                                继续试用 →
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Main Card */}
                <Card className="shadow-xl border-0">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-xl">获取激活码</CardTitle>
                        <CardDescription>
                            请按以下步骤获取激活码
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Step 1: Device Code */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                    1
                                </div>
                                <Monitor className="h-4 w-4" />
                                复制本机设备码
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 font-mono text-lg tracking-widest text-center">
                                    {status.machineIdFormatted}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={copyMachineId}
                                    title="复制设备码"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Step 2: Visit Website */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                    2
                                </div>
                                <Globe className="h-4 w-4" />
                                用手机访问激活网站
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">访问网址:</p>
                                        <p className="font-mono text-lg font-semibold text-blue-600 dark:text-blue-400">
                                            lims.me
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={openActivationUrl}
                                        className="gap-1"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        打开网页
                                    </Button>
                                </div>

                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    在网页上输入您的设备码和购买时获得的序列号
                                </div>

                                {/* QR Code Placeholder */}
                                <div className="flex justify-center pt-2">
                                    <div className="w-32 h-32 bg-white dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                        <QrCode className="h-16 w-16 text-gray-300 dark:text-gray-500" />
                                    </div>
                                </div>
                                <p className="text-xs text-center text-gray-400">
                                    或扫描此二维码快速访问
                                </p>
                            </div>
                        </div>

                        {/* Step 3: Enter Activation Key */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                    3
                                </div>
                                <Key className="h-4 w-4" />
                                输入激活码
                            </div>

                            <div className="space-y-2">
                                <Input
                                    placeholder="请粘贴您获得的激活码..."
                                    value={activationKey}
                                    onChange={(e) => setActivationKey(e.target.value)}
                                    className="font-mono text-sm h-12"
                                    disabled={isLoading}
                                />

                                {error && (
                                    <Alert variant="destructive" className="py-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1 h-12"
                                        onClick={handleActivate}
                                        disabled={isLoading || !activationKey.trim()}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                激活中...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                激活
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-12 gap-2"
                                        onClick={handleFileImport}
                                        disabled={isLoading}
                                        title="从 .lic 文件导入"
                                    >
                                        <FileInput className="h-4 w-4" />
                                        导入文件
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Help Text */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <p>
                        还没有序列号？
                        <a
                            href="https://simplelims.com/pricing"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
                        >
                            立即购买
                        </a>
                    </p>
                    <p>
                        遇到问题？
                        <a
                            href="mailto:support@simplelims.com"
                            className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
                        >
                            联系技术支持
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
