import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { testPanelService, type TestPanel } from '@/services/database.service';
import { toast } from 'sonner';

export function useTestPanels() {
  const { t } = useTranslation();
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
      toast.success(t('catalog.messages.create_success'));
      await fetchPanels();
      return true;
    } catch (err) {
      console.error('Failed to create test panel:', err);
      toast.error(t('catalog.messages.create_failed'));
      return false;
    }
  };

  const updatePanel = async (id: number, data: Partial<TestPanel>) => {
    try {
      await testPanelService.update(id, data);
      toast.success(t('catalog.messages.update_success'));
      await fetchPanels();
      return true;
    } catch (err) {
      console.error('Failed to update test panel:', err);
      toast.error(t('catalog.messages.update_failed'));
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
      toast.error(t('catalog.messages.status_update_failed'));
      return false;
    }
  };

  useEffect(() => {
    fetchPanels();
  }, []);

  return { testPanels, loading, refresh: fetchPanels, createPanel, updatePanel, toggleActive };
}
