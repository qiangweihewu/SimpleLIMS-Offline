import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    BarChart3, PieChart, TrendingUp, AlertTriangle, Calendar, Wrench
} from 'lucide-react';
import { format, addDays, isAfter, isBefore, parseISO } from 'date-fns';

interface Equipment {
    id: number;
    name: string;
    model: string;
    manufacturer: string;
    status: 'operational' | 'maintenance' | 'faulty' | 'retired';
    next_maintenance?: string;
    last_maintenance?: string;
}

interface MaintenanceRecord {
    id: number;
    equipment_id: number;
    type: 'preventive' | 'corrective' | 'inspection';
    performed_at: string;
}

interface EquipmentStatsProps {
    equipment: Equipment[];
    className?: string;
}

export function EquipmentStats({ equipment, className }: EquipmentStatsProps) {
    const { t } = useTranslation();
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMaintenanceRecords();
    }, []);

    const loadMaintenanceRecords = async () => {
        try {
            const result = await window.electronAPI.db.all<MaintenanceRecord>(
                'SELECT * FROM maintenance_records ORDER BY performed_at DESC LIMIT 100'
            );
            setMaintenanceRecords(result || []);
        } catch (err) {
            console.error('Failed to load maintenance records:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate statistics
    const stats = {
        total: equipment.length,
        operational: equipment.filter(e => e.status === 'operational').length,
        maintenance: equipment.filter(e => e.status === 'maintenance').length,
        faulty: equipment.filter(e => e.status === 'faulty').length,
        retired: equipment.filter(e => e.status === 'retired').length
    };

    // Upcoming maintenance (next 30 days)
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const upcomingMaintenance = equipment.filter(e => {
        if (!e.next_maintenance) return false;
        const nextDate = parseISO(e.next_maintenance);
        return isAfter(nextDate, today) && isBefore(nextDate, thirtyDaysFromNow);
    }).sort((a, b) => {
        const dateA = parseISO(a.next_maintenance!);
        const dateB = parseISO(b.next_maintenance!);
        return dateA.getTime() - dateB.getTime();
    });

    // Overdue maintenance
    const overdueMaintenance = equipment.filter(e => {
        if (!e.next_maintenance) return false;
        const nextDate = parseISO(e.next_maintenance);
        return isBefore(nextDate, today);
    });

    // Maintenance type distribution
    const maintenanceByType = maintenanceRecords.reduce((acc, record) => {
        acc[record.type] = (acc[record.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Monthly maintenance trend (last 6 months)
    const monthlyTrend: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = format(monthDate, 'yyyy-MM');
        const count = maintenanceRecords.filter(r => r.performed_at.startsWith(monthKey)).length;
        monthlyTrend.push({
            month: format(monthDate, 'MMM'),
            count
        });
    }

    const maxTrendCount = Math.max(...monthlyTrend.map(m => m.count), 1);

    const getStatusPercentage = (status: keyof typeof stats) => {
        if (stats.total === 0) return 0;
        return Math.round((stats[status] / stats.total) * 100);
    };

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
            {/* Status Distribution */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <PieChart className="h-4 w-4 text-blue-600" />
                        {t('equipment.charts.status_distribution')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.total === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                            {t('equipment.no_equipment')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Visual pie chart bars */}
                            <div className="flex h-4 rounded-full overflow-hidden">
                                <div
                                    className="bg-green-500 transition-all"
                                    style={{ width: `${getStatusPercentage('operational')}%` }}
                                    title={t('equipment.status.operational')}
                                />
                                <div
                                    className="bg-yellow-500 transition-all"
                                    style={{ width: `${getStatusPercentage('maintenance')}%` }}
                                    title={t('equipment.status.maintenance')}
                                />
                                <div
                                    className="bg-red-500 transition-all"
                                    style={{ width: `${getStatusPercentage('faulty')}%` }}
                                    title={t('equipment.status.faulty')}
                                />
                                <div
                                    className="bg-gray-400 transition-all"
                                    style={{ width: `${getStatusPercentage('retired')}%` }}
                                    title={t('equipment.status.retired')}
                                />
                            </div>

                            {/* Legend */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span>{t('equipment.status.operational')}</span>
                                    <span className="ml-auto font-medium">{stats.operational}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <span>{t('equipment.status.maintenance')}</span>
                                    <span className="ml-auto font-medium">{stats.maintenance}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span>{t('equipment.status.faulty')}</span>
                                    <span className="ml-auto font-medium">{stats.faulty}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                                    <span>{t('equipment.status.retired')}</span>
                                    <span className="ml-auto font-medium">{stats.retired}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Maintenance Trend */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        {t('equipment.charts.maintenance_trend')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end justify-between h-24 gap-1">
                        {monthlyTrend.map((item, index) => (
                            <div key={index} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-medium">{item.count}</span>
                                <div
                                    className="w-full bg-blue-500 rounded-t transition-all"
                                    style={{
                                        height: `${(item.count / maxTrendCount) * 60}px`,
                                        minHeight: item.count > 0 ? '4px' : '0'
                                    }}
                                />
                                <span className="text-xs text-gray-500">{item.month}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Maintenance Type Distribution */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        {t('equipment.charts.type_distribution')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center text-gray-400 py-4">
                            {t('common.loading')}
                        </div>
                    ) : Object.keys(maintenanceByType).length === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                            {t('equipment.detail.no_records')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {['inspection', 'preventive', 'corrective'].map(type => {
                                const count = maintenanceByType[type] || 0;
                                const total = maintenanceRecords.length || 1;
                                const percentage = Math.round((count / total) * 100);
                                const colors = {
                                    inspection: 'bg-green-500',
                                    preventive: 'bg-blue-500',
                                    corrective: 'bg-orange-500'
                                };
                                return (
                                    <div key={type} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span>{t(`equipment.detail.maintenance_type.${type}`)}</span>
                                            <span className="font-medium">{count} ({percentage}%)</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${colors[type as keyof typeof colors]} rounded-full transition-all`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Upcoming Maintenance */}
            <Card className="md:col-span-2 lg:col-span-2">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        {t('equipment.charts.upcoming_maintenance')}
                        {upcomingMaintenance.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {upcomingMaintenance.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {upcomingMaintenance.length === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                            {t('equipment.charts.no_upcoming')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingMaintenance.slice(0, 5).map(eq => {
                                const daysUntil = Math.ceil(
                                    (parseISO(eq.next_maintenance!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                                );
                                return (
                                    <div key={eq.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Wrench className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-sm">{eq.name}</p>
                                                <p className="text-xs text-gray-500">{eq.manufacturer} {eq.model}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">
                                                {format(parseISO(eq.next_maintenance!), 'yyyy-MM-dd')}
                                            </p>
                                            <Badge variant={daysUntil <= 7 ? 'destructive' : 'secondary'} className="text-xs">
                                                {t('equipment.charts.days_until', { days: daysUntil })}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Overdue Maintenance Alert */}
            {overdueMaintenance.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-4 w-4" />
                            {t('equipment.charts.overdue_maintenance')}
                            <Badge variant="destructive" className="ml-2">
                                {overdueMaintenance.length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {overdueMaintenance.slice(0, 3).map(eq => {
                                const daysOverdue = Math.ceil(
                                    (today.getTime() - parseISO(eq.next_maintenance!).getTime()) / (1000 * 60 * 60 * 24)
                                );
                                return (
                                    <div key={eq.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-200">
                                        <div>
                                            <p className="font-medium text-sm">{eq.name}</p>
                                            <p className="text-xs text-gray-500">{eq.manufacturer} {eq.model}</p>
                                        </div>
                                        <Badge variant="destructive">
                                            {t('equipment.charts.days_overdue', { days: daysOverdue })}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
