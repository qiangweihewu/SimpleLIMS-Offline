import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { sampleService } from '@/services/database.service';
import {
  analyzeTAT,
  generateTATSummary,
  formatTATTime,
  getTATBadgeVariant,
  getTATProgressColor,
  type Priority
} from '@/lib/tat';

interface SampleWithTAT {
  id: number;
  sample_id: string;
  priority: Priority;
  collected_at: string;
  created_at: string;
  updated_at: string;
  is_released: number;
  released_at?: string;
  first_name?: string;
  last_name?: string;
  patient_code?: string;
}

export function TATPage() {
  const { t } = useTranslation();
  const [samples, setSamples] = useState<SampleWithTAT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSamples();
    const interval = setInterval(loadSamples, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadSamples = async () => {
    try {
      setLoading(true);
      const data = await sampleService.getAll();
      // Filter to last 24 hours
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const filtered = data
        .filter(
          (s: any) => new Date((s as any).collected_at) > new Date(dayAgo)
        )
        .map((s: any) => ({
          id: (s as any).id,
          sample_id: (s as any).sample_id,
          priority: (s as any).priority || 'routine',
          collected_at: (s as any).collected_at || new Date().toISOString(),
          created_at: (s as any).created_at || new Date().toISOString(),
          updated_at: (s as any).updated_at || new Date().toISOString(),
          is_released: (s as any).is_released || 0,
          released_at: (s as any).released_at,
          first_name: (s as any).first_name,
          last_name: (s as any).last_name,
          patient_code: (s as any).patient_code
        })) as SampleWithTAT[];
      setSamples(filtered);
    } catch (error) {
      console.error('Failed to load samples:', error);
    } finally {
      setLoading(false);
    }
  };

  const tatSummary = generateTATSummary(
    samples.map(s => ({
      collected_at: s.collected_at,
      priority: s.priority,
      is_released: s.is_released,
      released_at: s.released_at
    }))
  );
  const inProgressSamples = samples.filter(s => s.is_released === 0);
  const violatedSamples = inProgressSamples
    .map(s => ({ ...s, tat: analyzeTAT(s.collected_at, s.priority) }))
    .filter(s => s.tat.status === 'violated');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('tat.title', 'Turnaround Time (TAT)')}</h1>
        <p className="text-gray-500">{t('tat.subtitle', 'Monitor sample processing time and identify bottlenecks')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600 text-sm">{t('tat.total_samples', 'Total Samples')}</p>
            <p className="text-3xl font-bold">{tatSummary.totalSamples}</p>
            <p className="text-xs text-gray-500 mt-1">{t('tat.last_24h', 'Last 24 hours')}</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardContent className="pt-6">
            <p className="text-gray-600 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t('tat.completed', 'Completed')}
            </p>
            <p className="text-3xl font-bold text-green-600">{tatSummary.completedSamples}</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-gray-600 text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              {t('tat.at_risk', 'At Risk')}
            </p>
            <p className="text-3xl font-bold text-yellow-600">{tatSummary.atRiskSamples}</p>
          </CardContent>
        </Card>

        <Card className="bg-red-50">
          <CardContent className="pt-6">
            <p className="text-gray-600 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              {t('tat.violated', 'Violated')}
            </p>
            <p className="text-3xl font-bold text-red-600">{tatSummary.violatedSamples}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600 text-sm">{t('tat.avg_time', 'Avg Time')}</p>
            <p className="text-3xl font-bold">{formatTATTime(tatSummary.avgTATMinutes)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {t('tat.violation_rate', 'Violation: {{rate}}%', {
                rate: tatSummary.violationRate.toFixed(1)
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{t('tat.by_priority', 'Performance by Priority')}</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {(['stat', 'urgent', 'routine'] as const).map(priority => {
              const stats = tatSummary.byPriority[priority];
              const violationRate = stats.count > 0 ? (stats.violated / stats.count) * 100 : 0;

              return (
                <div
                  key={priority}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold capitalize">{priority.toUpperCase()}</h3>
                    <Badge variant={violationRate > 10 ? 'destructive' : 'default'}>
                      {violationRate.toFixed(0)}% {t('tat.violation', 'violation')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{stats.count} {t('tat.samples', 'samples')}</p>
                  <p className="text-lg font-bold mt-2">{formatTATTime(stats.avgMinutes)}</p>
                  <p className="text-xs text-gray-500">
                    {stats.violated > 0 && `${stats.violated} ${t('tat.violated', 'violated')}`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Violated Samples Alert */}
      {violatedSamples.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <h2 className="font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('tat.violated_alert', '{{count}} Samples Exceeded TAT', {
                count: violatedSamples.length
              })}
            </h2>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tat.sample_id', 'Sample ID')}</TableHead>
                  <TableHead>{t('tat.priority', 'Priority')}</TableHead>
                  <TableHead className="text-right">{t('tat.elapsed_time', 'Elapsed Time')}</TableHead>
                  <TableHead className="text-right">{t('tat.exceeds_by', 'Exceeds By')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violatedSamples.map(sample => {
                  const threshold = sample.tat.thresholdMinutes;
                  const exceeded = sample.tat.totalMinutes - threshold;
                  return (
                    <TableRow key={sample.id} className="bg-white">
                      <TableCell className="font-mono text-sm">{sample.sample_id}</TableCell>
                      <TableCell>
                        <Badge
                          variant={sample.priority === 'stat' ? 'destructive' : 'warning'}
                        >
                          {sample.priority.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {formatTATTime(sample.tat.totalMinutes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-red-600">
                          +{formatTATTime(exceeded)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* In-Progress Samples Table */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">
            {t('tat.in_progress', 'In Progress')} ({inProgressSamples.length})
          </h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : inProgressSamples.length === 0 ? (
            <p className="text-gray-500 py-8">{t('tat.no_in_progress', 'No samples in progress')}</p>
          ) : (
            <div className="space-y-3">
              {inProgressSamples.map(sample => {
                const tat = analyzeTAT(sample.collected_at, sample.priority);
                return (
                  <div
                    key={sample.id}
                    className={`p-4 border rounded-lg ${
                      tat.status === 'violated'
                        ? 'border-red-300 bg-red-50'
                        : tat.status === 'at_risk'
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{sample.sample_id}</p>
                        <p className="text-sm text-gray-600">
                          {sample.first_name} {sample.last_name}
                        </p>
                      </div>
                      <Badge variant={getTATBadgeVariant(tat.status)}>
                        {tat.status === 'violated'
                          ? '🔴 Violated'
                          : tat.status === 'at_risk'
                            ? '🟡 At Risk'
                            : '🔵 In Progress'}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {formatTATTime(tat.totalMinutes)} / {formatTATTime(tat.thresholdMinutes)}
                        </span>
                        <span className="text-gray-600">
                          {sample.priority === 'stat'
                            ? '30 min'
                            : sample.priority === 'urgent'
                              ? '4 hours'
                              : '24 hours'}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getTATProgressColor(tat.percentOfThreshold)}`}
                          style={{
                            width: `${Math.min(tat.percentOfThreshold, 100)}%`
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-sm">
                      {tat.minutesRemaining && tat.minutesRemaining > 0
                        ? `${formatTATTime(tat.minutesRemaining)} remaining`
                        : `Exceeded by ${formatTATTime(Math.abs(tat.minutesRemaining || 0))}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Samples Summary */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">
            {t('tat.completed_summary', 'Completed Samples')} ({samples.filter(s => s.is_released).length})
          </h2>
        </CardHeader>
        <CardContent>
          {samples.filter(s => s.is_released).length === 0 ? (
            <p className="text-gray-500 py-4">{t('tat.no_completed', 'No completed samples')}</p>
          ) : (
            <div className="text-sm text-gray-600 space-y-2">
              {samples
                .filter(s => s.is_released)
                .slice(0, 10)
                .map(sample => {
                  const tat = analyzeTAT(sample.collected_at, sample.priority, sample.released_at);
                  const withinThreshold = tat.totalMinutes <= tat.thresholdMinutes;

                  return (
                    <div key={sample.id} className="flex justify-between items-center p-2 border-b">
                      <div>
                        <p className="font-medium">{sample.sample_id}</p>
                      </div>
                      <div className="text-right">
                        <p className={withinThreshold ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {formatTATTime(tat.totalMinutes)}
                        </p>
                        <p className="text-xs text-gray-500">{sample.priority}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
