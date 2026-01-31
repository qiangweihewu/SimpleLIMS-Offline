import { useState, useEffect } from 'react';
import { patientService, sampleService, type Patient, type Sample } from '@/services/database.service';

export function usePatientDetail(patientId: number) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [samples, setSamples] = useState<(Sample & { tests?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || isNaN(patientId)) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const [patientData, samplesData] = await Promise.all([
          patientService.getById(patientId),
          sampleService.getByPatientId(patientId),
        ]);
        setPatient(patientData ?? null);
        setSamples(samplesData);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch patient detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId]);

  return { patient, samples, loading, error };
}
