import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Loader2 } from 'lucide-react';
import { useTestPanels } from '@/hooks/use-test-panels';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TestPanel } from '@/services/database.service';
import { toast } from 'sonner';

const categoryLabels: Record<string, { label: string; color: string }> = {
  hematology: { label: '血液学', color: 'bg-red-100 text-red-800' },
  chemistry: { label: '生化', color: 'bg-blue-100 text-blue-800' },
  immuno: { label: '免疫', color: 'bg-purple-100 text-purple-800' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-800' },
};

export function TestCatalogPage() {
  const { testPanels, loading, createPanel, updatePanel, toggleActive } = useTestPanels();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<TestPanel | null>(null);

  const filteredPanels = testPanels.filter(p => 
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.name.includes(searchTerm)
  );

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
      toast.success(editingPanel ? '更新成功' : '创建成功');
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">检验项目</h1><p className="text-gray-500">管理检验项目目录和参考范围</p></div>
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />新增项目</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="搜索项目代码或名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <CardTitle className="text-sm text-gray-500">共 {filteredPanels.length} 个项目</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>参考范围 (男)</TableHead>
                  <TableHead>参考范围 (女)</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPanels.map((panel) => (
                  <TableRow key={panel.id}>
                    <TableCell className="font-mono font-medium">{panel.code}</TableCell>
                    <TableCell className="font-medium">{panel.name}</TableCell>
                    <TableCell><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${categoryLabels[panel.category]?.color || 'bg-gray-100'}`}>{categoryLabels[panel.category]?.label || panel.category}</span></TableCell>
                    <TableCell>{panel.unit}</TableCell>
                    <TableCell>{panel.ref_range_male_low} - {panel.ref_range_male_high}</TableCell>
                    <TableCell>{panel.ref_range_female_low} - {panel.ref_range_female_high}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={panel.is_active ? 'success' : 'secondary'} 
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(panel.id, panel.is_active)}
                      >
                        {panel.is_active ? '启用' : '停用'}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPanel ? '编辑项目' : '新增项目'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2"><Label htmlFor="code">项目代码</Label><Input id="code" name="code" defaultValue={editingPanel?.code} required /></div>
              <div className="space-y-2"><Label htmlFor="name">项目名称</Label><Input id="name" name="name" defaultValue={editingPanel?.name} required /></div>
              
              <div className="space-y-2"><Label htmlFor="category">类别</Label><Input id="category" name="category" defaultValue={editingPanel?.category || 'hematology'} /></div>
              <div className="space-y-2"><Label htmlFor="unit">单位</Label><Input id="unit" name="unit" defaultValue={editingPanel?.unit} /></div>
              
              <div className="col-span-2"><Label>参考范围 (男性)</Label></div>
              <div className="space-y-2"><Label htmlFor="ref_range_male_low" className="text-xs text-gray-500">下限</Label><Input id="ref_range_male_low" name="ref_range_male_low" type="number" step="0.01" defaultValue={editingPanel?.ref_range_male_low} /></div>
              <div className="space-y-2"><Label htmlFor="ref_range_male_high" className="text-xs text-gray-500">上限</Label><Input id="ref_range_male_high" name="ref_range_male_high" type="number" step="0.01" defaultValue={editingPanel?.ref_range_male_high} /></div>

              <div className="col-span-2"><Label>参考范围 (女性)</Label></div>
              <div className="space-y-2"><Label htmlFor="ref_range_female_low" className="text-xs text-gray-500">下限</Label><Input id="ref_range_female_low" name="ref_range_female_low" type="number" step="0.01" defaultValue={editingPanel?.ref_range_female_low} /></div>
              <div className="space-y-2"><Label htmlFor="ref_range_female_high" className="text-xs text-gray-500">上限</Label><Input id="ref_range_female_high" name="ref_range_female_high" type="number" step="0.01" defaultValue={editingPanel?.ref_range_female_high} /></div>
              
              <div className="space-y-2"><Label htmlFor="sort_order">排序</Label><Input id="sort_order" name="sort_order" type="number" defaultValue={editingPanel?.sort_order || 0} /></div>
              <div className="space-y-2"><Label htmlFor="decimal_places">小数位数</Label><Input id="decimal_places" name="decimal_places" type="number" defaultValue={editingPanel?.decimal_places || 0} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
