import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Server, Save } from 'lucide-react';

interface AddEquipmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdded: () => void;
}

export function AddEquipmentDialog({ open, onOpenChange, onAdded }: AddEquipmentDialogProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        location: '',
        status: 'operational' as 'operational' | 'maintenance' | 'faulty' | 'retired',
        next_maintenance: '',
        notes: ''
    });

    const resetForm = () => {
        setFormData({
            name: '',
            manufacturer: '',
            model: '',
            serial_number: '',
            location: '',
            status: 'operational',
            next_maintenance: '',
            notes: ''
        });
    };

    const handleSubmit = async () => {
        if (!formData.name) {
            toast.error(t('common.required_fields'));
            return;
        }

        setLoading(true);
        try {
            await window.electronAPI.db.run(
                `INSERT INTO equipment 
                    (name, manufacturer, model, serial_number, location, status, next_maintenance, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    formData.name,
                    formData.manufacturer,
                    formData.model,
                    formData.serial_number,
                    formData.location,
                    formData.status,
                    formData.next_maintenance || null,
                    formData.notes
                ]
            );
            toast.success(t('equipment.add_success'));
            resetForm();
            onOpenChange(false);
            onAdded();
        } catch (err) {
            console.error('Failed to add equipment:', err);
            toast.error(t('equipment.add_failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) resetForm();
            onOpenChange(isOpen);
        }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Server className="h-4 w-4 text-blue-600" />
                        </div>
                        {t('equipment.add_equipment')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('equipment.add_desc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Equipment Name */}
                    <div className="space-y-2">
                        <Label>{t('equipment.detail.name')} *</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder={t('equipment.form.name_placeholder')}
                        />
                    </div>

                    {/* Manufacturer & Model */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('equipment.detail.manufacturer')}</Label>
                            <Input
                                value={formData.manufacturer}
                                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                                placeholder="e.g., Mindray"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('equipment.detail.model')}</Label>
                            <Input
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                placeholder="e.g., BC-3000"
                            />
                        </div>
                    </div>

                    {/* Serial Number & Location */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('equipment.detail.serial_number')}</Label>
                            <Input
                                value={formData.serial_number}
                                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                placeholder="e.g., SN-12345678"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('equipment.detail.location')}</Label>
                            <Input
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder={t('equipment.form.location_placeholder')}
                            />
                        </div>
                    </div>

                    {/* Status & Next Maintenance */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('equipment.detail.status')}</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => setFormData({ ...formData, status: v as typeof formData.status })}
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
                            <Label>{t('equipment.detail.next_maintenance')}</Label>
                            <Input
                                type="date"
                                value={formData.next_maintenance}
                                onChange={(e) => setFormData({ ...formData, next_maintenance: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>{t('equipment.detail.notes')}</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder={t('equipment.form.notes_placeholder')}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? t('common.loading') : t('common.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
