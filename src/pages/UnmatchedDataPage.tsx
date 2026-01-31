import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Link2, Trash2, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUnmatchedData } from '@/hooks/use-unmatched-data';
import { sampleService } from '@/services/database.service';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UnmatchedDataPage() {
  const { t } = useTranslation();
  const { data, loading, claimData, discardData, pagination } = useUnmatchedData();
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedDataId, setSelectedDataId] = useState<number | null>(null);
  const [targetSampleId, setTargetSampleId] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleClaimClick = (id: number) => {
    setSelectedDataId(id);
    setTargetSampleId('');
    setClaimDialogOpen(true);
  };

  const handleClaimSubmit = async () => {
    if (!targetSampleId || !selectedDataId) return;

    try {
      setVerifying(true);
      // Verify sample exists
      const sample = await sampleService.getBySampleId(targetSampleId);
      if (!sample) {
        toast.error(t('unmatched.messages.sample_not_found'));
        return;
      }

      const success = await claimData(selectedDataId, sample.id, 1); // Mock user ID 1
      if (success) {
        toast.success(t('unmatched.messages.claim_success'));
        setClaimDialogOpen(false);
      } else {
        toast.error(t('unmatched.messages.claim_failed'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
    } finally {
      setVerifying(false);
    }
  };

  const handleDiscard = async (id: number) => {
    if (confirm(t('unmatched.messages.confirm_discard'))) {
      const success = await discardData(id, 'manual_discard');
      if (success) {
        toast.success(t('unmatched.messages.discard_success'));
      } else {
        toast.error(t('unmatched.messages.discard_failed'));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('unmatched.title')}</h1><p className="text-gray-500">{t('unmatched.subtitle')}</p></div>

      {data.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertCircle className="h-6 w-6 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">{t('unmatched.alert_title', { count: data.length })}</p>
              <p className="text-sm text-orange-600">{t('unmatched.alert_desc')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t('unmatched.pending_list')}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-4">
              {data.map((item) => {
                const parsed = item.parsed_data ? JSON.parse(item.parsed_data) : {};
                const results = parsed.results || [];
                const preview = results.map((r: { universalTestId: string; dataValue: string }) =>
                  `${r.universalTestId?.split('^')[3] || r.universalTestId}: ${r.dataValue}`
                ).join(', ').slice(0, 50) + '...';

                return (
                  <div key={item.id} className="p-4 border rounded-lg bg-white">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="warning">{t('common.status')}: {t('unmatched.pending_list')}</Badge>
                          <span className="text-sm text-gray-500">{t('unmatched.instrument_id')}: {item.instrument_id}</span>
                        </div>
                        <div>
                          <p className="font-mono text-lg">{t('unmatched.raw_id')}: {item.sample_id_raw || 'N/A'}</p>
                          <p className="text-sm text-gray-500">{t('unmatched.received_at')}: {new Date(item.received_at).toLocaleString()} · {t('unmatched.tests_count', { count: results.length })}</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded text-sm font-mono text-gray-600">{preview}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />{t('unmatched.view')}</Button>
                        <Button size="sm" onClick={() => handleClaimClick(item.id)}><Link2 className="h-4 w-4 mr-1" />{t('unmatched.claim')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDiscard(item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {data.length === 0 && (
                <div className="text-center py-8 text-gray-500"><AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p>{t('unmatched.no_data')}</p></div>
              )}
            </div>
          )}
          <div className="flex items-center justify-end space-x-2 border-t pt-4">
            <div className="text-sm text-gray-500 mr-4">{t('common.total')}: {pagination.total}</div>
            <Button variant="outline" size="sm" onClick={() => pagination.setPage(p => Math.max(1, p - 1))} disabled={pagination.page === 1}>{t('common.previous')}</Button>
            <span className="text-sm text-gray-500">{t('common.page_of', { page: pagination.page, total: pagination.totalPages || 1 })}</span>
            <Button variant="outline" size="sm" onClick={() => pagination.setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page === pagination.totalPages}>{t('common.next')}</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="p-0 overflow-hidden border border-gray-200 bg-white shadow-lg sm:max-w-[450px]">
          <div className="bg-blue-600 px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">
              {t('unmatched.dialog.title')}
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sample-id" className="text-xs font-semibold text-gray-700">{t('unmatched.dialog.label')}</Label>
              <Input
                id="sample-id"
                value={targetSampleId}
                onChange={(e) => setTargetSampleId(e.target.value)}
                placeholder={t('unmatched.dialog.placeholder')}
                className="h-11"
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t border-gray-100 flex gap-2">
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleClaimSubmit} disabled={verifying || !targetSampleId}>
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('unmatched.dialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
