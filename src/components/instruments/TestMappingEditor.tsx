import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInstruments } from '@/hooks/use-instruments';
import { InstrumentTestMapping, testPanelService, TestPanel } from '@/services/database.service';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TestMappingEditorProps {
    instrumentId: number;
}

export function TestMappingEditor({ instrumentId }: TestMappingEditorProps) {
    const { t } = useTranslation();
    const { getTestMappings, createTestMapping, deleteTestMapping } = useInstruments();

    const [mappings, setMappings] = useState<(InstrumentTestMapping & { panel_name: string; panel_code: string })[]>([]);
    const [testPanels, setTestPanels] = useState<TestPanel[]>([]);
    const [loading, setLoading] = useState(true);

    const [newMapping, setNewMapping] = useState({
        instrument_code: '',
        panel_id: '',
        conversion_factor: 1.0,
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            if (window.electronAPI) {
                const [loadedMappings, loadedPanels] = await Promise.all([
                    getTestMappings(instrumentId),
                    testPanelService.getAll()
                ]);
                setMappings(loadedMappings);
                setTestPanels(loadedPanels);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            toast.error(t('common.error_occurred'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [instrumentId]);

    const handleAdd = async () => {
        if (!newMapping.instrument_code || !newMapping.panel_id) {
            toast.error(t('common.required_fields'));
            return;
        }

        // Check for duplicate code
        if (mappings.some(m => m.instrument_code === newMapping.instrument_code)) {
            toast.error(t('mappings.code_exists'));
            return;
        }

        const success = await createTestMapping({
            instrument_id: instrumentId,
            instrument_code: newMapping.instrument_code,
            panel_id: parseInt(newMapping.panel_id),
            conversion_factor: newMapping.conversion_factor,
        });

        if (success) {
            toast.success(t('common.saved_success'));
            setNewMapping({ instrument_code: '', panel_id: '', conversion_factor: 1.0 });
            fetchData(); // Refresh list
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm(t('common.confirm_delete'))) {
            const success = await deleteTestMapping(id);
            if (success) {
                toast.success(t('common.deleted_success'));
                fetchData();
            }
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-gray-400" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 p-4 rounded-lg border">
                <div className="space-y-2">
                    <Label>{t('mappings.instrument_code')}</Label>
                    <Input
                        placeholder={t('mappings.instrument_code_placeholder')}
                        value={newMapping.instrument_code}
                        onChange={e => setNewMapping(prev => ({ ...prev, instrument_code: e.target.value }))}
                    />
                </div>
                <div className="space-y-2 col-span-1 md:col-span-1">
                    <Label>{t('mappings.lims_panel')}</Label>
                    <Select
                        value={newMapping.panel_id}
                        onChange={e => setNewMapping(prev => ({ ...prev, panel_id: e.target.value }))}
                    >
                        <option value="">{t('mappings.select_panel')}</option>
                        {testPanels.map(panel => (
                            <option key={panel.id} value={panel.id}>
                                {panel.code} - {t(panel.name)}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>{t('mappings.factor')}</Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={newMapping.conversion_factor}
                        onChange={e => setNewMapping(prev => ({ ...prev, conversion_factor: parseFloat(e.target.value) }))}
                    />
                </div>
                <Button onClick={handleAdd}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('common.add')}
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('mappings.instrument_code')}</TableHead>
                            <TableHead>{t('mappings.lims_panel')}</TableHead>
                            <TableHead>{t('mappings.factor')}</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mappings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                    {t('mappings.no_mappings')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            mappings.map((mapping) => (
                                <TableRow key={mapping.id}>
                                    <TableCell className="font-medium font-mono">{mapping.instrument_code}</TableCell>
                                    <TableCell>{mapping.panel_code} - {t(mapping.panel_name)}</TableCell>
                                    <TableCell>{mapping.conversion_factor}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(mapping.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
