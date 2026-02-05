import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon,
    Wrench, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, isBefore, parseISO } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

interface Equipment {
    id: number;
    name: string;
    manufacturer: string;
    model: string;
    status: string;
    next_maintenance?: string;
}

interface MaintenanceEvent {
    id: number;
    equipment_id: number;
    equipment_name: string;
    type: 'preventive' | 'corrective' | 'inspection';
    date: string;
    status: 'scheduled' | 'completed' | 'overdue';
}

interface MaintenanceCalendarProps {
    equipment: Equipment[];
    onEventClick?: (event: MaintenanceEvent) => void;
    onDateChange?: (equipmentId: number, newDate: string) => void;
}

export function MaintenanceCalendar({ equipment, onEventClick, onDateChange }: MaintenanceCalendarProps) {
    const { t, i18n } = useTranslation();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<MaintenanceEvent | null>(null);
    const [showEventDialog, setShowEventDialog] = useState(false);
    const [draggedEvent, setDraggedEvent] = useState<MaintenanceEvent | null>(null);

    const locale = i18n.language === 'zh' ? zhCN : enUS;

    // Load maintenance records
    useEffect(() => {
        loadMaintenanceRecords();
    }, [currentMonth]);

    const loadMaintenanceRecords = async () => {
        try {
            const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

            const records = await window.electronAPI.db.all(
                `SELECT m.*, e.name as equipment_name 
                 FROM maintenance_records m 
                 JOIN equipment e ON m.equipment_id = e.id
                 WHERE date(m.performed_at) BETWEEN ? AND ?
                 ORDER BY m.performed_at`,
                [start, end]
            );
            setMaintenanceRecords(records || []);
        } catch (err) {
            console.error('Failed to load maintenance records:', err);
        }
    };

    // Generate calendar events from equipment next_maintenance dates and records
    const events = useMemo(() => {
        const eventList: MaintenanceEvent[] = [];

        // Scheduled maintenance from equipment
        equipment.forEach(eq => {
            if (eq.next_maintenance) {
                const maintenanceDate = parseISO(eq.next_maintenance);
                const isOverdue = isBefore(maintenanceDate, new Date()) && !isSameDay(maintenanceDate, new Date());

                eventList.push({
                    id: eq.id * -1, // Negative ID for scheduled events
                    equipment_id: eq.id,
                    equipment_name: eq.name,
                    type: 'preventive',
                    date: eq.next_maintenance,
                    status: isOverdue ? 'overdue' : 'scheduled'
                });
            }
        });

        // Completed maintenance from records
        maintenanceRecords.forEach(record => {
            eventList.push({
                id: record.id,
                equipment_id: record.equipment_id,
                equipment_name: record.equipment_name,
                type: record.type,
                date: record.performed_at.split('T')[0],
                status: 'completed'
            });
        });

        return eventList;
    }, [equipment, maintenanceRecords]);

    // Get events for a specific date
    const getEventsForDate = (date: Date) => {
        return events.filter(e => isSameDay(parseISO(e.date), date));
    };

    // Generate calendar grid
    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { locale });
        const end = endOfWeek(endOfMonth(currentMonth), { locale });
        const days: Date[] = [];
        let day = start;

        while (day <= end) {
            days.push(day);
            day = addDays(day, 1);
        }

        return days;
    }, [currentMonth, locale]);

    // Navigation
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const goToToday = () => setCurrentMonth(new Date());

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, event: MaintenanceEvent) => {
        if (event.status === 'completed') return; // Can't reschedule completed events
        setDraggedEvent(event);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
        e.preventDefault();
        if (!draggedEvent || draggedEvent.status === 'completed') return;

        const newDateStr = format(targetDate, 'yyyy-MM-dd');

        try {
            // Update equipment next_maintenance date
            await window.electronAPI.db.run(
                'UPDATE equipment SET next_maintenance = ? WHERE id = ?',
                [newDateStr, draggedEvent.equipment_id]
            );

            toast.success(t('calendar.date_updated'));

            if (onDateChange) {
                onDateChange(draggedEvent.equipment_id, newDateStr);
            }

            // Reload to refresh the calendar
            window.location.reload();
        } catch (err) {
            console.error('Failed to update date:', err);
            toast.error(t('calendar.update_failed'));
        }

        setDraggedEvent(null);
    };

    // Event click handler
    const handleEventClick = (event: MaintenanceEvent) => {
        setSelectedEvent(event);
        setShowEventDialog(true);
        if (onEventClick) {
            onEventClick(event);
        }
    };

    // Get event color based on status
    const getEventColor = (event: MaintenanceEvent) => {
        switch (event.status) {
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'overdue':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'scheduled':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Get event icon
    const getEventIcon = (event: MaintenanceEvent) => {
        switch (event.status) {
            case 'completed':
                return <CheckCircle className="h-3 w-3" />;
            case 'overdue':
                return <AlertTriangle className="h-3 w-3" />;
            case 'scheduled':
                return <Clock className="h-3 w-3" />;
            default:
                return <Wrench className="h-3 w-3" />;
        }
    };

    return (
        <Card className="h-full">
            <CardHeader className="py-3 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-blue-600" />
                        {t('calendar.title')}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={prevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-medium min-w-[140px] text-center">
                            {format(currentMonth, 'MMMM yyyy', { locale })}
                        </span>
                        <Button variant="ghost" size="icon" onClick={nextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToToday}>
                            {t('calendar.today')}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-2">
                {/* Week day headers */}
                <div className="grid grid-cols-7 mb-1">
                    {Array.from({ length: 7 }).map((_, i) => {
                        const day = addDays(startOfWeek(new Date(), { locale }), i);
                        return (
                            <div key={i} className="text-center text-sm font-medium text-gray-500 py-2">
                                {format(day, 'EEE', { locale })}
                            </div>
                        );
                    })}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                    {calendarDays.map((day, i) => {
                        const dayEvents = getEventsForDate(day);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isCurrentDay = isToday(day);

                        return (
                            <div
                                key={i}
                                className={`min-h-[100px] p-1 bg-white ${!isCurrentMonth ? 'bg-gray-50' : ''
                                    }`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, day)}
                            >
                                <div className={`text-sm mb-1 ${!isCurrentMonth ? 'text-gray-400' : ''
                                    } ${isCurrentDay ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto' : 'text-center'}`}>
                                    {format(day, 'd')}
                                </div>

                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map(event => (
                                        <div
                                            key={event.id}
                                            className={`text-xs p-1 rounded border cursor-pointer truncate ${getEventColor(event)} ${event.status !== 'completed' ? 'cursor-grab active:cursor-grabbing' : ''
                                                }`}
                                            draggable={event.status !== 'completed'}
                                            onDragStart={(e) => handleDragStart(e, event)}
                                            onClick={() => handleEventClick(event)}
                                            title={`${event.equipment_name} - ${t(`calendar.status.${event.status}`)}`}
                                        >
                                            <div className="flex items-center gap-1">
                                                {getEventIcon(event)}
                                                <span className="truncate">{event.equipment_name}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-xs text-gray-500 text-center">
                                            +{dayEvents.length - 3} {t('calendar.more')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 justify-center text-sm">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
                        <span>{t('calendar.status.scheduled')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                        <span>{t('calendar.status.completed')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                        <span>{t('calendar.status.overdue')}</span>
                    </div>
                </div>
            </CardContent>

            {/* Event Detail Dialog */}
            <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-blue-600" />
                            {t('calendar.event_details')}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">{t('calendar.equipment')}</span>
                                <span className="font-medium">{selectedEvent.equipment_name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">{t('calendar.type')}</span>
                                <span>{t(`equipment.detail.maintenance_types.${selectedEvent.type}`)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">{t('calendar.date')}</span>
                                <span>{format(parseISO(selectedEvent.date), 'PPP', { locale })}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">{t('calendar.status_label')}</span>
                                <Badge className={getEventColor(selectedEvent)}>
                                    {t(`calendar.status.${selectedEvent.status}`)}
                                </Badge>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
