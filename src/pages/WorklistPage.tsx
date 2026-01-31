import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Clock, AlertCircle, Play, Printer, Loader2, Check } from 'lucide-react';
import { useWorklist } from '@/hooks/use-worklist';
import { WorklistItem } from '@/services/database.service';
import { getDisplayName, getPatientNameFromObject } from '@/lib/utils';

const priorityConfig: Record<string, { variant: 'default' | 'warning' | 'destructive' }> = {
  normal: { variant: 'default' },
  urgent: { variant: 'warning' },
  stat: { variant: 'destructive' },
};

export function WorklistPage() {
  const { t, i18n } = useTranslation();
  const { items, loading, updateStatus } = useWorklist();
  const [processingIds, setProcessingIds] = useState<number[]>([]);

  // Calculate stats
  const totalPending = items.length;
  const urgentCount = items.filter(i => i.priority === 'urgent' || i.priority === 'stat').length;

  // Group by Category (Department)
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, WorklistItem[]>);

  const handleStart = async (id: number) => {
    setProcessingIds(prev => [...prev, id]);
    await updateStatus([id], 'processing');
    setProcessingIds(prev => prev.filter(pid => pid !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'hematology': return t('catalog.categories.hematology');
      case 'chemistry': return t('catalog.categories.chemistry');
      case 'immuno': return t('catalog.categories.immuno');
      default: return t('catalog.categories.other');
    }
  };

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="flex justify-between items-center print:hidden">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('worklist.title')}</h1><p className="text-gray-500">{t('worklist.subtitle')}</p></div>
        <Button onClick={handlePrint} variant="outline"><Printer className="h-4 w-4 mr-2" />Print</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-100"><ClipboardList className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">{t('worklist.total_pending')}</p><p className="text-xl font-bold">{totalPending}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-red-100"><AlertCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-gray-500">{t('worklist.urgent_samples')}</p><p className="text-xl font-bold">{urgentCount}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-100"><Clock className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-gray-500">{t('worklist.avg_wait')}</p><p className="text-xl font-bold">-- {t('worklist.minutes')}</p></div></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <Card key={category} className="print:shadow-none print:border">
              <CardHeader className="print:py-2">
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${category === 'hematology' ? 'bg-red-500' : category === 'chemistry' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                  {getCategoryLabel(category)}
                </CardTitle>
              </CardHeader>
              <CardContent className="print:py-2">
                <div className="space-y-3">
                  {categoryItems.map((item) => (
                    <div key={item.order_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg print:bg-white print:border print:p-2">
                      <div>
                        <p className="font-mono font-medium">{item.sample_id}</p>
                        <p className="text-sm text-gray-500">
                          {getPatientNameFromObject(item, i18n.language)} · {getDisplayName(item.test_name, item.test_name_en, i18n.language)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={priorityConfig[item.priority]?.variant || 'default'}>{t(`samples.priority.${item.priority}`)}</Badge>
                        <Button
                          size="sm"
                          variant={item.order_status === 'processing' ? 'secondary' : 'outline'}
                          onClick={() => handleStart(item.order_id)}
                          disabled={item.order_status === 'processing' || processingIds.includes(item.order_id)}
                          className="print:hidden min-w-[80px]"
                        >
                          {processingIds.includes(item.order_id) ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : item.order_status === 'processing' ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          {processingIds.includes(item.order_id)
                            ? t('common.processing')
                            : item.order_status === 'processing'
                              ? t('worklist.started') || 'Started'
                              : t('worklist.start')}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {categoryItems.length === 0 && <p className="text-gray-500 text-center py-4">{t('common.no_data')}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed">
              {t('common.no_data')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

