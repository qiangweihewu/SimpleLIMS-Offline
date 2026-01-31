import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Loader2 } from 'lucide-react';
import { useTestPanels } from '@/hooks/use-test-panels';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TestPanel } from '@/services/database.service';
import { toast } from 'sonner';

export function TestCatalogPage() {
  const { t } = useTranslation();
  const { testPanels, loading, createPanel, updatePanel, toggleActive } = useTestPanels();
  const [searchTerm, setSearchTerm] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<TestPanel | null>(null);

  const filteredPanels = testPanels.filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t(p.name).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'hematology': return t('catalog.categories.hematology');
      case 'chemistry': return t('catalog.categories.chemistry');
      case 'immuno': return t('catalog.categories.immuno');
      default: return t('catalog.categories.other');
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'hematology': return 'bg-red-100 text-red-800';
      case 'chemistry': return 'bg-blue-100 text-blue-800';
      case 'immuno': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEdit = (panel: TestPanel) => {
    setEditingPanel(panel);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingPanel(null);
    setDialogOpen(true);
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    await toggleActive(id, !current);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      unit: formData.get('unit') as string,
      ref_range_male_low: Number(formData.get('ref_range_male_low')) || undefined,
      ref_range_male_high: Number(formData.get('ref_range_male_high')) || undefined,
      ref_range_female_low: Number(formData.get('ref_range_female_low')) || undefined,
      ref_range_female_high: Number(formData.get('ref_range_female_high')) || undefined,
      sort_order: Number(formData.get('sort_order')) || 0,
      decimal_places: Number(formData.get('decimal_places')) || 0,
    };

    let success = false;
    if (editingPanel) {
      success = await updatePanel(editingPanel.id, data);
    } else {
      success = await createPanel(data);
    }

    if (success) {
      toast.success(editingPanel ? t('catalog.messages.update_success') : t('catalog.messages.create_success'));
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('catalog.title')}</h1><p className="text-gray-500">{t('catalog.subtitle')}</p></div>
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />{t('catalog.add_item')}</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder={t('catalog.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <CardTitle className="text-sm text-gray-500">{t('catalog.total_items', { count: filteredPanels.length })}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('catalog.table.code')}</TableHead>
                  <TableHead>{t('catalog.table.name')}</TableHead>
                  <TableHead>{t('catalog.table.category')}</TableHead>
                  <TableHead>{t('catalog.table.unit')}</TableHead>
                  <TableHead>{t('catalog.table.ref_male')}</TableHead>
                  <TableHead>{t('catalog.table.ref_female')}</TableHead>
                  <TableHead>{t('catalog.table.status')}</TableHead>
                  <TableHead className="text-right">{t('catalog.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPanels.map((panel) => (
                  <TableRow key={panel.id}>
                    <TableCell className="font-mono font-medium">{panel.code}</TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {t(panel.name)}
                      </span>
                    </TableCell>
                    <TableCell><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(panel.category)}`}>{getCategoryLabel(panel.category)}</span></TableCell>
                    <TableCell>{panel.unit}</TableCell>
                    <TableCell>{panel.ref_range_male_low} - {panel.ref_range_male_high}</TableCell>
                    <TableCell>{panel.ref_range_female_low} - {panel.ref_range_female_high}</TableCell>
                    <TableCell>
                      <Badge
                        variant={panel.is_active ? 'success' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(panel.id, panel.is_active)}
                      >
                        {panel.is_active ? t('catalog.status.active') : t('catalog.status.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEdit(panel)}><Edit className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border border-gray-200 bg-white shadow-lg">
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              {editingPanel ? t('catalog.form.title_edit') : t('catalog.form.title_add')}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2"><Label htmlFor="code" className="text-xs font-medium text-gray-700">{t('catalog.form.code')}</Label><Input id="code" name="code" defaultValue={editingPanel?.code} required /></div>
              <div className="space-y-2"><Label htmlFor="name" className="text-xs font-medium text-gray-700">{t('catalog.form.name')}</Label><Input id="name" name="name" defaultValue={editingPanel ? t(editingPanel.name) : ''} required /></div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs font-medium text-gray-700">{t('catalog.form.category')}</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue={editingPanel?.category || 'hematology'}
                  className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white"
                >
                  <option value="hematology">{t('catalog.categories.hematology')}</option>
                  <option value="chemistry">{t('catalog.categories.chemistry')}</option>
                  <option value="immuno">{t('catalog.categories.immuno')}</option>
                  <option value="other">{t('catalog.categories.other')}</option>
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="unit" className="text-xs font-medium text-gray-700">{t('catalog.form.unit')}</Label><Input id="unit" name="unit" defaultValue={editingPanel?.unit} /></div>

              <div className="col-span-2 py-1 border-b border-gray-100 mt-2"><Label className="text-sm font-bold text-primary">{t('catalog.form.ref_range_male')}</Label></div>
              <div className="space-y-2"><Label htmlFor="ref_range_male_low" className="text-xs text-gray-500">{t('catalog.form.low')}</Label><Input id="ref_range_male_low" name="ref_range_male_low" type="number" step="0.01" defaultValue={editingPanel?.ref_range_male_low} /></div>
              <div className="space-y-2"><Label htmlFor="ref_range_male_high" className="text-xs text-gray-500">{t('catalog.form.high')}</Label><Input id="ref_range_male_high" name="ref_range_male_high" type="number" step="0.01" defaultValue={editingPanel?.ref_range_male_high} /></div>

              <div className="col-span-2 py-1 border-b border-gray-100 mt-2"><Label className="text-sm font-bold text-primary">{t('catalog.form.ref_range_female')}</Label></div>
              <div className="space-y-2"><Label htmlFor="ref_range_female_low" className="text-xs text-gray-500">{t('catalog.form.low')}</Label><Input id="ref_range_female_low" name="ref_range_female_low" type="number" step="0.01" defaultValue={editingPanel?.ref_range_female_low} /></div>
              <div className="space-y-2"><Label htmlFor="ref_range_female_high" className="text-xs text-gray-500">{t('catalog.form.high')}</Label><Input id="ref_range_female_high" name="ref_range_female_high" type="number" step="0.01" defaultValue={editingPanel?.ref_range_female_high} /></div>

              <div className="space-y-2 mt-2"><Label htmlFor="sort_order" className="text-xs font-medium text-gray-700">{t('catalog.form.sort')}</Label><Input id="sort_order" name="sort_order" type="number" defaultValue={editingPanel?.sort_order || 0} /></div>
              <div className="space-y-2 mt-2"><Label htmlFor="decimal_places" className="text-xs font-medium text-gray-700">{t('catalog.form.decimals')}</Label><Input id="decimal_places" name="decimal_places" type="number" defaultValue={editingPanel?.decimal_places || 0} /></div>
            </div>
            <DialogFooter className="pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
