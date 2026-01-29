import { useState, useEffect } from 'react';
import { dashboardService } from '@/services/database.service';

export function useDashboard() {
  const [stats, setStats] = useState({
    todaySamples: 0,
    pendingSamples: 0,
    completedSamples: 0,
    abnormalResults: 0,
    recentSamples: [] as {
      id: number;
      sample_id: string;
      patient_name: string;
      tests: string;
      status: string;
      time: string;
    }[]
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading, refresh: fetchStats };
}
