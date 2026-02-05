import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    Upload, Download, FileSpreadsheet, FileText, CheckCircle, XCircle,
    AlertTriangle, Server, Wrench
} from 'lucide-react';

interface Equipment {
    id?: number;
    name: string;
    model: string;
    manufacturer: string;
    serial_number: string;
    location: string;
    status: 'operational' | 'maintenance' | 'faulty' | 'retired';
    next_maintenance?: string;
    notes?: string;
}

interface MaintenanceRecord {
    id?: number;
    equipment_id: number;
    equipment_name?: string;
    type: 'preventive' | 'corrective' | 'inspection';
    performed_at: string;
    performed_by: string;
    findings?: string;
    actions_taken?: string;
}

interface ImportResult {
    total: number;
    success: number;
    failed: number;
    errors: string[];
}

interface ImportExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImported: () => void;
}

export function ImportExportDialog({ open, onOpenChange, onImported }: ImportExportDialogProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [progress, setProgress] = useState(0);
    const [previewData, setPreviewData] = useState<Equipment[]>([]);

    // Parse CSV content
    const parseCSV = (content: string): Record<string, string>[] => {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const data: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            const row: Record<string, string> = {};

            headers.forEach((header, index) => {
                row[header] = (values[index] || '').replace(/"/g, '').trim();
            });

            if (row.name) { // At least name is required
                data.push(row);
            }
        }

        return data;
    };

    // Map CSV row to Equipment
    const mapToEquipment = (row: Record<string, string>): Equipment => {
        return {
            name: row.name || row['equipment name'] || '',
            manufacturer: row.manufacturer || row.brand || '',
            model: row.model || row['model number'] || '',
            serial_number: row.serial_number || row['serial number'] || row.sn || '',
            location: row.location || row.room || '',
            status: (row.status?.toLowerCase() as Equipment['status']) || 'operational',
            next_maintenance: row.next_maintenance || row['next maintenance'] || '',
            notes: row.notes || row.comments || ''
        };
    };

    // Handle file selection
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const rows = parseCSV(content);
            const equipment = rows.map(mapToEquipment);
            setPreviewData(equipment);
        };
        reader.readAsText(file);
    };

    // Import equipment
    const handleImport = async () => {
        if (previewData.length === 0) {
            toast.error(t('import.no_data'));
            return;
        }

        setImporting(true);
        setProgress(0);

        const result: ImportResult = {
            total: previewData.length,
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < previewData.length; i++) {
            const eq = previewData[i];
            try {
                await window.electronAPI.db.run(
                    `INSERT INTO equipment (name, manufacturer, model, serial_number, location, status, next_maintenance, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [eq.name, eq.manufacturer, eq.model, eq.serial_number, eq.location, eq.status, eq.next_maintenance, eq.notes]
                );
                result.success++;
            } catch (err: any) {
                result.failed++;
                result.errors.push(`${eq.name}: ${err.message}`);
            }
            setProgress(Math.round(((i + 1) / previewData.length) * 100));
        }

        setImportResult(result);
        setImporting(false);

        if (result.success > 0) {
            toast.success(t('import.success', { count: result.success }));
            onImported();
        }
        if (result.failed > 0) {
            toast.warning(t('import.partial_failure', { count: result.failed }));
        }
    };

    // Export equipment to CSV
    const exportEquipmentCSV = async () => {
        setExporting(true);
        try {
            const equipment = await window.electronAPI.db.all<Equipment>(
                'SELECT * FROM equipment ORDER BY name'
            );

            if (!equipment || equipment.length === 0) {
                toast.warning(t('import.no_data_export'));
                return;
            }

            const headers = ['ID', 'Name', 'Manufacturer', 'Model', 'Serial Number', 'Location', 'Status', 'Next Maintenance', 'Notes'];
            const rows = equipment.map(eq => [
                eq.id,
                `"${eq.name}"`,
                `"${eq.manufacturer}"`,
                `"${eq.model}"`,
                `"${eq.serial_number}"`,
                `"${eq.location}"`,
                eq.status,
                eq.next_maintenance || '',
                `"${(eq.notes || '').replace(/"/g, '""')}"`
            ].join(','));

            const csv = [headers.join(','), ...rows].join('\n');
            downloadFile(csv, `equipment_export_${getDateString()}.csv`, 'text/csv');
            toast.success(t('import.export_success', { count: equipment.length }));
        } catch (err) {
            console.error('Export failed:', err);
            toast.error(t('import.export_failed'));
        } finally {
            setExporting(false);
        }
    };

    // Export maintenance records to CSV
    const exportMaintenanceCSV = async () => {
        setExporting(true);
        try {
            const records = await window.electronAPI.db.all<MaintenanceRecord & { equipment_name: string }>(
                `SELECT m.*, e.name as equipment_name 
                 FROM maintenance_records m 
                 LEFT JOIN equipment e ON m.equipment_id = e.id 
                 ORDER BY m.performed_at DESC`
            );

            if (!records || records.length === 0) {
                toast.warning(t('import.no_records_export'));
                return;
            }

            const headers = ['ID', 'Equipment ID', 'Equipment Name', 'Type', 'Performed At', 'Performed By', 'Findings', 'Actions Taken'];
            const rows = records.map(r => [
                r.id,
                r.equipment_id,
                `"${r.equipment_name}"`,
                r.type,
                r.performed_at,
                `"${r.performed_by}"`,
                `"${(r.findings || '').replace(/"/g, '""')}"`,
                `"${(r.actions_taken || '').replace(/"/g, '""')}"`
            ].join(','));

            const csv = [headers.join(','), ...rows].join('\n');
            downloadFile(csv, `maintenance_export_${getDateString()}.csv`, 'text/csv');
            toast.success(t('import.export_success', { count: records.length }));
        } catch (err) {
            console.error('Export failed:', err);
            toast.error(t('import.export_failed'));
        } finally {
            setExporting(false);
        }
    };

    // Export as JSON
    const exportAllJSON = async () => {
        setExporting(true);
        try {
            const equipment = await window.electronAPI.db.all('SELECT * FROM equipment');
            const maintenance = await window.electronAPI.db.all('SELECT * FROM maintenance_records');
            const knowledge = await window.electronAPI.db.all('SELECT * FROM knowledge_base');

            const data = {
                exportDate: new Date().toISOString(),
                version: '1.0',
                equipment: equipment || [],
                maintenance_records: maintenance || [],
                knowledge_base: knowledge || []
            };

            const json = JSON.stringify(data, null, 2);
            downloadFile(json, `simplelims_backup_${getDateString()}.json`, 'application/json');
            toast.success(t('import.backup_success'));
        } catch (err) {
            console.error('Backup failed:', err);
            toast.error(t('import.backup_failed'));
        } finally {
            setExporting(false);
        }
    };

    // Download file helper
    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Get date string for filenames
    const getDateString = () => {
        return new Date().toISOString().slice(0, 10);
    };

    // Download template
    const downloadTemplate = () => {
        const headers = 'Name,Manufacturer,Model,Serial Number,Location,Status,Next Maintenance,Notes';
        const example = '"Hematology Analyzer","Mindray","BC-3000","SN-12345","Lab Room 1","operational","2026-03-01","Routine checks needed"';
        const csv = `${headers}\n${example}\n`;
        downloadFile(csv, 'equipment_import_template.csv', 'text/csv');
        toast.success(t('import.template_downloaded'));
    };

    const resetImport = () => {
        setPreviewData([]);
        setImportResult(null);
        setProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) resetImport();
            onOpenChange(isOpen);
        }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        {t('import.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('import.description')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="import" className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="import" className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {t('import.import_tab')}
                        </TabsTrigger>
                        <TabsTrigger value="export" className="flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            {t('import.export_tab')}
                        </TabsTrigger>
                    </TabsList>

                    {/* Import Tab */}
                    <TabsContent value="import" className="flex-1 overflow-y-auto space-y-4 mt-4">
                        {/* File Upload */}
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-4">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={importing}
                                    >
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        {t('import.select_file')}
                                    </Button>
                                    <Button variant="ghost" onClick={downloadTemplate}>
                                        <Download className="h-4 w-4 mr-2" />
                                        {t('import.download_template')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        {previewData.length > 0 && !importResult && (
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Server className="h-4 w-4" />
                                        {t('import.preview')} ({previewData.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                                        {previewData.slice(0, 10).map((eq, index) => (
                                            <div key={index} className="flex items-center gap-3 p-2 border-b last:border-b-0">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{eq.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {eq.manufacturer} {eq.model}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">{eq.status}</Badge>
                                            </div>
                                        ))}
                                        {previewData.length > 10 && (
                                            <div className="p-2 text-center text-xs text-gray-500">
                                                +{previewData.length - 10} {t('import.more_items')}
                                            </div>
                                        )}
                                    </div>

                                    {importing && (
                                        <div className="mt-4 space-y-2">
                                            <Progress value={progress} />
                                            <p className="text-xs text-center text-gray-500">
                                                {t('import.importing')} {progress}%
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-4 flex gap-2">
                                        <Button variant="outline" onClick={resetImport} disabled={importing}>
                                            {t('common.cancel')}
                                        </Button>
                                        <Button onClick={handleImport} disabled={importing}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            {importing ? t('import.importing') : t('import.import_now')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Import Result */}
                        {importResult && (
                            <Card className={importResult.failed > 0 ? 'border-yellow-200' : 'border-green-200'}>
                                <CardContent className="pt-4">
                                    <div className="flex items-center gap-4 mb-4">
                                        {importResult.failed === 0 ? (
                                            <CheckCircle className="h-8 w-8 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="h-8 w-8 text-yellow-500" />
                                        )}
                                        <div>
                                            <p className="font-medium">
                                                {t('import.complete')}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {t('import.result_summary', {
                                                    success: importResult.success,
                                                    failed: importResult.failed,
                                                    total: importResult.total
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {importResult.errors.length > 0 && (
                                        <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded-lg text-sm">
                                            {importResult.errors.map((err, i) => (
                                                <p key={i} className="text-red-600 text-xs">
                                                    <XCircle className="inline h-3 w-3 mr-1" />
                                                    {err}
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    <Button onClick={resetImport} className="mt-4">
                                        {t('import.import_more')}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Export Tab */}
                    <TabsContent value="export" className="flex-1 overflow-y-auto space-y-4 mt-4">
                        <div className="grid gap-4">
                            {/* Equipment CSV */}
                            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportEquipmentCSV}>
                                <CardContent className="pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                                            <Server className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{t('import.export_equipment')}</p>
                                            <p className="text-sm text-gray-500">{t('import.export_equipment_desc')}</p>
                                        </div>
                                        <Button variant="outline" disabled={exporting}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Maintenance Records CSV */}
                            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportMaintenanceCSV}>
                                <CardContent className="pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <Wrench className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{t('import.export_maintenance')}</p>
                                            <p className="text-sm text-gray-500">{t('import.export_maintenance_desc')}</p>
                                        </div>
                                        <Button variant="outline" disabled={exporting}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Full Backup JSON */}
                            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportAllJSON}>
                                <CardContent className="pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                                            <FileSpreadsheet className="h-6 w-6 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{t('import.export_backup')}</p>
                                            <p className="text-sm text-gray-500">{t('import.export_backup_desc')}</p>
                                        </div>
                                        <Button variant="outline" disabled={exporting}>
                                            <Download className="h-4 w-4 mr-2" />
                                            JSON
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
