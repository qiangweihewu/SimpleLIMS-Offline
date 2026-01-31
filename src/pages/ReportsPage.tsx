import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search, Printer, Download, Eye, Calendar, Loader2 } from 'lucide-react';
import { useSamples } from '@/hooks/use-samples';
import { getPatientNameFromObject } from '@/lib/utils';
import { ReportExportModal } from '@/components/reports/ReportExportModal';
import { ReportPrintView } from '@/components/reports/ReportPrintView';
import { reportService } from '@/services/database.service';

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { samples, loading } = useSamples();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [printViewOpen, setPrintViewOpen] = useState(false);

  // Filter for completed samples (which are "reports" candidates)
  const completedSamples = useMemo(() => samples.filter(s => s.status === 'completed'), [samples]);

  const filteredReports = useMemo(() => completedSamples.filter(r =>
    r.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getPatientNameFromObject(r, i18n.language).includes(searchTerm)
  ), [completedSamples, searchTerm, i18n.language]);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'registered': return t('samples.status_filter.registered');
      case 'in_progress': return t('samples.status_filter.in_progress');
      case 'completed': return t('samples.status_filter.completed');
      case 'cancelled': return t('common.status') + ': Cancelled'; // Fallback or add to translation
      default: return status;
    }
  };

  const getStatusVariant = (status: string): BadgeProps['variant'] => {
    switch (status) {
      case 'registered': return 'secondary';
      case 'in_progress': return 'default';
      case 'completed': return 'success';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleExportClick = async (sampleId: number) => {
    try {
      const data = await reportService.getReportData(sampleId);
      if (data) {
        setReportData(data);
        setSelectedSampleId(sampleId);
        setExportModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    }
  };

  const handlePrintClick = async (sampleId: number) => {
    try {
      const data = await reportService.getReportData(sampleId);
      if (data) {
        setReportData(data);
        setSelectedSampleId(sampleId);
        setPrintViewOpen(true);
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1><p className="text-gray-500">{t('reports.subtitle')}</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-100"><FileText className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">{t('reports.stats.today')}</p><p className="text-xl font-bold">{stats.today}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-100"><FileText className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-gray-500">{t('reports.stats.month')}</p><p className="text-xl font-bold">{stats.month}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-green-100"><Printer className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-gray-500">{t('reports.stats.total')}</p><p className="text-xl font-bold">{stats.total}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-purple-100"><Calendar className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-gray-500">{t('reports.stats.total_samples')}</p><p className="text-xl font-bold">{samples.length}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder={t('reports.search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
                  <TableHead>{t('reports.table.sample_id')}</TableHead>
                  <TableHead>{t('reports.table.patient')}</TableHead>
                  <TableHead>{t('reports.table.tests')}</TableHead>
                  <TableHead>{t('reports.table.status')}</TableHead>
                  <TableHead>{t('reports.table.completed_at')}</TableHead>
                  <TableHead className="text-right">{t('reports.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {t('reports.no_data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono">{report.sample_id}</TableCell>
                      <TableCell className="font-medium">{getPatientNameFromObject(report, i18n.language)}</TableCell>
                      <TableCell>{report.tests || '-'}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(report.status)}>{getStatusLabel(report.status)}</Badge></TableCell>
                      <TableCell>{new Date(report.updated_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/reports/${report.id}`)} title={t('reports.table.view', 'View')}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleExportClick(report.id)} title={t('reports.table.export', 'Export')}><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintClick(report.id)} title={t('reports.table.print', 'Print')}><Printer className="h-4 w-4" /></Button>
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

      {/* Export Modal */}
      <ReportExportModal
        reportData={reportData}
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setReportData(null);
        }}
      />

      {/* Print View */}
      <ReportPrintView
        reportData={reportData}
        isOpen={printViewOpen}
        onClose={() => {
          setPrintViewOpen(false);
          setReportData(null);
        }}
      />
    </div>
  );
}
