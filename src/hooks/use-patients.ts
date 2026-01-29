import { useState, useEffect } from 'react';
import { patientService, type Patient } from '@/services/database.service';

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await patientService.getAll();
      setPatients(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPatient = async (data: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await patientService.create(data);
      await fetchPatients();
      return true;
    } catch (err) {
      console.error('Failed to create patient:', err);
      return false;
    }
  };

  const searchPatients = async (term: string) => {
    try {
      setLoading(true);
      if (!term.trim()) {
        await fetchPatients();
        return;
      }
      const data = await patientService.search(term);
      setPatients(data);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  return { patients, loading, error, refresh: fetchPatients, createPatient, searchPatients };
}
