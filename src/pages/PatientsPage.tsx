import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Eye, Edit, UserPlus, Loader2, Contact } from 'lucide-react';
import { calculateAge, generateId, formatDate, getPatientNameFromObject } from '@/lib/utils';
import { usePatients } from '@/hooks/use-patients';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { patientService } from '@/services/database.service';
import { cn } from '@/lib/utils';

export function PatientsPage() {
  const { t, i18n } = useTranslation();
  const { patients, loading, searchPatients, createPatient } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    searchPatients(term);
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
      gender: formData.gender as 'male' | 'female' | 'other',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('patients.title')}</h1>
          <p className="text-gray-500">{t('patients.subtitle')}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><UserPlus className="h-4 w-4 mr-2" />{t('patients.add_patient')}</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('common.search') + "..."}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <CardTitle className="text-sm text-gray-500">{t('patients.total_patients', { count: patients.length })}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('patients.table.id')}</TableHead>
                  <TableHead>{t('patients.table.name')}</TableHead>
                  <TableHead>{t('patients.table.gender')}</TableHead>
                  <TableHead>{t('patients.table.age')}</TableHead>
                  <TableHead>{t('patients.table.phone')}</TableHead>
                  <TableHead>{t('patients.table.registered_at')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      {t('patients.no_data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-mono">{patient.patient_id}</TableCell>
                      <TableCell className="font-medium">{getPatientNameFromObject(patient, i18n.language)}</TableCell>
                      <TableCell>{t(`patients.gender.${patient.gender}`)}</TableCell>
                      <TableCell>{calculateAge(patient.date_of_birth)}</TableCell>
                      <TableCell>{patient.phone || '-'}</TableCell>
                      <TableCell>{formatDate(patient.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/patients/${patient.id}`}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                          <Link to={`/orders/new?patient=${patient.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary hover:bg-primary hover:text-white transition-colors"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              {t('patients.actions.order')}
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border border-gray-200 bg-white shadow-lg">
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="h-6 w-6" />
              {t('patients.form.title')}
            </DialogTitle>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* ID Management Section - Using solid background and no animation */}
            <div className="bg-gray-100 p-4 rounded-md border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Contact className="h-4 w-4 text-primary" />
                  {t('patients.id_management') || "Identification"}
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
                    <p className="text-[10px] text-red-500 font-medium">{patientIdError}</p>
                  )}
                </div>
              )}

              {!useCustomPatientId && (
                <div className="text-[10px] text-gray-500 italic">
                  {t('patients.auto_id_notice') || "Patient ID will be automatically generated."}
                </div>
              )}
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span className="h-px bg-gray-200 flex-1"></span>
                <span>{t('patients.form.personal_info') || "Personal Info"}</span>
                <span className="h-px bg-gray-200 flex-1"></span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-xs font-medium text-gray-700">{t('patients.form.last_name')}</Label>
                  <Input
                    id="lastName"
                    required
                    placeholder={t('patients.form.placeholder.last_name') || "Ex: Smith"}
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-xs font-medium text-gray-700">{t('patients.form.first_name')}</Label>
                  <Input
                    id="firstName"
                    required
                    placeholder={t('patients.form.placeholder.first_name') || "Ex: John"}
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-xs font-medium text-gray-700">{t('patients.form.gender')}</Label>
                  <Select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="h-11 rounded-lg"
                  >
                    <option value="male">{t('patients.gender.male')}</option>
                    <option value="female">{t('patients.gender.female')}</option>
                    <option value="other">{t('patients.gender.other')}</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-xs font-medium text-gray-700">{t('patients.form.dob')}</Label>
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
                <span>{t('patients.form.contact_info') || "Contact Info"}</span>
                <span className="h-px bg-gray-200 flex-1"></span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-medium text-gray-700">{t('patients.form.phone')}</Label>
                  <Input
                    id="phone"
                    placeholder="+86 138..."
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-xs font-medium text-gray-700">{t('patients.form.address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('patients.form.placeholder.address') || "Full residential address"}
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-gray-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
