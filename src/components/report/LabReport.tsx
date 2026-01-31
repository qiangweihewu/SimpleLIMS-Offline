import { useTranslation } from 'react-i18next';
import type { ReportData } from '@/services/database.service';
import { getPatientNameFromObject } from '@/lib/utils';

interface LabReportProps {
  data: ReportData;
}

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatRefRange(low?: number, high?: number): string {
  if (low !== undefined && high !== undefined) {
    return `${low} - ${high}`;
  }
  if (low !== undefined) return `≥ ${low}`;
  if (high !== undefined) return `≤ ${high}`;
  return '-';
}

export function LabReport({ data }: LabReportProps) {
  const { t, i18n } = useTranslation();
  const { sample, results, labSettings } = data;

  const getFlagClass = (flag?: string) => {
    switch (flag) {
      case 'H':
      case 'HH':
        return 'text-red-600 font-semibold';
      case 'L':
      case 'LL':
        return 'text-blue-600 font-semibold';
      default:
        return '';
    }
  };

  const groupedResults = results.reduce((acc, result) => {
    const category = result.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {} as Record<string, typeof results>);

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto print:p-4 print:max-w-none">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold">{labSettings.lab_name}</h1>
        {labSettings.lab_address && <p className="text-sm text-gray-600">{labSettings.lab_address}</p>}
        <div className="flex justify-center gap-4 text-sm text-gray-600">
          {labSettings.lab_phone && <span>{t('settings.form.phone')}: {labSettings.lab_phone}</span>}
          {labSettings.lab_email && <span>{t('settings.form.email')}: {labSettings.lab_email}</span>}
        </div>
        <h2 className="text-xl font-semibold mt-4">{t('report.lab_report_title')}</h2>
      </div>

      {/* Patient Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm border-b pb-4">
        <div className="space-y-1">
          <p><span className="font-medium">{t('reports.table.sample_id')}:</span> {sample.sample_id}</p>
          <p><span className="font-medium">{t('reports.table.patient')}:</span> {getPatientNameFromObject(sample, i18n.language)}</p>
          <p><span className="font-medium">{t('patients.table.id')}:</span> {sample.patient_code}</p>
        </div>
        <div className="space-y-1">
          <p><span className="font-medium">{t('patients.table.gender')}:</span> {t(`patients.gender.${sample.gender}`)}</p>
          <p><span className="font-medium">{t('patients.table.age')}:</span> {calculateAge(sample.date_of_birth)}</p>
          <p><span className="font-medium">{t('samples.table.collected_at')}:</span> {new Date(sample.collected_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Results Table */}
      {Object.entries(groupedResults).map(([category, categoryResults]) => (
        <div key={category} className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-2 bg-gray-100 px-2 py-1">
            {t(`catalog.categories.${category}`, category)}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-1">{t('results.table.test')}</th>
                <th className="text-right py-2 px-1">{t('results.table.result')}</th>
                <th className="text-center py-2 px-1">{t('results.table.flag')}</th>
                <th className="text-left py-2 px-1">{t('results.table.unit')}</th>
                <th className="text-left py-2 px-1">{t('results.table.ref_range')}</th>
              </tr>
            </thead>
            <tbody>
              {categoryResults.map((result) => (
                <tr key={result.id} className="border-b border-gray-200">
                  <td className="py-1 px-1">
                    {t(result.test_name)}
                    <span className="text-gray-400 text-xs ml-1">({result.test_code})</span>
                  </td>
                  <td className={`text-right py-1 px-1 ${getFlagClass(result.flag)}`}>
                    {result.value || '-'}
                  </td>
                  <td className={`text-center py-1 px-1 ${getFlagClass(result.flag)}`}>
                    {result.flag && result.flag !== 'N' ? result.flag : ''}
                  </td>
                  <td className="py-1 px-1">{result.unit || ''}</td>
                  <td className="py-1 px-1 text-gray-600">
                    {formatRefRange(result.ref_range_low, result.ref_range_high)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-sm text-gray-600">
        <div className="mb-4 italic">
          {labSettings.report_footer || t('report.default_footer')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p>{t('report.printed_at')}: {new Date().toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p>{t('report.signature')}: _________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
