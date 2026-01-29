import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Check, AlertTriangle, Edit, CheckCircle, Loader2 } from 'lucide-react';
import { cn, getFlagColor } from '@/lib/utils';
import { toast } from 'sonner';
import { useResults } from '@/hooks/use-results';

export function ResultsPage() {
  const { t } = useTranslation();
  const { results, loading, verifyResult } = useResults();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredResults = results.filter(r => 
    r.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    `${r.last_name}${r.first_name}`.includes(searchTerm)
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
                  filteredResults.map((result) => (
                    <TableRow key={result.id} className={cn((result.flag === 'HH' || result.flag === 'LL') && 'bg-red-50')}>
                      <TableCell className="font-mono">{result.sample_id}</TableCell>
                      <TableCell>{result.last_name}{result.first_name}</TableCell>
                      <TableCell><div><p className="font-medium">{result.test_name}</p><p className="text-xs text-gray-500">{result.test_code}</p></div></TableCell>
                      <TableCell className={cn('text-right font-mono font-bold', getFlagColor(result.flag || 'N'))}>{result.value || '-'}</TableCell>
                      <TableCell className="text-gray-500">{result.unit || '-'}</TableCell>
                      <TableCell className="text-gray-500">{formatRefRange(result.ref_range_male_low, result.ref_range_male_high)}</TableCell>
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
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                          {!result.verified_by && <Button variant="ghost" size="icon" onClick={() => handleVerify(result.id)}><Check className="h-4 w-4" /></Button>}
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
