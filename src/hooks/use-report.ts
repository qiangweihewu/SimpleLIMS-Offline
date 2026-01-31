import { useState, useEffect } from 'react';
import { reportService, type ReportData } from '@/services/database.service';

export function useReport(sampleId: number | null) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sampleId === null) {
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await reportService.getReportData(sampleId);
        setReportData(data);
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [sampleId]);

  return { reportData, loading, error };
}
