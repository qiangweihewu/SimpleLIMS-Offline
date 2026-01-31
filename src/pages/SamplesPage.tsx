import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Filter, Eye, Printer, Loader2, Tag } from 'lucide-react';
import { useSamples } from '@/hooks/use-samples';
import { formatDate, getPatientNameFromObject } from '@/lib/utils';
import { useBarcodeStore } from '@/stores/barcode-store';

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'secondary' }> = {
  registered: { variant: 'secondary' },
  in_progress: { variant: 'default' },
  completed: { variant: 'success' },
};

const priorityConfig: Record<string, { className: string }> = {
  normal: { className: 'text-gray-600' },
  urgent: { className: 'text-orange-600 font-medium' },
  stat: { className: 'text-red-600 font-bold' },
};

export function SamplesPage() {
  const { t, i18n } = useTranslation();
  const { samples, loading } = useSamples();
  const { print } = useBarcodeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredSamples = samples.filter(s => {
    const patientName = getPatientNameFromObject(s, i18n.language);
    const matchesSearch = s.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) || patientName.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handlePrintLabel = (sample: any) => {
    print({
      sampleId: sample.sample_id,
      patientName: getPatientNameFromObject(sample, i18n.language),
      tests: sample.tests || '',
      date: new Date(sample.collected_at).toLocaleDateString()
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('samples.title')}</h1><p className="text-gray-500">{t('samples.subtitle')}</p></div>
        <Link to="/orders/new"><Button><Plus className="h-4 w-4 mr-2" />{t('samples.new_sample')}</Button></Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder={t('samples.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-32">
                <option value="all">{t('samples.status_filter.all')}</option>
                <option value="registered">{t('samples.status_filter.registered')}</option>
                <option value="in_progress">{t('samples.status_filter.in_progress')}</option>
                <option value="completed">{t('samples.status_filter.completed')}</option>
              </Select>
            </div>
            <CardTitle className="text-sm text-gray-500 ml-auto">{t('samples.total_samples', { count: samples.length })}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('samples.table.sample_id')}</TableHead>
                  <TableHead>{t('samples.table.patient')}</TableHead>
                  <TableHead>{t('samples.table.tests')}</TableHead>
                  <TableHead>{t('samples.table.priority')}</TableHead>
                  <TableHead>{t('samples.table.status')}</TableHead>
                  <TableHead>{t('samples.table.collected_at')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSamples.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      {t('samples.no_data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSamples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell className="font-mono">{sample.sample_id}</TableCell>
                      <TableCell className="font-medium">{getPatientNameFromObject(sample, i18n.language)}</TableCell>
                      <TableCell>{sample.tests || '-'}</TableCell>
                      <TableCell><span className={priorityConfig[sample.priority]?.className || ''}>{t(`samples.priority.${sample.priority}`)}</span></TableCell>
                      <TableCell><Badge variant={statusConfig[sample.status]?.variant || 'secondary'}>{t(`samples.status_filter.${sample.status}`)}</Badge></TableCell>
                      <TableCell>{formatDate(sample.collected_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handlePrintLabel(sample)} title={t('dashboard.print_barcode') || "Print Label"}>
                            <Tag className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          {sample.status === 'completed' && <Button variant="ghost" size="icon"><Printer className="h-4 w-4" /></Button>}
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
