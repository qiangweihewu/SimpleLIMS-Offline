import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search, Printer, Download, Eye, Calendar, Loader2 } from 'lucide-react';
import { useSamples } from '@/hooks/use-samples';

const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  registered: { label: '已登记', variant: 'secondary' },
  in_progress: { label: '检测中', variant: 'default' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

export function ReportsPage() {
  const { samples, loading } = useSamples();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter for completed samples (which are "reports" candidates)
  const completedSamples = useMemo(() => samples.filter(s => s.status === 'completed'), [samples]);
  
  const filteredReports = useMemo(() => completedSamples.filter(r => 
    r.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.last_name + r.first_name).includes(searchTerm)
  ), [completedSamples, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = now.toISOString().slice(0, 7);

    return {
      today: completedSamples.filter(s => s.updated_at.startsWith(today)).length,
      month: completedSamples.filter(s => s.updated_at.startsWith(thisMonth)).length,
      total: completedSamples.length
    };
  }, [completedSamples]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">报告中心</h1><p className="text-gray-500">查看、打印和导出检验报告</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-100"><FileText className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">今日完成</p><p className="text-xl font-bold">{stats.today}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-100"><FileText className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-gray-500">本月完成</p><p className="text-xl font-bold">{stats.month}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-green-100"><Printer className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-gray-500">累计报告</p><p className="text-xl font-bold">{stats.total}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-purple-100"><Calendar className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-gray-500">总样本数</p><p className="text-xl font-bold">{samples.length}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="搜索样本 ID 或患者姓名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>样本 ID</TableHead>
                  <TableHead>患者</TableHead>
                  <TableHead>检验项目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>完成时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      没有找到已完成的报告
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono">{report.sample_id}</TableCell>
                      <TableCell className="font-medium">{report.last_name}{report.first_name}</TableCell>
                      <TableCell>{report.tests || '-'}</TableCell>
                      <TableCell><Badge variant={statusConfig[report.status]?.variant || 'secondary'}>{statusConfig[report.status]?.label || report.status}</Badge></TableCell>
                      <TableCell>{new Date(report.updated_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Printer className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
