import { useState, useEffect } from 'react';
import { sampleService, type Sample } from '@/services/database.service';

export interface SampleWithDetails extends Sample {
  first_name: string;
  last_name: string;
  patient_code: string;
  tests?: string;
}

export function useSamples() {
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const data = await sampleService.getAll();
      setSamples(data);
    } catch (err) {
      console.error('Failed to fetch samples:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples();
    // Refresh periodically
    const interval = setInterval(fetchSamples, 10000);
    return () => clearInterval(interval);
  }, []);

  return { samples, loading, refresh: fetchSamples };
}
