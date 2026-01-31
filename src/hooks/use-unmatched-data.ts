import { useState, useEffect } from 'react';
import { unmatchedDataService, type UnmatchedData } from '@/services/database.service';

export function useUnmatchedData() {
  const [data, setData] = useState<UnmatchedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await unmatchedDataService.getPending(page, pageSize);
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch unmatched data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

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

  return {
    data,
    loading,
    refresh: fetchData,
    claimData,
    discardData,
    pagination: {
      page,
      setPage,
      pageSize,
      setPageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}
