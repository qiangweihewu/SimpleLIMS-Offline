import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, TrendingUp, Activity } from 'lucide-react';
import { PatientStats as IPatientStats } from '@/services/database.service';

interface PatientStatsProps {
  stats: IPatientStats | null;
  loading?: boolean;
}

export function PatientStats({ stats, loading }: PatientStatsProps) {
  const { t } = useTranslation();

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse lg:col-span-2">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            </CardContent>
          </Card>
        ))}
        <Card className="animate-pulse lg:col-span-4">
          <CardContent className="p-6">
            <div className="h-4 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-1 bg-gray-100 rounded w-full"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      title: t('patients.stats.total_patients'),
      value: stats.total.toLocaleString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: t('patients.stats.recent_registrations'),
      value: stats.recentRegistrations.toLocaleString(),
      subtitle: t('patients.stats.last_30_days'),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: t('patients.stats.recent_activity'),
      value: stats.withRecentActivity.toLocaleString(),
      subtitle: t('patients.stats.with_samples'),
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: t('patients.stats.gender_distribution'),
      value: `${stats.byGender.male}/${stats.byGender.female}`,
      subtitle: t('patients.stats.male_female_other'),
      icon: UserCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
        {/* Main Stats */}
        {statCards.map((stat, index) => (
          <Card key={index} className="lg:col-span-2">
            <CardContent className="p-4 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 truncate">{stat.title}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`p-2 rounded-full shrink-0 ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Age Distribution - Integrated into the row */}
        <Card className="lg:col-span-4">
          <CardHeader className="py-2 px-4 border-b">
            <CardTitle className="text-xs font-semibold text-gray-500">{t('patients.stats.age_distribution')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(stats.byAgeGroup).map(([ageGroup, count]) => (
                <div key={ageGroup} className="text-center">
                  <div className="text-sm font-bold text-gray-900 leading-tight">{count}</div>
                  <div className="text-[10px] text-gray-500 mb-1 truncate">
                    {t(`patients.stats.age_group_${ageGroup.replace('-', '_').replace('+', '_plus')}`).replace(' years', '')}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                      style={{
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}