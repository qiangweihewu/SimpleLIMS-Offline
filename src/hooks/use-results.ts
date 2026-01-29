import { useState, useEffect } from 'react';
import { resultService, type PendingResult } from '@/services/database.service';

export function useResults() {
  const [results, setResults] = useState<PendingResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const data = await resultService.getPending();
      setResults(data);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateResult = async (id: number, value: string, flag: string) => {
    try {
      await resultService.updateValue(id, value, flag);
      await fetchResults();
      return true;
    } catch (err) {
      console.error('Failed to update result:', err);
      return false;
    }
  };

  const verifyResult = async (id: number, userId: number) => {
    try {
      await resultService.verify(id, userId);
      await fetchResults();
      return true;
    } catch (err) {
      console.error('Failed to verify result:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  return { results, loading, refresh: fetchResults, updateResult, verifyResult };
}
