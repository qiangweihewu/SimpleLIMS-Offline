import { useState, useEffect } from 'react';
import { testPackageService, type TestPackage } from '@/services/database.service';

export function useTestPackages() {
  const [testPackages, setTestPackages] = useState<TestPackage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const data = await testPackageService.getAll();
      setTestPackages(data);
    } catch (err) {
      console.error('Failed to fetch test packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPackage = async (data: { code: string; name: string; description?: string; price?: number }) => {
    try {
      const result = await testPackageService.create(data);
      await fetchPackages();
      return result.lastInsertRowid as number;
    } catch (err) {
      console.error('Failed to create test package:', err);
      return null;
    }
  };

  const addItems = async (packageId: number, panelIds: number[]) => {
    try {
      await testPackageService.addItems(packageId, panelIds);
      await fetchPackages();
      return true;
    } catch (err) {
      console.error('Failed to add package items:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  return { testPackages, loading, refresh: fetchPackages, createPackage, addItems };
}
