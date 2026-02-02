import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Activity } from 'lucide-react';
import { PatientFilters as IPatientFilters } from '@/services/database.service';

interface PatientFiltersProps {
  filters: IPatientFilters;
  onFiltersChange: (filters: IPatientFilters) => void;
  onClear: () => void;
  onClose: () => void;
}

export function PatientFilters({ filters, onFiltersChange, onClear, onClose }: PatientFiltersProps) {
  const { t } = useTranslation();
  const [localFilters, setLocalFilters] = useState<IPatientFilters>(filters);

  // Update local filters when prop filters changes (e.g. from clear)
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    onClear();
  };

  return (
    <div className="space-y-4 pt-4 border-t mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Basic Search (Optional here if search bar is separate, but we keep it for consistency) */}
        <div className="space-y-2">
          <Label htmlFor="search">{t('patients.filters.search')}</Label>
          <Input
            id="search"
            placeholder={t('patients.filters.search_placeholder')}
            value={localFilters.search || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
          />
        </div>

        {/* Gender Filter */}
        <div className="space-y-2">
          <Label>{t('patients.filters.gender')}</Label>
          <Select
            value={localFilters.gender || 'all'}
            onValueChange={(value) => setLocalFilters({ ...localFilters, gender: value === 'all' ? undefined : value as any })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('patients.filters.all_genders')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('patients.filters.all_genders')}</SelectItem>
              <SelectItem value="male">{t('patients.gender.male')}</SelectItem>
              <SelectItem value="female">{t('patients.gender.female')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('patients.filters.recent_activity')}
          </Label>
          <Select
            value={localFilters.hasRecentActivity ? 'true' : 'false'}
            onValueChange={(value) => setLocalFilters({
              ...localFilters,
              hasRecentActivity: value === 'true' ? true : undefined
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('patients.filters.all_patients')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">{t('patients.filters.all_patients')}</SelectItem>
              <SelectItem value="true">{t('patients.filters.recent_activity_only')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Age Range */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('patients.filters.age_range')}
          </Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              placeholder={t('patients.filters.min_age')}
              value={localFilters.ageRange?.min || ''}
              onChange={(e) => setLocalFilters({
                ...localFilters,
                ageRange: {
                  ...localFilters.ageRange,
                  min: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
              className="w-full"
            />
            <span className="text-gray-500">-</span>
            <Input
              type="number"
              placeholder={t('patients.filters.max_age')}
              value={localFilters.ageRange?.max || ''}
              onChange={(e) => setLocalFilters({
                ...localFilters,
                ageRange: {
                  ...localFilters.ageRange,
                  max: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
              className="w-full"
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">{t('patients.filters.years')}</span>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('patients.filters.registration_date')}
          </Label>
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={localFilters.dateRange?.start || ''}
              onChange={(e) => setLocalFilters({
                ...localFilters,
                dateRange: {
                  ...localFilters.dateRange,
                  start: e.target.value || undefined
                }
              })}
              className="w-full"
            />
            <span className="text-gray-500">-</span>
            <Input
              type="date"
              value={localFilters.dateRange?.end || ''}
              onChange={(e) => setLocalFilters({
                ...localFilters,
                dateRange: {
                  ...localFilters.dateRange,
                  end: e.target.value || undefined
                }
              })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={handleClear}>
          {t('common.clear')}
        </Button>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleApply}>
          {t('common.apply_filters')}
        </Button>
      </div>
    </div>
  );
}