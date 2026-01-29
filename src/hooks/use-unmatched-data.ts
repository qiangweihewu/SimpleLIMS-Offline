import { useState, useEffect } from 'react';
import { unmatchedDataService, type UnmatchedData } from '@/services/database.service';

export function useUnmatchedData() {
  const [data, setData] = useState<UnmatchedData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await unmatchedDataService.getPending();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch unmatched data:', err);
    } finally {
      setLoading(false);
    }
  };

  const claimData = async (id: number, sampleId: number, userId: number) => {
    try {
      await unmatchedDataService.claim(id, sampleId, userId);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Failed to claim data:', err);
      return false;
    }
  };

  const discardData = async (id: number, reason: string) => {
    try {
      await unmatchedDataService.discard(id, reason);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Failed to discard data:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, refresh: fetchData, claimData, discardData };
}
