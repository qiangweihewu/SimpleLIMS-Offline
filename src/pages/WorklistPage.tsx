import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Clock, AlertCircle, Play } from 'lucide-react';

const priorityConfig: Record<string, { variant: 'default' | 'warning' | 'destructive' }> = {
  normal: { variant: 'default' },
  urgent: { variant: 'warning' },
  stat: { variant: 'destructive' },
};

export function WorklistPage() {
  const { t } = useTranslation();

  const worklistItems = [
    { sample_id: 'S-20260129-001', patient: '张三', tests: ['CBC'], instrument: 'Sysmex XP-100', priority: 'normal', waiting: '15 ' + t('worklist.minutes') },
    { sample_id: 'S-20260129-002', patient: '李四', tests: ['CMP', 'Lipid'], instrument: 'Mindray BC-3000', priority: 'urgent', waiting: '30 ' + t('worklist.minutes') },
    { sample_id: 'S-20260129-003', patient: '王五', tests: ['CBC'], instrument: 'Sysmex XP-100', priority: 'normal', waiting: '45 ' + t('worklist.minutes') },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('worklist.title')}</h1><p className="text-gray-500">{t('worklist.subtitle')}</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-100"><ClipboardList className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">{t('worklist.total_pending')}</p><p className="text-xl font-bold">{worklistItems.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-red-100"><AlertCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-gray-500">{t('worklist.urgent_samples')}</p><p className="text-xl font-bold">0</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-100"><Clock className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-gray-500">{t('worklist.avg_wait')}</p><p className="text-xl font-bold">24 {t('worklist.minutes')}</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />Sysmex XP-100</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {worklistItems.filter(w => w.instrument === 'Sysmex XP-100').map((item) => (
                <div key={item.sample_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div><p className="font-mono font-medium">{item.sample_id}</p><p className="text-sm text-gray-500">{item.patient} · {item.tests.join(', ')}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityConfig[item.priority].variant}>{t(`samples.priority.${item.priority}`)}</Badge>
                    <span className="text-xs text-gray-400">{item.waiting}</span>
                    <Button size="sm" variant="outline"><Play className="h-3 w-3 mr-1" />{t('worklist.start')}</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />Mindray BC-3000</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {worklistItems.filter(w => w.instrument === 'Mindray BC-3000').map((item) => (
                <div key={item.sample_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div><p className="font-mono font-medium">{item.sample_id}</p><p className="text-sm text-gray-500">{item.patient} · {item.tests.join(', ')}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityConfig[item.priority].variant}>{t(`samples.priority.${item.priority}`)}</Badge>
                    <span className="text-xs text-gray-400">{item.waiting}</span>
                    <Button size="sm" variant="outline"><Play className="h-3 w-3 mr-1" />{t('worklist.start')}</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
