import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    Server, Wrench, Plus, Calendar, ClipboardList, FileText,
    AlertTriangle, CheckCircle, XCircle, Clock, Edit2, Save, Trash2
} from 'lucide-react';

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

interface MaintenanceRecord {
    id: number;
    equipment_id: number;
    type: 'preventive' | 'corrective' | 'inspection';
    description: string;
    performed_by: string;
    performed_at: string;
    findings?: string;
    actions_taken?: string;
    parts_replaced?: string;
    next_action?: string;
}

interface EquipmentDetailDialogProps {
    equipment: Equipment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated: () => void;
}

export function EquipmentDetailDialog({
    equipment,
    open,
    onOpenChange,
    onUpdated
}: EquipmentDetailDialogProps) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [showAddMaintenance, setShowAddMaintenance] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form state for editing equipment
    const [formData, setFormData] = useState<Partial<Equipment>>({});

    // Form state for new maintenance record
    const [maintenanceForm, setMaintenanceForm] = useState({
        type: 'inspection' as MaintenanceRecord['type'],
        description: '',
        performed_by: '',
        findings: '',
        actions_taken: '',
        parts_replaced: '',
        next_action: ''
    });

    useEffect(() => {
        if (equipment) {
            setFormData({ ...equipment });
            loadMaintenanceRecords();
        }
    }, [equipment]);

    const loadMaintenanceRecords = async () => {
        if (!equipment) return;
        try {
            const result = await window.electronAPI.db.all<MaintenanceRecord>(
                'SELECT * FROM maintenance_records WHERE equipment_id = ? ORDER BY performed_at DESC',
                [equipment.id]
            );
            setMaintenanceRecords(result || []);
        } catch (err) {
            console.error('Failed to load maintenance records:', err);
        }
    };

    const handleSaveEquipment = async () => {
        if (!equipment) return;
        setLoading(true);
        try {
            await window.electronAPI.db.run(
                `UPDATE equipment SET 
          name = ?, model = ?, manufacturer = ?, serial_number = ?,
          location = ?, status = ?, last_maintenance = ?, next_maintenance = ?, notes = ?
         WHERE id = ?`,
                [
                    formData.name, formData.model, formData.manufacturer, formData.serial_number,
                    formData.location, formData.status, formData.last_maintenance, formData.next_maintenance,
                    formData.notes, equipment.id
                ]
            );
            toast.success(t('equipment.detail.save_success'));
            setIsEditing(false);
            onUpdated();
        } catch (err) {
            console.error('Failed to update equipment:', err);
            toast.error(t('equipment.detail.save_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteEquipment = async () => {
        if (!equipment) return;
        if (!confirm(t('equipment.detail.confirm_delete'))) return;

        setLoading(true);
        try {
            // Delete maintenance records first
            await window.electronAPI.db.run(
                'DELETE FROM maintenance_records WHERE equipment_id = ?',
                [equipment.id]
            );
            // Delete equipment
            await window.electronAPI.db.run(
                'DELETE FROM equipment WHERE id = ?',
                [equipment.id]
            );
            toast.success(t('equipment.detail.delete_success'));
            onOpenChange(false);
            onUpdated();
        } catch (err) {
            console.error('Failed to delete equipment:', err);
            toast.error(t('equipment.detail.delete_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleAddMaintenance = async () => {
        if (!equipment || !maintenanceForm.description) {
            toast.error(t('common.required_fields'));
            return;
        }

        setLoading(true);
        try {
            await window.electronAPI.db.run(
                `INSERT INTO maintenance_records 
          (equipment_id, type, description, performed_by, findings, actions_taken, parts_replaced, next_action)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    equipment.id, maintenanceForm.type, maintenanceForm.description,
                    maintenanceForm.performed_by, maintenanceForm.findings, maintenanceForm.actions_taken,
                    maintenanceForm.parts_replaced, maintenanceForm.next_action
                ]
            );

            // Update equipment last_maintenance date
            await window.electronAPI.db.run(
                'UPDATE equipment SET last_maintenance = ? WHERE id = ?',
                [new Date().toISOString(), equipment.id]
            );

            toast.success(t('equipment.detail.maintenance_added'));
            setShowAddMaintenance(false);
            setMaintenanceForm({
                type: 'inspection',
                description: '',
                performed_by: '',
                findings: '',
                actions_taken: '',
                parts_replaced: '',
                next_action: ''
            });
            loadMaintenanceRecords();
            onUpdated();
        } catch (err) {
            console.error('Failed to add maintenance record:', err);
            toast.error(t('equipment.detail.maintenance_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMaintenance = async (recordId: number) => {
        if (!confirm(t('common.confirm_delete'))) return;
        try {
            await window.electronAPI.db.run(
                'DELETE FROM maintenance_records WHERE id = ?',
                [recordId]
            );
            toast.success(t('common.deleted_success'));
            loadMaintenanceRecords();
        } catch (err) {
            console.error('Failed to delete maintenance record:', err);
            toast.error(t('common.error'));
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

    const getMaintenanceTypeBadge = (type: MaintenanceRecord['type']) => {
        const colors = {
            preventive: 'bg-blue-100 text-blue-800',
            corrective: 'bg-orange-100 text-orange-800',
            inspection: 'bg-green-100 text-green-800'
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}>
                {t(`equipment.detail.maintenance_type.${type}`)}
            </span>
        );
    };

    if (!equipment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Server className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <span>{formData.name}</span>
                            <p className="text-sm font-normal text-gray-500">
                                {formData.manufacturer} {formData.model}
                            </p>
                        </div>
                        <div className="ml-auto">{getStatusBadge(formData.status || 'operational')}</div>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="info" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {t('equipment.detail.info')}
                        </TabsTrigger>
                        <TabsTrigger value="maintenance" className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            {t('equipment.detail.maintenance')} ({maintenanceRecords.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Info Tab */}
                    <TabsContent value="info" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-[350px] pr-4">
                            <div className="space-y-4">
                                {isEditing ? (
                                    // Edit Form
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.name')}</Label>
                                            <Input
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.manufacturer')}</Label>
                                            <Input
                                                value={formData.manufacturer || ''}
                                                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.model')}</Label>
                                            <Input
                                                value={formData.model || ''}
                                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.serial_number')}</Label>
                                            <Input
                                                value={formData.serial_number || ''}
                                                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.location')}</Label>
                                            <Input
                                                value={formData.location || ''}
                                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.status')}</Label>
                                            <Select
                                                value={formData.status}
                                                onValueChange={(v) => setFormData({ ...formData, status: v as Equipment['status'] })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="operational">{t('equipment.status.operational')}</SelectItem>
                                                    <SelectItem value="maintenance">{t('equipment.status.maintenance')}</SelectItem>
                                                    <SelectItem value="faulty">{t('equipment.status.faulty')}</SelectItem>
                                                    <SelectItem value="retired">{t('equipment.status.retired')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.last_maintenance')}</Label>
                                            <Input
                                                type="date"
                                                value={formData.last_maintenance?.slice(0, 10) || ''}
                                                onChange={(e) => setFormData({ ...formData, last_maintenance: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('equipment.detail.next_maintenance')}</Label>
                                            <Input
                                                type="date"
                                                value={formData.next_maintenance?.slice(0, 10) || ''}
                                                onChange={(e) => setFormData({ ...formData, next_maintenance: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>{t('equipment.detail.notes')}</Label>
                                            <Textarea
                                                value={formData.notes || ''}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    // Read-only View
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.manufacturer')}</p>
                                            <p className="font-medium">{formData.manufacturer || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.model')}</p>
                                            <p className="font-medium">{formData.model || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.serial_number')}</p>
                                            <p className="font-medium font-mono">{formData.serial_number || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.location')}</p>
                                            <p className="font-medium">{formData.location || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.last_maintenance')}</p>
                                            <p className="font-medium flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-gray-400" />
                                                {formData.last_maintenance
                                                    ? format(new Date(formData.last_maintenance), 'yyyy-MM-dd')
                                                    : '-'}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.next_maintenance')}</p>
                                            <p className="font-medium flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-gray-400" />
                                                {formData.next_maintenance
                                                    ? format(new Date(formData.next_maintenance), 'yyyy-MM-dd')
                                                    : '-'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.notes')}</p>
                                            <p className="font-medium whitespace-pre-wrap">{formData.notes || '-'}</p>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <p className="text-sm text-gray-500">{t('equipment.detail.registered')}</p>
                                            <p className="font-medium">
                                                {formData.created_at ? format(new Date(formData.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* Maintenance Tab */}
                    <TabsContent value="maintenance" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-[350px] pr-4">
                            <div className="space-y-4">
                                <Button size="sm" onClick={() => setShowAddMaintenance(!showAddMaintenance)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('equipment.detail.add_record')}
                                </Button>

                                {/* Add Maintenance Form */}
                                {showAddMaintenance && (
                                    <Card className="border-dashed">
                                        <CardContent className="pt-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{t('equipment.detail.type')}</Label>
                                                    <Select
                                                        value={maintenanceForm.type}
                                                        onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, type: v as MaintenanceRecord['type'] })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="inspection">{t('equipment.detail.maintenance_type.inspection')}</SelectItem>
                                                            <SelectItem value="preventive">{t('equipment.detail.maintenance_type.preventive')}</SelectItem>
                                                            <SelectItem value="corrective">{t('equipment.detail.maintenance_type.corrective')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('equipment.detail.performed_by')}</Label>
                                                    <Input
                                                        value={maintenanceForm.performed_by}
                                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t('equipment.detail.description')} *</Label>
                                                <Textarea
                                                    value={maintenanceForm.description}
                                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{t('equipment.detail.findings')}</Label>
                                                    <Textarea
                                                        value={maintenanceForm.findings}
                                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, findings: e.target.value })}
                                                        rows={2}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('equipment.detail.actions_taken')}</Label>
                                                    <Textarea
                                                        value={maintenanceForm.actions_taken}
                                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, actions_taken: e.target.value })}
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{t('equipment.detail.parts_replaced')}</Label>
                                                    <Input
                                                        value={maintenanceForm.parts_replaced}
                                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, parts_replaced: e.target.value })}
                                                        placeholder={t('equipment.detail.parts_placeholder')}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('equipment.detail.next_action')}</Label>
                                                    <Input
                                                        value={maintenanceForm.next_action}
                                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, next_action: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" onClick={() => setShowAddMaintenance(false)}>
                                                    {t('common.cancel')}
                                                </Button>
                                                <Button onClick={handleAddMaintenance} disabled={loading}>
                                                    <Save className="h-4 w-4 mr-2" />
                                                    {t('common.save')}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Maintenance Records List */}
                                {maintenanceRecords.length === 0 ? (
                                    <div className="text-center text-gray-400 py-8">
                                        <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>{t('equipment.detail.no_records')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {maintenanceRecords.map(record => (
                                            <Card key={record.id} className="hover:shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            {getMaintenanceTypeBadge(record.type)}
                                                            <span className="text-sm text-gray-500">
                                                                {format(new Date(record.performed_at), 'yyyy-MM-dd HH:mm')}
                                                            </span>
                                                            {record.performed_by && (
                                                                <span className="text-sm text-gray-500">
                                                                    by {record.performed_by}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                                            onClick={() => handleDeleteMaintenance(record.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <p className="mt-2 font-medium">{record.description}</p>
                                                    {record.findings && (
                                                        <div className="mt-2 text-sm">
                                                            <span className="text-gray-500">{t('equipment.detail.findings')}:</span>{' '}
                                                            {record.findings}
                                                        </div>
                                                    )}
                                                    {record.actions_taken && (
                                                        <div className="mt-1 text-sm">
                                                            <span className="text-gray-500">{t('equipment.detail.actions_taken')}:</span>{' '}
                                                            {record.actions_taken}
                                                        </div>
                                                    )}
                                                    {record.parts_replaced && (
                                                        <div className="mt-1 text-sm">
                                                            <span className="text-gray-500">{t('equipment.detail.parts_replaced')}:</span>{' '}
                                                            <Badge variant="outline">{record.parts_replaced}</Badge>
                                                        </div>
                                                    )}
                                                    {record.next_action && (
                                                        <div className="mt-2 p-2 bg-yellow-50 rounded text-sm flex items-center gap-2">
                                                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                                            <span className="text-yellow-800">{record.next_action}</span>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSaveEquipment} disabled={loading}>
                                <Save className="h-4 w-4 mr-2" />
                                {t('common.save')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="destructive" onClick={handleDeleteEquipment} disabled={loading}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
                            </Button>
                            <Button variant="outline" onClick={() => setIsEditing(true)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
