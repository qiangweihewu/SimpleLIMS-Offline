import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Wrench, Server, BookOpen, AlertTriangle, Plus, Search,
    Activity, Calendar as CalendarIcon, CheckCircle, XCircle, Clock, ScanText, BarChart3,
    QrCode, Upload
} from 'lucide-react';
import { SerialTerminal } from '@/components/equipment/SerialTerminal';
import { KnowledgeBase } from '@/components/equipment/KnowledgeBase';
import { EquipmentDetailDialog } from '@/components/equipment/EquipmentDetailDialog';
import { AddEquipmentDialog } from '@/components/equipment/AddEquipmentDialog';
import { EquipmentStats } from '@/components/equipment/EquipmentStats';
import { QRCodeGenerator, QRCodeScanner, BulkQRGenerator } from '@/components/equipment/QRCodeComponents';
import { ImportExportDialog } from '@/components/equipment/ImportExportDialog';
import { MaintenanceCalendar } from '@/components/equipment/MaintenanceCalendar';
import { OCRCapture } from '@/components/imaging/OCRCapture';
import { format } from 'date-fns';

interface Equipment {
    id: number;
    name: string;
    model: string;
    manufacturer: string;
    serial_number: string;
    location: string;
    status: 'operational' | 'maintenance' | 'faulty' | 'retired';
    last_maintenance?: string;
    next_maintenance?: string;
    notes?: string;
    created_at: string;
}

export function EquipmentPage() {
    const { t } = useTranslation();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showQRGenerator, setShowQRGenerator] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [showBulkQR, setShowBulkQR] = useState(false);
    const [showImportExport, setShowImportExport] = useState(false);

    useEffect(() => {
        const init = async () => {
            await initializeDatabase();
            await loadEquipment();
        };
        init();
    }, []);

    const initializeDatabase = async () => {
        try {
            // Create equipment table if not exists
            await window.electronAPI.db.run(`
                CREATE TABLE IF NOT EXISTS equipment (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    model TEXT,
                    manufacturer TEXT,
                    serial_number TEXT,
                    location TEXT,
                    status TEXT DEFAULT 'operational',
                    last_maintenance TEXT,
                    next_maintenance TEXT,
                    notes TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create maintenance records table if not exists
            await window.electronAPI.db.run(`
                CREATE TABLE IF NOT EXISTS maintenance_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    equipment_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT,
                    performed_by TEXT,
                    performed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    findings TEXT,
                    actions_taken TEXT,
                    parts_replaced TEXT,
                    next_action TEXT,
                    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
                )
            `);

            // Create knowledge base table if not exists
            await window.electronAPI.db.run(`
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    category TEXT,
                    equipment_model TEXT,
                    content TEXT,
                    file_path TEXT,
                    tags TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

        } catch (err) {
            console.error('Failed to initialize equipment database:', err);
        }
    };

    const loadEquipment = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.db.all<Equipment>('SELECT * FROM equipment ORDER BY name');
            setEquipment(result || []);
        } catch (err) {
            console.error('Failed to load equipment:', err);
            setEquipment([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: Equipment['status']) => {
        const variants: Record<Equipment['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
            operational: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
            maintenance: { variant: 'secondary', icon: <Wrench className="h-3 w-3" /> },
            faulty: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
            retired: { variant: 'outline', icon: <Clock className="h-3 w-3" /> }
        };
        const config = variants[status];
        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                {config.icon}
                {t(`equipment.status.${status}`)}
            </Badge>
        );
    };

    const filteredEquipment = equipment.filter(eq =>
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Stats
    const stats = {
        total: equipment.length,
        operational: equipment.filter(e => e.status === 'operational').length,
        maintenance: equipment.filter(e => e.status === 'maintenance').length,
        faulty: equipment.filter(e => e.status === 'faulty').length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Wrench className="h-6 w-6 text-blue-600" />
                    {t('equipment.title')}
                </h1>
                <p className="text-gray-500 mt-1">{t('equipment.subtitle')}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{t('equipment.stats.total')}</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                            <Server className="h-8 w-8 text-gray-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{t('equipment.stats.operational')}</p>
                                <p className="text-2xl font-bold text-green-600">{stats.operational}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{t('equipment.stats.maintenance')}</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
                            </div>
                            <Wrench className="h-8 w-8 text-yellow-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{t('equipment.stats.faulty')}</p>
                                <p className="text-2xl font-bold text-red-600">{stats.faulty}</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="inventory" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="inventory" className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        {t('equipment.tabs.inventory')}
                    </TabsTrigger>
                    <TabsTrigger value="statistics" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        {t('equipment.tabs.statistics')}
                    </TabsTrigger>
                    <TabsTrigger value="diagnostics" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t('equipment.tabs.diagnostics')}
                    </TabsTrigger>
                    <TabsTrigger value="ocr" className="flex items-center gap-2">
                        <ScanText className="h-4 w-4" />
                        {t('equipment.tabs.ocr')}
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        {t('equipment.tabs.knowledge')}
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {t('equipment.tabs.calendar')}
                    </TabsTrigger>
                </TabsList>

                {/* Equipment Inventory Tab */}
                <TabsContent value="inventory" className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={t('equipment.search_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setShowQRScanner(true)}>
                                <QrCode className="h-4 w-4 mr-2" />
                                {t('qr.scan')}
                            </Button>
                            <Button variant="outline" onClick={() => setShowBulkQR(true)} disabled={equipment.length === 0}>
                                <QrCode className="h-4 w-4 mr-2" />
                                {t('qr.bulk')}
                            </Button>
                            <Button variant="outline" onClick={() => setShowImportExport(true)}>
                                <Upload className="h-4 w-4 mr-2" />
                                {t('import.title')}
                            </Button>
                            <Button onClick={() => setShowAddDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('equipment.add_equipment')}
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
                    ) : filteredEquipment.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-gray-500">
                                <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                <p>{t('equipment.no_equipment')}</p>
                                <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('equipment.add_first')}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {filteredEquipment.map((eq) => (
                                <Card key={eq.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                                    setSelectedEquipment(eq);
                                    setShowDetailDialog(true);
                                }}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Server className="h-6 w-6 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{eq.name}</h3>
                                                    <p className="text-sm text-gray-500">
                                                        {eq.manufacturer} {eq.model} | SN: {eq.serial_number || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right text-sm text-gray-500">
                                                    <p>{eq.location || t('equipment.no_location')}</p>
                                                    {eq.next_maintenance && (
                                                        <p className="flex items-center gap-1">
                                                            <CalendarIcon className="h-3 w-3" />
                                                            {format(new Date(eq.next_maintenance), 'yyyy-MM-dd')}
                                                        </p>
                                                    )}
                                                </div>
                                                {getStatusBadge(eq.status)}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Statistics Tab */}
                <TabsContent value="statistics">
                    <EquipmentStats equipment={equipment} />
                </TabsContent>

                {/* Diagnostics Tab - Serial Terminal */}
                <TabsContent value="diagnostics">
                    <SerialTerminal />
                </TabsContent>

                {/* OCR Tab */}
                <TabsContent value="ocr">
                    <OCRCapture />
                </TabsContent>

                {/* Knowledge Base Tab */}
                <TabsContent value="knowledge">
                    <KnowledgeBase />
                </TabsContent>

                {/* Maintenance Calendar Tab */}
                <TabsContent value="calendar">
                    <MaintenanceCalendar
                        equipment={equipment}
                        onEventClick={(event) => {
                            const eq = equipment.find(e => e.id === event.equipment_id);
                            if (eq) {
                                setSelectedEquipment(eq);
                                setShowDetailDialog(true);
                            }
                        }}
                        onDateChange={() => loadEquipment()}
                    />
                </TabsContent>
            </Tabs>

            {/* Equipment Detail Dialog */}
            <EquipmentDetailDialog
                equipment={selectedEquipment}
                open={showDetailDialog}
                onOpenChange={setShowDetailDialog}
                onUpdated={loadEquipment}
            />

            {/* Add Equipment Dialog */}
            <AddEquipmentDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onAdded={loadEquipment}
            />

            {/* QR Code Generator Dialog */}
            {selectedEquipment && (
                <QRCodeGenerator
                    equipment={selectedEquipment}
                    open={showQRGenerator}
                    onOpenChange={setShowQRGenerator}
                />
            )}

            {/* QR Code Scanner Dialog */}
            <QRCodeScanner
                open={showQRScanner}
                onOpenChange={setShowQRScanner}
                onScanned={(eq) => {
                    setSelectedEquipment(eq);
                    setShowQRScanner(false);
                    setShowDetailDialog(true);
                }}
            />

            {/* Bulk QR Generator Dialog */}
            <BulkQRGenerator
                equipment={equipment}
                open={showBulkQR}
                onOpenChange={setShowBulkQR}
            />

            {/* Import/Export Dialog */}
            <ImportExportDialog
                open={showImportExport}
                onOpenChange={setShowImportExport}
                onImported={loadEquipment}
            />
        </div>
    );
}
