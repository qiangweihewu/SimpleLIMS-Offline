import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LabReport } from '@/components/report/LabReport';
import { useReport } from '@/hooks/use-report';
import { toast } from 'sonner';

export function ReportPreviewPage() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const numericId = sampleId ? parseInt(sampleId, 10) : null;
  const { reportData, loading, error } = useReport(numericId);

  const handlePrint = async () => {
    if (window.electronAPI?.report) {
      const result = await window.electronAPI.report.print();
      if (!result.success) {
        toast.error(t('common.error'));
      }
    } else {
      window.print();
    }
  };

  const handleExportPDF = async () => {
    if (window.electronAPI?.report) {
      const result = await window.electronAPI.report.printToPDF({
        filename: `report-${reportData?.sample.sample_id || sampleId}.pdf`
      });
      if (result.success && result.path) {
        toast.success(`PDF saved to ${result.path}`);
      } else {
        toast.error(result.error || t('common.error'));
      }
    } else {
      toast.error('PDF export is only available in the desktop app');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">{t('report.loading')}</span>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-gray-500">{t('report.not_found')}</p>
        <Button variant="outline" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('report.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar - hidden when printing */}
      <div className="print:hidden flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('report.back')}
          </Button>
          <h1 className="text-lg font-semibold">{t('report.preview_title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {t('report.print')}
          </Button>
          <Button onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            {t('report.export_pdf')}
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-6 print:p-0 print:bg-white">
        <LabReport data={reportData} />
      </div>
    </div>
  );
}
