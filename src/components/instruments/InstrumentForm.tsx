import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Instrument, type CSVConfig } from '@/services/database.service';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InstrumentFormProps {
    initialData?: Instrument;
    onSubmit: (data: Omit<Instrument, 'id' | 'is_active' | 'is_connected' | 'last_activity'>) => Promise<boolean>;
    onCancel: () => void;
}

export function InstrumentForm({ initialData, onSubmit, onCancel }: InstrumentFormProps) {
    const { t } = useTranslation();
    const [isProcessing, setIsProcessing] = useState(false);
    const [availablePorts, setAvailablePorts] = useState<{ path: string; manufacturer?: string }[]>([]);

    const defaultCsvConfig: CSVConfig = {
        delimiter: ',',
        hasHeader: true,
        sampleIdColumn: '',
        testCodeColumn: '',
        valueColumn: '',
        unitColumn: '',
        skipRows: 0,
    };

    const defaultValues: Partial<Instrument> = {
        name: '',
        model: '',
        manufacturer: '',
        connection_type: 'serial',
        protocol: 'astm',
        port_path: '',
        baud_rate: 9600,
        data_bits: 8,
        stop_bits: 1,
        parity: 'none',
        host: '192.168.1.100',
        port: 5000,
        tcp_mode: 'client',
        watch_folder: '/path/to/watch',
        file_pattern: '*.txt',
    };

    const parseCsvConfig = (configStr?: string): CSVConfig => {
        if (!configStr) return defaultCsvConfig;
        try {
            return { ...defaultCsvConfig, ...JSON.parse(configStr) };
        } catch {
            return defaultCsvConfig;
        }
    };

    const [formData, setFormData] = useState<Partial<Instrument>>({
        ...defaultValues,
        ...initialData,
    });

    const [csvConfig, setCsvConfig] = useState<CSVConfig>(
        parseCsvConfig(initialData?.csv_config)
    );

    useEffect(() => {
        // Fetch available serial ports
        if (window.electronAPI) {
            window.electronAPI.instrument.listPorts()
                .then((ports: any[]) => setAvailablePorts(ports))
                .catch((err: any) => console.error('Failed to list ports:', err));
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.model) {
            toast.error(t('common.required_fields'));
            return;
        }

        setIsProcessing(true);
        try {
            const cleanData = { ...formData };
            if (cleanData.connection_type === 'serial') {
                delete cleanData.host;
                delete cleanData.port;
                delete cleanData.watch_folder;
                delete cleanData.csv_config;
            } else if (cleanData.connection_type === 'tcp') {
                delete cleanData.port_path;
                delete cleanData.baud_rate;
                delete cleanData.csv_config;
            } else if (cleanData.connection_type === 'file') {
                delete cleanData.port_path;
                delete cleanData.host;
                if (cleanData.protocol === 'csv') {
                    cleanData.csv_config = JSON.stringify(csvConfig);
                } else {
                    delete cleanData.csv_config;
                }
            }

            await onSubmit(cleanData as any);
        } finally {
            setIsProcessing(false);
        }
    };

    const updateField = (field: keyof Instrument, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateCsvConfig = (field: keyof CSVConfig, value: any) => {
        setCsvConfig(prev => ({ ...prev, [field]: value }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">{t('instruments.fields.name')}</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={e => updateField('name', e.target.value)}
                        placeholder="e.g., Main Analyzer"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="model">{t('instruments.fields.model')}</Label>
                    <Input
                        id="model"
                        value={formData.model}
                        onChange={e => updateField('model', e.target.value)}
                        placeholder="e.g., Sysmex XP-100"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="manufacturer">{t('instruments.fields.manufacturer')}</Label>
                <Input
                    id="manufacturer"
                    value={formData.manufacturer || ''}
                    onChange={e => updateField('manufacturer', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>{t('instruments.fields.connection_type')}</Label>
                    <Select
                        value={formData.connection_type}
                        onValueChange={v => updateField('connection_type', v)}
                    >
                        <SelectTrigger className="bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="serial">{t('instruments.connection_types.serial')}</SelectItem>
                            <SelectItem value="tcp">{t('instruments.connection_types.tcp')}</SelectItem>
                            <SelectItem value="file">{t('instruments.connection_types.file')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>{t('instruments.fields.protocol')}</Label>
                    <Select
                        value={formData.protocol}
                        onValueChange={v => updateField('protocol', v)}
                    >
                        <SelectTrigger className="bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="astm">{t('instruments.protocols.astm')}</SelectItem>
                            <SelectItem value="hl7">{t('instruments.protocols.hl7')}</SelectItem>
                            <SelectItem value="csv">{t('instruments.protocols.csv')}</SelectItem>
                            <SelectItem value="custom">{t('instruments.protocols.custom')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Serial Settings */}
            {formData.connection_type === 'serial' && (
                <div className="border p-4 rounded-md bg-gray-50 space-y-4">
                    <div className="space-y-2">
                        <Label>{t('instruments.fields.port')}</Label>
                        <Select
                            value={formData.port_path || ''}
                            onValueChange={v => updateField('port_path', v)}
                        >
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder={t('instruments.fields.select_port', 'Select Port')} />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePorts.map((port: any) => (
                                    <SelectItem key={port.path} value={port.path}>
                                        {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                                    </SelectItem>
                                ))}
                                <SelectItem value="COM1">COM1 (Manual)</SelectItem>
                                <SelectItem value="/dev/tty.usbserial">/dev/tty.usbserial (Manual)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('instruments.fields.baud_rate')}</Label>
                            <Input
                                type="number"
                                value={formData.baud_rate}
                                onChange={e => updateField('baud_rate', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('instruments.fields.data_bits')}</Label>
                            <Select
                                value={formData.data_bits?.toString()}
                                onValueChange={v => updateField('data_bits', parseInt(v))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">7</SelectItem>
                                    <SelectItem value="8">8</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('instruments.fields.parity')}</Label>
                            <Select
                                value={formData.parity}
                                onValueChange={v => updateField('parity', v)}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="even">Even</SelectItem>
                                    <SelectItem value="odd">Odd</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('instruments.fields.stop_bits')}</Label>
                            <Select
                                value={formData.stop_bits?.toString()}
                                onValueChange={v => updateField('stop_bits', parseFloat(v))}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="1.5">1.5</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            )}

            {/* TCP Settings */}
            {formData.connection_type === 'tcp' && (
                <div className="border p-4 rounded-md bg-gray-50 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('instruments.fields.host_ip')}</Label>
                            <Input
                                value={formData.host || ''}
                                onChange={e => updateField('host', e.target.value)}
                                placeholder="192.168.1.100"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('instruments.fields.port')}</Label>
                            <Input
                                type="number"
                                value={formData.port || ''}
                                onChange={e => updateField('port', parseInt(e.target.value))}
                                placeholder="5000"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('instruments.fields.mode')}</Label>
                        <Select
                            value={formData.tcp_mode}
                            onValueChange={v => updateField('tcp_mode', v)}
                        >
                            <SelectTrigger className="bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="client">{t('instruments.wizard.client_mode')}</SelectItem>
                                <SelectItem value="server">{t('instruments.wizard.server_mode')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* File Settings */}
            {formData.connection_type === 'file' && (
                <div className="border p-4 rounded-md bg-gray-50 space-y-4">
                    <div className="space-y-2">
                        <Label>{t('instruments.fields.watch_folder')}</Label>
                        <div className="flex gap-2">
                            <Input
                                value={formData.watch_folder || ''}
                                onChange={e => updateField('watch_folder', e.target.value)}
                                placeholder="/path/to/folder"
                            />
                            <Button type="button" variant="outline" onClick={async () => {
                                if (window.electronAPI) {
                                    const path = await window.electronAPI.file.selectFolder();
                                    if (path) updateField('watch_folder', path);
                                }
                            }}>{t('instruments.fields.browse')}</Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('instruments.fields.file_pattern')}</Label>
                        <Input
                            value={formData.file_pattern || ''}
                            onChange={e => updateField('file_pattern', e.target.value)}
                            placeholder="e.g., *.csv, *.txt"
                        />
                    </div>
                </div>
            )}

            {/* CSV Config Settings */}
            {formData.protocol === 'csv' && (
                <div className="border p-4 rounded-md bg-blue-50 space-y-4">
                    <h4 className="font-medium text-sm">{t('instruments.csv_config')}</h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('instruments.csv_delimiter')}</Label>
                            <Select
                                value={csvConfig.delimiter || ','}
                                onValueChange={v => updateCsvConfig('delimiter', v)}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value=",">{t('instruments.csv_delimiters.comma')} (,)</SelectItem>
                                    <SelectItem value="	">{t('instruments.csv_delimiters.tab')} (Tab)</SelectItem>
                                    <SelectItem value=";">{t('instruments.csv_delimiters.semicolon')} (;)</SelectItem>
                                    <SelectItem value="|">{t('instruments.csv_delimiters.pipe')} (|)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={csvConfig.hasHeader !== false}
                                    onChange={e => updateCsvConfig('hasHeader', e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <span className="text-sm">{t('instruments.csv_has_header')}</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('instruments.csv_sample_id_col')}</Label>
                            <Input
                                value={csvConfig.sampleIdColumn?.toString() || ''}
                                onChange={e => updateCsvConfig('sampleIdColumn', e.target.value)}
                                placeholder="e.g., sample_id or 0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('instruments.csv_test_code_col')}</Label>
                            <Input
                                value={csvConfig.testCodeColumn?.toString() || ''}
                                onChange={e => updateCsvConfig('testCodeColumn', e.target.value)}
                                placeholder="e.g., test_code or 1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('instruments.csv_value_col')}</Label>
                            <Input
                                value={csvConfig.valueColumn?.toString() || ''}
                                onChange={e => updateCsvConfig('valueColumn', e.target.value)}
                                placeholder="e.g., value or 2"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('instruments.csv_unit_col')}</Label>
                            <Input
                                value={csvConfig.unitColumn?.toString() || ''}
                                onChange={e => updateCsvConfig('unitColumn', e.target.value)}
                                placeholder="e.g., unit or 3"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>
        </form>
    );
}
