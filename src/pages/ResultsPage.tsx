import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Check, AlertTriangle, Edit, CheckCircle, Loader2 } from 'lucide-react';
import { cn, getFlagColor, getApplicableRefRange, getResultFlag, isNumeric, getDisplayName, getPatientNameFromObject, performDeltaCheck } from '@/lib/utils';
import { toast } from 'sonner';
import { useResults } from '@/hooks/use-results';
import { CriticalValueAlert, type CriticalResult } from '@/components/CriticalValueAlert';
import { DeltaCheckAlert, type DeltaAlertData } from '@/components/DeltaCheckAlert';
import type { PendingResult } from '@/services/database.service';
import { deltaCheckService } from '@/services/database.service';

const ACKNOWLEDGED_CRITICAL_KEY = 'simplelims_acknowledged_critical_values';
const ACKNOWLEDGED_DELTA_KEY = 'simplelims_acknowledged_delta_checks';

function getAcknowledgedCriticalValues(): Set<number> {
  try {
    const stored = localStorage.getItem(ACKNOWLEDGED_CRITICAL_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function saveAcknowledgedCriticalValue(resultId: number): void {
  const acknowledged = getAcknowledgedCriticalValues();
  acknowledged.add(resultId);
  localStorage.setItem(ACKNOWLEDGED_CRITICAL_KEY, JSON.stringify([...acknowledged]));
}

function getAcknowledgedDeltaChecks(): Set<number> {
  try {
    const stored = localStorage.getItem(ACKNOWLEDGED_DELTA_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function saveAcknowledgedDeltaCheck(resultId: number): void {
  const acknowledged = getAcknowledgedDeltaChecks();
  acknowledged.add(resultId);
  localStorage.setItem(ACKNOWLEDGED_DELTA_KEY, JSON.stringify([...acknowledged]));
}

export function ResultsPage() {
  const { t, i18n } = useTranslation();
  const { results, loading, verifyResult, updateResult } = useResults();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<PendingResult | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [criticalAlertOpen, setCriticalAlertOpen] = useState(false);
  const [currentCriticalResult, setCurrentCriticalResult] = useState<CriticalResult | null>(null);
  const [unacknowledgedCriticalResults, setUnacknowledgedCriticalResults] = useState<CriticalResult[]>([]);
  const [deltaAlertOpen, setDeltaAlertOpen] = useState(false);
  const [currentDeltaAlert, setCurrentDeltaAlert] = useState<DeltaAlertData | null>(null);
  const [unacknowledgedDeltaAlerts, setUnacknowledgedDeltaAlerts] = useState<DeltaAlertData[]>([]);

  const buildCriticalResult = useCallback((result: PendingResult): CriticalResult | null => {
    if (result.flag !== 'HH' && result.flag !== 'LL') return null;
    const refRange = getApplicableRefRange(result.gender, result.date_of_birth, result);
    return {
      id: result.id,
      value: result.value || '',
      unit: result.unit,
      refRangeLow: refRange.low,
      refRangeHigh: refRange.high,
      patientName: getPatientNameFromObject(result, i18n.language),
      testName: getDisplayName(result.test_name, result.test_name_en, i18n.language),
      flag: result.flag,
    };
  }, [i18n.language]);

  useEffect(() => {
    if (!loading && results.length > 0) {
      const acknowledged = getAcknowledgedCriticalValues();
      const criticalResults = results
        .filter(r => (r.flag === 'HH' || r.flag === 'LL') && !acknowledged.has(r.id))
        .map(r => buildCriticalResult(r))
        .filter((r): r is CriticalResult => r !== null);

      setUnacknowledgedCriticalResults(criticalResults);
      if (criticalResults.length > 0 && !criticalAlertOpen) {
        setCurrentCriticalResult(criticalResults[0]);
        setCriticalAlertOpen(true);
      }
    }
  }, [loading, results, buildCriticalResult, criticalAlertOpen]);

  const handleCriticalAcknowledge = (resultId: number) => {
    saveAcknowledgedCriticalValue(resultId);
    const remaining = unacknowledgedCriticalResults.filter(r => r.id !== resultId);
    setUnacknowledgedCriticalResults(remaining);
    if (remaining.length > 0) {
      setCurrentCriticalResult(remaining[0]);
    } else {
      setCriticalAlertOpen(false);
      setCurrentCriticalResult(null);
    }
  };

  const handleDeltaAcknowledge = (resultId: number) => {
    saveAcknowledgedDeltaCheck(resultId);
    const remaining = unacknowledgedDeltaAlerts.filter(r => r.id !== resultId);
    setUnacknowledgedDeltaAlerts(remaining);
    if (remaining.length > 0) {
      setCurrentDeltaAlert(remaining[0]);
    } else {
      setDeltaAlertOpen(false);
      setCurrentDeltaAlert(null);
    }
  };

  // Load Delta Check data for numeric results
  useEffect(() => {
    const loadDeltaCheckData = async () => {
      if (!results.length) return;

      const deltaAcknowledged = getAcknowledgedDeltaChecks();
      const newDeltaAlerts: DeltaAlertData[] = [];

      for (const result of results) {
        if (!result.value || !isNumeric(result.value) || deltaAcknowledged.has(result.id)) {
          continue;
        }

        try {
          const history = await deltaCheckService.getPatientTestHistory(
            result.patient_id,
            result.panel_id,
            14 // 14 days lookback
          );

          if (history && history.length > 0) {
            // Filter out null numeric_value entries
            const historyForDeltaCheck = history
              .filter(h => h.numeric_value !== null && h.numeric_value !== undefined)
              .map(h => ({
                numeric_value: h.numeric_value as number,
                created_at: h.created_at
              }));

            if (historyForDeltaCheck.length > 0) {
              const deltaResult = performDeltaCheck(
                parseFloat(result.value || '0'),
                historyForDeltaCheck,
                30 // 30% threshold
              );

              if (deltaResult.hasDeltaAlert && deltaResult.previousValue !== undefined && deltaResult.previousDate) {
                newDeltaAlerts.push({
                  id: result.id,
                  testName: getDisplayName(result.test_name, result.test_name_en || '', i18n.language),
                  currentValue: result.value || '',
                  previousValue: deltaResult.previousValue,
                  previousDate: deltaResult.previousDate,
                  changePercent: deltaResult.changePercent || 0,
                  patientName: getPatientNameFromObject(result, i18n.language),
                  unit: result.unit
                });
              }
            }
          }
        } catch (error) {
          console.error('Error loading delta check data:', error);
        }
      }

      setUnacknowledgedDeltaAlerts(newDeltaAlerts);
      if (newDeltaAlerts.length > 0 && !deltaAlertOpen) {
        setCurrentDeltaAlert(newDeltaAlerts[0]);
        setDeltaAlertOpen(true);
      }
    };

    if (!loading) {
      loadDeltaCheckData();
    }
  }, [loading, results, t, i18n.language, deltaAlertOpen]);

  const filteredResults = results.filter(r =>
    r.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getPatientNameFromObject(r, i18n.language).includes(searchTerm)
  );

  const pendingCount = results.filter(r => !r.verified_by).length;
  const criticalCount = results.filter(r => r.flag === 'HH' || r.flag === 'LL').length;
  const verifiedCount = results.filter(r => r.verified_by).length;

  const handleVerify = async (id: number) => {
    // Mock user ID 1 (Admin)
    const success = await verifyResult(id, 1);
    if (success) {
      toast.success(t('results.messages.verified_success'));
    } else {
      toast.error(t('results.messages.verify_failed'));
    }
  };

  const handleEdit = (result: PendingResult) => {
    setEditingResult(result);
    setEditValue(result.value || '');
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResult) return;

    setIsSubmitting(true);
    const refRange = getApplicableRefRange(editingResult.gender, editingResult.date_of_birth, editingResult);
    const numericValue = isNumeric(editValue) ? parseFloat(editValue) : null;
    const flag = (numericValue !== null ? getResultFlag(numericValue, refRange.low, refRange.high) : 'N') || 'N';

    const success = await updateResult(editingResult.id, editValue, flag);
    if (success) {
      toast.success(t('results.messages.edit_success'));
      setIsEditDialogOpen(false);
      setEditingResult(null);
      setEditValue('');
    } else {
      toast.error(t('results.messages.edit_failed'));
    }
    setIsSubmitting(false);
  };

  const formatRefRange = (low?: number, high?: number) => {
    if (low === undefined || high === undefined) return '-';
    return `${low} - ${high}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('results.title')}</h1><p className="text-gray-500">{t('results.subtitle')}</p></div>
        <Button variant="outline"><CheckCircle className="h-4 w-4 mr-2" />{t('results.batch_verify')}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-gray-500">{t('results.stats.pending')}</p><p className="text-xl font-bold">{pendingCount}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-red-100"><AlertTriangle className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-gray-500">{t('results.stats.critical')}</p><p className="text-xl font-bold">{criticalCount}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-green-100"><Check className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-gray-500">{t('results.stats.verified')}</p><p className="text-xl font-bold">{verifiedCount}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder={t('results.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('results.table.sample_id')}</TableHead>
                  <TableHead>{t('results.table.patient')}</TableHead>
                  <TableHead>{t('results.table.test')}</TableHead>
                  <TableHead className="text-right">{t('results.table.result')}</TableHead>
                  <TableHead>{t('results.table.unit')}</TableHead>
                  <TableHead>{t('results.table.ref_range')}</TableHead>
                  <TableHead>{t('results.table.flag')}</TableHead>
                  <TableHead>{t('results.table.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">{t('results.no_data')}</TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((result) => {
                    const refRange = getApplicableRefRange(result.gender, result.date_of_birth, result);
                    return (
                      <TableRow key={result.id} className={cn((result.flag === 'HH' || result.flag === 'LL') && 'bg-red-50')}>
                        <TableCell className="font-mono">{result.sample_id}</TableCell>
                        <TableCell>{getPatientNameFromObject(result, i18n.language)}</TableCell>
                        <TableCell><div><p className="font-medium">{getDisplayName(result.test_name, result.test_name_en, i18n.language)}</p><p className="text-xs text-gray-500">{result.test_code}</p></div></TableCell>
                        <TableCell className={cn('text-right font-mono font-bold', getFlagColor(result.flag || 'N'))}>{result.value || '-'}</TableCell>
                        <TableCell className="text-gray-500">{result.unit || '-'}</TableCell>
                        <TableCell className="text-gray-500">{formatRefRange(refRange.low, refRange.high)}</TableCell>
                        <TableCell>
                          {result.flag && result.flag !== 'N' && (
                            <Badge variant={result.flag === 'HH' || result.flag === 'LL' ? 'destructive' : 'warning'}>
                              {t(`results.flags.${result.flag}`) || result.flag}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{result.verified_by ? <Badge variant="success">{t('results.status.verified')}</Badge> : <Badge variant="secondary">{t('results.status.pending')}</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(result)}><Edit className="h-4 w-4" /></Button>
                            {!result.verified_by && <Button variant="ghost" size="icon" onClick={() => handleVerify(result.id)}><Check className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="p-0 overflow-hidden border border-gray-200 bg-white shadow-lg sm:max-w-[450px]">
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">
              {t('results.edit_title')}
            </DialogTitle>
          </div>
          {editingResult && (
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded border border-gray-100 space-y-1 text-xs">
                <p><span className="text-gray-500 font-medium">{t('results.table.sample_id')}:</span> {editingResult.sample_id}</p>
                <p><span className="text-gray-500 font-medium">{t('results.table.patient')}:</span> {getPatientNameFromObject(editingResult, i18n.language)}</p>
                <p><span className="text-gray-500 font-medium">{t('results.table.test')}:</span> {getDisplayName(editingResult.test_name, editingResult.test_name_en, i18n.language)} ({editingResult.test_code})</p>
                <p><span className="text-gray-500 font-medium">{t('results.table.ref_range')}:</span> {formatRefRange(getApplicableRefRange(editingResult.gender, editingResult.date_of_birth, editingResult).low, getApplicableRefRange(editingResult.gender, editingResult.date_of_birth, editingResult).high)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editValue" className="text-xs font-semibold text-gray-700">{t('results.edit_value')}</Label>
                <Input
                  id="editValue"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  className="h-11 text-lg font-bold"
                />
              </div>
              <DialogFooter className="pt-4 border-t border-gray-100 flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <CriticalValueAlert
        open={criticalAlertOpen}
        result={currentCriticalResult}
        onConfirm={handleCriticalAcknowledge}
        onOpenChange={setCriticalAlertOpen}
      />

      <DeltaCheckAlert
        open={deltaAlertOpen}
        alert={currentDeltaAlert}
        onConfirm={handleDeltaAcknowledge}
        onOpenChange={setDeltaAlertOpen}
      />
    </div>
  );
}
