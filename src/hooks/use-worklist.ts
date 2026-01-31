import { useState, useEffect } from 'react';
import { worklistService, WorklistItem } from '@/services/database.service';

export function useWorklist() {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await worklistService.getPendingItems();
      setItems(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    
    // Listen for database changes if possible, or just load once
    const cleanup = window.electronAPI?.onStatusUpdate?.(() => {
      fetchItems();
    });

    return () => {
      cleanup?.();
    };
  }, []);

  const updateStatus = async (orderIds: number[], status: 'pending' | 'processing' | 'completed' | 'cancelled') => {
    try {
      await worklistService.updateStatus(orderIds, status);
      await fetchItems();
      return true;
    } catch (err) {
      console.error('Failed to update status', err);
      return false;
    }
  };

  return { items, loading, error, refresh: fetchItems, updateStatus };
}
