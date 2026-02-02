import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, UserPlus, Loader2, Download, Upload, Filter } from 'lucide-react';
import { usePatients } from '@/hooks/use-patients';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { patientService } from '@/services/database.service';
import { cn, generateId } from '@/lib/utils';
import { PatientFilters } from '@/components/patients/PatientFilters';
import { PatientStats } from '@/components/patients/PatientStats';
import { PatientTable } from '@/components/patients/PatientTable';
import { PatientPagination } from '@/components/patients/PatientPagination';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export function PatientsPage() {
  const { t } = useTranslation();
  const {
    patients,
    stats,
    loading,
    filters,
    createPatient,
    updateFilters,
    changePage,
    changePageSize,
    refresh
  } = usePatients();

  const [quickSearch, setQuickSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // New patient form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: 'male',
    date_of_birth: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [useCustomPatientId, setUseCustomPatientId] = useState(false);
  const [customPatientId, setCustomPatientId] = useState('');
  const [patientIdError, setPatientIdError] = useState('');

  const handleQuickSearch = (term: string) => {
    setQuickSearch(term);
    updateFilters({ ...filters, search: term });
  };

  const handleCustomPatientIdChange = async (value: string) => {
    setCustomPatientId(value);
    setPatientIdError('');
    if (value.trim()) {
      const exists = await patientService.checkIdExists(value.trim());
      if (exists) {
        setPatientIdError(t('patients.id_exists_error'));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useCustomPatientId && !customPatientId.trim()) {
      return;
    }
    if (useCustomPatientId && patientIdError) {
      return;
    }

    setIsSubmitting(true);

    const patientId = useCustomPatientId ? customPatientId.trim() : generateId('P');

    if (useCustomPatientId) {
      const exists = await patientService.checkIdExists(patientId);
      if (exists) {
        setPatientIdError(t('patients.id_exists_error'));
        setIsSubmitting(false);
        return;
      }
    }

    const success = await createPatient({
      ...formData,
      patient_id: patientId,
      gender: formData.gender as 'male' | 'female',
    });

    if (success) {
      setIsDialogOpen(false);
      setFormData({
        first_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        phone: '',
        address: '',
        notes: '',
      });
      setUseCustomPatientId(false);
      setCustomPatientId('');
      setPatientIdError('');
    }
    setIsSubmitting(false);
  };

  const handleExport = async () => {
    try {
      const allPatients = await patientService.getAll();
      if (allPatients.length === 0) {
        toast.error(t('patients.export_no_data'));
        return;
      }

      const exportData = allPatients.map(p => ({
        [t('patients.table.id')]: p.patient_id,
        [t('patients.form.first_name')]: p.first_name,
        [t('patients.form.last_name')]: p.last_name,
        [t('patients.form.gender')]: t(`patients.gender.${p.gender}`),
        [t('patients.form.dob')]: p.date_of_birth,
        [t('patients.form.phone')]: p.phone || '',
        [t('patients.form.address')]: p.address || '',
        [t('patients.form.notes')]: p.notes || '',
        [t('patients.table.registered_at')]: p.created_at
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Patients');

      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('patients.export_success'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('patients.export_failed'));
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls, .csv';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event: any) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          let successCount = 0;
          for (const row of jsonData) {
            try {
              const patientId = row[t('patients.table.id')] || row['ID'] || generateId('P');
              const exists = await patientService.checkIdExists(patientId);
              if (exists) continue;

              let gender: 'male' | 'female' = 'male';
              const genderVal = (row[t('patients.form.gender')] || row['Gender'] || '').toString().toLowerCase();
              if (genderVal.includes('女') || genderVal.startsWith('f')) {
                gender = 'female';
              }

              await patientService.create({
                first_name: (row[t('patients.form.first_name')] || row['First Name'] || '').toString(),
                last_name: (row[t('patients.form.last_name')] || row['Last Name'] || '').toString(),
                gender,
                date_of_birth: (row[t('patients.form.dob')] || row['DOB'] || '').toString(),
                phone: (row[t('patients.form.phone')] || row['Phone'] || '').toString(),
                address: (row[t('patients.form.address')] || row['Address'] || '').toString(),
                notes: (row[t('patients.form.notes')] || row['Notes'] || '').toString(),
                patient_id: patientId
              });
              successCount++;
            } catch (err) {
              console.error('Record import error:', err);
            }
          }

          toast.success(t('patients.import_success', { count: successCount }));
          refresh();
        } catch (error) {
          console.error('Import error:', error);
          toast.error(t('patients.import_failed'));
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('patients.title')}</h1>
          <p className="text-sm text-gray-600">{t('patients.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            {t('common.import')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('common.export')}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('patients.add_patient')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PatientStats stats={stats} loading={loading} />

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('patients.quick_search_placeholder')}
                  value={quickSearch}
                  onChange={(e) => handleQuickSearch(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              <Button
                variant={isFiltersOpen ? "secondary" : "outline"}
                size="icon"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className="h-10 w-10 relative"
                title={t('patients.filters.title')}
              >
                <Filter className="h-4 w-4" />
                {!isFiltersOpen && Object.keys(filters).some(k => k !== 'search' && filters[k as keyof typeof filters]) && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                )}
              </Button>

              <div className="hidden md:block text-sm text-gray-500 min-w-[120px] text-right">
                {loading ? (
                  <div className="flex items-center justify-end gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : (
                  t('patients.showing_results', {
                    count: patients.data.length,
                    total: patients.total
                  })
                )}
              </div>
            </div>

            {isFiltersOpen && (
              <PatientFilters
                filters={filters}
                onFiltersChange={updateFilters}
                onClear={() => updateFilters({})}
                onClose={() => setIsFiltersOpen(false)}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      <Card>
        <CardContent className="p-0">
          <PatientTable patients={patients.data} loading={loading} />

          {/* Pagination */}
          <PatientPagination
            currentPage={patients.page}
            totalPages={patients.totalPages}
            pageSize={patients.pageSize}
            total={patients.total}
            onPageChange={changePage}
            onPageSizeChange={changePageSize}
          />
        </CardContent>
      </Card>

      {/* Add Patient Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border border-gray-200 bg-white shadow-lg">
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="h-6 w-6" />
              {t('patients.form.title')}
            </DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* ID Management Section */}
            <div className="bg-gray-100 p-4 rounded-md border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700">
                  {t('patients.id_management')}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustomId"
                    checked={useCustomPatientId}
                    onChange={(e) => {
                      setUseCustomPatientId(e.target.checked);
                      if (!e.target.checked) {
                        setCustomPatientId('');
                        setPatientIdError('');
                      }
                    }}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <Label htmlFor="useCustomId" className="text-xs text-gray-600 cursor-pointer">
                    {t('patients.custom_patient_id')}
                  </Label>
                </div>
              </div>

              {useCustomPatientId && (
                <div className="space-y-1">
                  <Input
                    placeholder={t('patients.custom_patient_id_placeholder')}
                    value={customPatientId}
                    onChange={(e) => handleCustomPatientIdChange(e.target.value)}
                    className={cn(
                      "bg-white",
                      patientIdError && "border-red-500"
                    )}
                  />
                  {patientIdError && (
                    <p className="text-xs text-red-500 font-medium">{patientIdError}</p>
                  )}
                </div>
              )}

              {!useCustomPatientId && (
                <div className="text-xs text-gray-500 italic">
                  {t('patients.auto_id_notice')}
                </div>
              )}
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span className="h-px bg-gray-200 flex-1"></span>
                <span>{t('patients.form.personal_info')}</span>
                <span className="h-px bg-gray-200 flex-1"></span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-xs font-medium text-gray-700">
                    {t('patients.form.last_name')}
                  </Label>
                  <Input
                    id="lastName"
                    required
                    placeholder={t('patients.form.placeholder.last_name')}
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-xs font-medium text-gray-700">
                    {t('patients.form.first_name')}
                  </Label>
                  <Input
                    id="firstName"
                    required
                    placeholder={t('patients.form.placeholder.first_name')}
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-xs font-medium text-gray-700">
                    {t('patients.form.gender')}
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={value => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger className="h-11 rounded-lg">
                      <SelectValue placeholder={t('patients.form.placeholder.gender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('patients.gender.male')}</SelectItem>
                      <SelectItem value="female">{t('patients.gender.female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-xs font-medium text-gray-700">
                    {t('patients.form.dob')}
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    required
                    value={formData.date_of_birth}
                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span className="h-px bg-gray-200 flex-1"></span>
                <span>{t('patients.form.contact_info')}</span>
                <span className="h-px bg-gray-200 flex-1"></span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-medium text-gray-700">
                    {t('patients.form.phone')}
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+86 138..."
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-xs font-medium text-gray-700">
                    {t('patients.form.address')}
                  </Label>
                  <Input
                    id="address"
                    placeholder={t('patients.form.placeholder.address')}
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-gray-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
