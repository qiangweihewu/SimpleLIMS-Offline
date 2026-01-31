import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { qcService, type QCMaterial, type QCResultRecord } from '@/services/database.service';
import { analyzeWestgardRules, getQCStatusVariant, getRuleLabel, formatCV } from '@/lib/westgard';

export function QCPage() {
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<QCMaterial[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<QCMaterial | null>(null);
  const [results, setResults] = useState<QCResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [qcValue, setQcValue] = useState('');
  const [qcNotes, setQcNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load materials on mount
  useEffect(() => {
    loadMaterials();
  }, []);

  // Load results when material changes
  useEffect(() => {
    if (selectedMaterial) {
      loadResults(selectedMaterial.id);
    }
  }, [selectedMaterial]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await qcService.getMaterials();
      setMaterials(data);
      if (data.length > 0 && !selectedMaterial) {
        setSelectedMaterial(data[0]);
      }
    } catch (error) {
      console.error('Failed to load QC materials:', error);
      toast.error(t('qc.messages.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async (materialId: number) => {
    try {
      const data = await qcService.getResults(materialId, undefined, 30);
      setResults(data);
    } catch (error) {
      console.error('Failed to load QC results:', error);
      toast.error(t('qc.messages.load_results_failed'));
    }
  };

  const handleSubmitQC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || !qcValue) {
      toast.error(t('qc.messages.missing_value'));
      return;
    }

    const value = parseFloat(qcValue);
    if (isNaN(value)) {
      toast.error(t('qc.messages.invalid_value'));
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Analyze with Westgard rules
      const analysis = analyzeWestgardRules(
        value,
        results.map(r => ({ value: r.value, timestamp: r.performed_at })),
        selectedMaterial.target_value,
        selectedMaterial.sd
      );

      // Record result
      await qcService.recordQC(
        selectedMaterial.id,
        value,
        analysis.status,
        undefined, // instrumentId
        1, // userId (mock)
        qcNotes
      );

      toast.success(
        analysis.isAccepted
          ? t('qc.messages.qc_passed')
          : t('qc.messages.qc_warning', { rule: analysis.status })
      );

      setQcValue('');
      setQcNotes('');
      setIsDialogOpen(false);
      
      // Reload results
      await loadResults(selectedMaterial.id);
    } catch (error) {
      console.error('Failed to record QC:', error);
      toast.error(t('qc.messages.record_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAnalysisForResult = (resultRecord: QCResultRecord) => {
    if (!selectedMaterial) return null;
    
    const index = results.indexOf(resultRecord);
    const previousResults = index > 0 ? results.slice(0, index) : [];
    
    return analyzeWestgardRules(
      resultRecord.value,
      previousResults.map(r => ({ value: r.value, timestamp: r.performed_at })),
      selectedMaterial.target_value,
      selectedMaterial.sd
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('qc.title', 'Quality Control')}</h1>
          <p className="text-gray-500">{t('qc.subtitle', 'Monitor QC materials and verify instrument accuracy')}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('qc.record_result', 'Record QC Result')}
        </Button>
      </div>

      {/* QC Material Selection */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{t('qc.materials', 'QC Materials')}</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : materials.length === 0 ? (
            <p className="text-gray-500">{t('qc.no_materials', 'No QC materials available')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {materials.map(material => (
                <button
                  key={material.id}
                  onClick={() => setSelectedMaterial(material)}
                  className={`p-3 rounded-lg border-2 text-left transition ${
                    selectedMaterial?.id === material.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-primary'
                  }`}
                >
                  <p className="font-semibold">{material.name}</p>
                  <p className="text-sm text-gray-600">
                    {t('qc.lot', 'Lot')}: {material.lot_number}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('qc.target', 'Target')}: {material.target_value} ± {material.sd}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QC Results */}
      {selectedMaterial && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">{t('qc.results_history', 'Results History (Last 30 Days)')}</h2>
              <Badge variant="outline">{results.length} {t('common.results')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-gray-500 py-8">{t('qc.no_results', 'No results recorded yet')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('qc.date', 'Date/Time')}</TableHead>
                    <TableHead className="text-right">{t('qc.value', 'Value')}</TableHead>
                    <TableHead className="text-right">{t('qc.deviation', 'Deviation')}</TableHead>
                    <TableHead>{t('qc.status', 'Status')}</TableHead>
                    <TableHead>{t('qc.rules_violated', 'Rules Violated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(result => {
                    const analysis = getAnalysisForResult(result);
                    if (!analysis) return null;
                    
                    const deviation = result.value - selectedMaterial.target_value;
                    const sdMultiple = deviation / selectedMaterial.sd;
                    
                    return (
                      <TableRow
                        key={result.id}
                        className={
                          !analysis.isAccepted ? 'bg-red-50' : 
                          analysis.failedRules.length > 0 ? 'bg-yellow-50' : ''
                        }
                      >
                        <TableCell className="text-sm">
                          {new Date(result.performed_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {result.value.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={sdMultiple > 0 ? 'text-red-600' : 'text-blue-600'}>
                            {sdMultiple > 0 ? '+' : ''}{sdMultiple.toFixed(2)}σ
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getQCStatusVariant(analysis.status)}>
                            {analysis.status === 'pass' ? '✓ Pass' : '⚠ ' + analysis.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {analysis.failedRules.length === 0 ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <div className="space-y-1 max-w-xs">
                              {analysis.failedRules.map(rule => (
                                <div key={rule} className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
                                  {getRuleLabel(rule)}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Card */}
      {selectedMaterial && results.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('qc.statistics', 'Statistics')}
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-gray-600 text-sm">{t('qc.target_value', 'Target Value')}</p>
                <p className="text-xl font-bold">{selectedMaterial.target_value.toFixed(2)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <p className="text-gray-600 text-sm">{t('qc.std_deviation', 'Std. Deviation')}</p>
                <p className="text-xl font-bold">{selectedMaterial.sd.toFixed(4)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <p className="text-gray-600 text-sm">{t('qc.cv_percent', 'CV%')}</p>
                <p className="text-xl font-bold">
                  {formatCV((selectedMaterial.sd / selectedMaterial.target_value) * 100)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <p className="text-gray-600 text-sm">{t('qc.latest_result', 'Latest Result')}</p>
                <p className="text-xl font-bold">{results[0].value.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QC Record Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="p-0 overflow-hidden border border-gray-200 bg-white shadow-lg sm:max-w-[450px]">
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">
              {t('qc.record_new_result', 'Record QC Result')}
            </DialogTitle>
          </div>
          {selectedMaterial && (
            <form onSubmit={handleSubmitQC} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded border border-gray-100 space-y-1 text-sm">
                <p>
                  <span className="text-gray-600 font-medium">{t('qc.material')}:</span> {selectedMaterial.name}
                </p>
                <p>
                  <span className="text-gray-600 font-medium">{t('qc.lot')}:</span> {selectedMaterial.lot_number}
                </p>
                <p>
                  <span className="text-gray-600 font-medium">{t('qc.target')}:</span> {selectedMaterial.target_value} ±{' '}
                  {selectedMaterial.sd}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qcValue" className="text-sm font-semibold text-gray-700">
                  {t('qc.measured_value', 'Measured Value')}
                </Label>
                <Input
                  id="qcValue"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={qcValue}
                  onChange={e => setQcValue(e.target.value)}
                  autoFocus
                  className="h-11 text-lg font-bold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qcNotes" className="text-sm font-semibold text-gray-700">
                  {t('qc.notes', 'Notes')} ({t('common.optional')})
                </Label>
                <textarea
                  id="qcNotes"
                  placeholder={t('qc.notes_placeholder', 'e.g., Equipment reinitialized, temperature normal')}
                  value={qcNotes}
                  onChange={e => setQcNotes(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              {qcValue && selectedMaterial && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="text-blue-800">
                    <strong>{t('qc.preview_title', 'QC Analysis Preview:')}</strong>
                  </p>
                  {(() => {
                    const value = parseFloat(qcValue);
                    const deviation = value - selectedMaterial.target_value;
                    const sdMultiple = deviation / selectedMaterial.sd;
                    return (
                      <p className="text-blue-700 mt-1">
                        {Math.abs(sdMultiple).toFixed(2)}σ from target {sdMultiple > 0 ? '(high)' : '(low)'}
                      </p>
                    );
                  })()}
                </div>
              )}

              <DialogFooter className="pt-4 border-t border-gray-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:bg-gray-300"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                  {t('qc.submit', 'Submit QC')}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
