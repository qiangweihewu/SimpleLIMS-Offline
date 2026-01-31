import { useState, useEffect } from 'react';
import type { InstrumentDriverConfig } from '@/types/electron';

const isElectron = typeof window !== 'undefined' && window.electronAPI;

export function useDrivers() {
  const [drivers, setDrivers] = useState<InstrumentDriverConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchDrivers() {
      if (!isElectron) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await window.electronAPI.driver.getAll();
        setDrivers(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDrivers();
  }, []);

  const getDriver = async (id: string) => {
    if (!isElectron) return undefined;
    return window.electronAPI.driver.get(id);
  };

  const groupedByManufacturer = drivers.reduce((acc, driver) => {
    const mfr = driver.manufacturer;
    if (!acc[mfr]) acc[mfr] = [];
    acc[mfr].push(driver);
    return acc;
  }, {} as Record<string, InstrumentDriverConfig[]>);

  return { drivers, loading, error, getDriver, groupedByManufacturer };
}
