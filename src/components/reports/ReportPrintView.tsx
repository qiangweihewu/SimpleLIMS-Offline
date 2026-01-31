/**
 * Report Print View Component
 * Displays report in a printable format
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportData } from '@/services/database.service';

interface ReportPrintViewProps {
  reportData: ReportData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportPrintView({ reportData, isOpen, onClose }: ReportPrintViewProps) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !reportData) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && printRef.current) {
      printWindow.document.write(printRef.current.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t('reports.print.title', 'Print Report')}
        </h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} size="sm">
            <Printer className="h-4 w-4 mr-2" />
            {t('reports.print.print', 'Print')}
          </Button>
          <Button onClick={onClose} variant="outline" size="sm">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div ref={printRef} className="mx-auto bg-white p-8 shadow-lg" style={{ width: '210mm' }}>
          {/* Header */}
          <div className="text-center border-b-2 pb-4 mb-6">
            <h1 className="text-2xl font-bold">{reportData.labSettings.lab_name}</h1>
            <p className="text-sm text-gray-600">{reportData.labSettings.lab_address}</p>
            <p className="text-sm text-gray-600">
              {reportData.labSettings.lab_phone} | {reportData.labSettings.lab_email}
            </p>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4">Laboratory Report</h2>

            {/* Sample Info */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="font-semibold text-gray-700">Sample ID:</p>
                <p>{reportData.sample.sample_id}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Report Date:</p>
                <p>{new Date().toLocaleDateString()}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-700">Patient Name:</p>
                <p>
                  {reportData.sample.first_name} {reportData.sample.last_name}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Patient Code:</p>
                <p>{reportData.sample.patient_code}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-700">Date of Birth:</p>
                <p>{reportData.sample.date_of_birth}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Gender:</p>
                <p className="capitalize">{reportData.sample.gender}</p>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="mb-6">
            <h3 className="font-bold text-sm mb-3 uppercase">Test Results</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-2 py-2 text-left font-semibold">Test Code</th>
                  <th className="border px-2 py-2 text-left font-semibold">Test Name</th>
                  <th className="border px-2 py-2 text-center font-semibold">Value</th>
                  <th className="border px-2 py-2 text-center font-semibold">Unit</th>
                  <th className="border px-2 py-2 text-center font-semibold">Ref. Range</th>
                  <th className="border px-2 py-2 text-center font-semibold">Flag</th>
                  <th className="border px-2 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.results.map((result, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border px-2 py-2">{result.test_code}</td>
                    <td className="border px-2 py-2">{result.test_name}</td>
                    <td className="border px-2 py-2 text-center font-semibold">
                      {result.value || '-'}
                    </td>
                    <td className="border px-2 py-2 text-center text-xs">
                      {result.unit || '-'}
                    </td>
                    <td className="border px-2 py-2 text-center text-xs">
                      {result.ref_range_low && result.ref_range_high
                        ? `${result.ref_range_low}-${result.ref_range_high}`
                        : '-'}
                    </td>
                    <td className="border px-2 py-2 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getFlagColor(
                          result.flag
                        )}`}
                      >
                        {result.flag || '-'}
                      </span>
                    </td>
                    <td className="border px-2 py-2 text-center text-xs">
                      {result.verified_at ? 'V' : result.released_at ? 'R' : 'P'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {reportData.labSettings.report_footer && (
            <div className="text-center text-xs text-gray-600 pt-4 border-t">
              <p>{reportData.labSettings.report_footer}</p>
            </div>
          )}

          {/* Print instructions */}
          <div className="text-center text-xs text-gray-500 mt-6 pt-4 border-t">
            <p>This is an electronically generated laboratory report.</p>
            <p>Print timestamp: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );

}

function getFlagColor(flag: string | undefined): string {
  switch (flag) {
    case 'N':
      return 'bg-green-100 text-green-800';
    case 'H':
      return 'bg-orange-100 text-orange-800';
    case 'L':
      return 'bg-orange-100 text-orange-800';
    case 'HH':
      return 'bg-red-100 text-red-800';
    case 'LL':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
