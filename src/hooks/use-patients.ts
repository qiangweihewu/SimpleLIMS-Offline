import { useState, useEffect, useCallback } from 'react';
import { patientService, type Patient } from '@/services/database.service';

export interface PatientFilters {
  search?: string;
  gender?: 'male' | 'female' | '';
  ageRange?: { min?: number; max?: number };
  dateRange?: { start?: string; end?: string };
  hasRecentActivity?: boolean;
}

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PatientStats {
  total: number;
  byGender: { male: number; female: number };
  byAgeGroup: { '0-18': number; '19-40': number; '41-65': number; '65+': number };
  recentRegistrations: number;
  withRecentActivity: number;
}

export function usePatients() {
  const [patients, setPatients] = useState<PaginatedPatients>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0
  });
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<PatientFilters>({});

  const fetchPatients = useCallback(async (page: number = 1, pageSize: number = 50, currentFilters: PatientFilters = {}) => {
    try {
      setLoading(true);
      const data = await patientService.getPaginated(page, pageSize, currentFilters);
      setPatients(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch patients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await patientService.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch patient stats:', err);
    }
  }, []);

  const createPatient = async (data: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await patientService.create(data);
      await fetchPatients(patients.page, patients.pageSize, filters);
      await fetchStats();
      return true;
    } catch (err) {
      console.error('Failed to create patient:', err);
      return false;
    }
  };

  const updateFilters = useCallback((newFilters: PatientFilters) => {
    setFilters(newFilters);
    fetchPatients(1, patients.pageSize, newFilters);
  }, [patients.pageSize, fetchPatients]);

  const changePage = useCallback((page: number) => {
    fetchPatients(page, patients.pageSize, filters);
  }, [patients.pageSize, filters, fetchPatients]);

  const changePageSize = useCallback((pageSize: number) => {
    fetchPatients(1, pageSize, filters);
  }, [filters, fetchPatients]);

  // Legacy search function for backward compatibility
  const searchPatients = async (term: string) => {
    updateFilters({ search: term });
  };

  useEffect(() => {
    fetchPatients();
    fetchStats();
  }, [fetchPatients, fetchStats]);

  return {
    patients,
    stats,
    loading,
    error,
    filters,
    refresh: () => fetchPatients(patients.page, patients.pageSize, filters),
    createPatient,
    searchPatients,
    updateFilters,
    changePage,
    changePageSize
  };
}
