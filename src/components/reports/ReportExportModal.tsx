/**
 * Report Export Modal Component
 * Provides UI for exporting reports in multiple formats
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReportData } from '@/services/database.service';
import { ReportGenerator, getReportFilename } from '@/services/report-generator';

interface ReportExportModalProps {
  reportData: ReportData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportExportModal({ reportData, isOpen, onClose }: ReportExportModalProps) {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !reportData) return null;

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      setIsGenerating(true);
      setError(null);
      setSelectedFormat(format);

      let blob: Blob;
      const filename = getReportFilename(reportData.sample.sample_id, format);

      switch (format) {
        case 'pdf':
          blob = ReportGenerator.generatePDF(reportData, {
            includeHeader: true,
            includeReferenceRanges: true,
            includeVerificationStatus: true,
          });
          break;

        case 'xlsx':
          blob = ReportGenerator.generateExcel(reportData, true, true);
          break;

        case 'csv':
          blob = ReportGenerator.generateCSV(reportData);
          break;

        default:
          throw new Error('Unknown format');
      }

      ReportGenerator.downloadFile(blob, filename);

      // Close modal after successful export
      setTimeout(() => {
        onClose();
        setSelectedFormat(null);
      }, 500);
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setSelectedFormat(null);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            {t('reports.export.title', 'Export Report')}
          </CardTitle>
          <CardDescription>
            {t(
              'reports.export.description',
              'Choose format to export laboratory report'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid gap-3">
            {/* PDF Export */}
            <button
              onClick={() => handleExport('pdf')}
              disabled={isGenerating}
              className="p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {t('reports.export.pdf', 'PDF Report')}
                  </p>
                  <p className="text-xs text-gray-600">
                    {t('reports.export.pdfDesc', 'Professional formatted report')}
                  </p>
                </div>
                {isGenerating && selectedFormat === 'pdf' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </button>

            {/* Excel Export */}
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isGenerating}
              className="p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {t('reports.export.excel', 'Excel Workbook')}
                  </p>
                  <p className="text-xs text-gray-600">
                    {t('reports.export.excelDesc', 'Multiple sheets for analysis')}
                  </p>
                </div>
                {isGenerating && selectedFormat === 'xlsx' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </button>

            {/* CSV Export */}
            <button
              onClick={() => handleExport('csv')}
              disabled={isGenerating}
              className="p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {t('reports.export.csv', 'CSV File')}
                  </p>
                  <p className="text-xs text-gray-600">
                    {t('reports.export.csvDesc', 'Import into other systems')}
                  </p>
                </div>
                {isGenerating && selectedFormat === 'csv' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </button>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isGenerating}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
