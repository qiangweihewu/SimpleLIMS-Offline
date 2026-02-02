import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TestTubes, Clock, ClipboardCheck, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTranslation } from 'react-i18next';
import { getPatientNameFromObject } from '@/lib/utils';
import { InstrumentStatusWidget } from '@/components/instruments/InstrumentStatusWidget';

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  registered: 'bg-gray-100 text-gray-800',
};

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { stats, loading } = useDashboard();

  const statCards = [
    { key: 'dashboard.today_samples', value: stats.todaySamples, icon: TestTubes, color: 'bg-blue-500' },
    { key: 'dashboard.pending', value: stats.pendingSamples, icon: Clock, color: 'bg-yellow-500' },
    { key: 'dashboard.completed', value: stats.completedSamples, icon: ClipboardCheck, color: 'bg-green-500' },
    { key: 'dashboard.abnormal', value: stats.abnormalResults, icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const getStatusLabel = (status: string) => {
    return t(`dashboard.status.${status}`) || status;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
        <p className="text-gray-500">{t('dashboard.overview')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.key}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t(stat.key)}</p>
                  <p className="text-2xl font-bold">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTubes className="h-5 w-5" />
              {t('dashboard.recent_samples')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentSamples.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">{t('dashboard.no_recent_samples')}</p>
                ) : (
                  stats.recentSamples.map((sample) => (
                    <div key={sample.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{sample.sample_id}</p>
                        <p className="text-sm text-gray-500">{getPatientNameFromObject(sample, i18n.language)} · {sample.tests || '-'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[sample.status] || 'bg-gray-100'}`}>
                          {getStatusLabel(sample.status)}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">{sample.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('dashboard.stats.week_stats')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('dashboard.total_samples')}</span>
                <span className="font-bold">{loading ? '--' : stats.weekTotalSamples}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((stats.weekTotalSamples || 0) / 100 * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('dashboard.avg_tat')}</span>
                <span className="font-bold">{loading ? '--' : stats.weekAverageTAT} {t('dashboard.hours')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((stats.weekAverageTAT || 0) / 24 * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <InstrumentStatusWidget />
    </div>
  );
}

