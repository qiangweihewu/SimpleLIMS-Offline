import { useState, useEffect } from 'react';
import { testPanelService, type TestPanel } from '@/services/database.service';
import { toast } from 'sonner';

export function useTestPanels() {
  const [testPanels, setTestPanels] = useState<TestPanel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPanels = async () => {
    try {
      setLoading(true);
      const data = await testPanelService.getAll();
      setTestPanels(data);
    } catch (err) {
      console.error('Failed to fetch test panels:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPanel = async (data: Omit<TestPanel, 'id' | 'is_active'>) => {
    try {
      await testPanelService.create(data);
      await fetchPanels();
      return true;
    } catch (err) {
      console.error('Failed to create test panel:', err);
      toast.error('创建失败');
      return false;
    }
  };

  const updatePanel = async (id: number, data: Partial<TestPanel>) => {
    try {
      await testPanelService.update(id, data);
      await fetchPanels();
      return true;
    } catch (err) {
      console.error('Failed to update test panel:', err);
      toast.error('更新失败');
      return false;
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      await testPanelService.toggleActive(id, isActive);
      await fetchPanels();
      return true;
    } catch (err) {
      console.error('Failed to toggle active status:', err);
      toast.error('状态更新失败');
      return false;
    }
  };

  useEffect(() => {
    fetchPanels();
  }, []);

  return { testPanels, loading, refresh: fetchPanels, createPanel, updatePanel, toggleActive };
}
