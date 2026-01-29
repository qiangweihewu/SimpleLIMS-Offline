import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Eye, Edit, UserPlus, Loader2 } from 'lucide-react';
import { calculateAge, generateId, formatDate } from '@/lib/utils';
import { usePatients } from '@/hooks/use-patients';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function PatientsPage() {
  const { t } = useTranslation();
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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    searchPatients(term);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const success = await createPatient({
      ...formData,
      patient_id: generateId('P'),
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
                      <TableCell className="font-medium">{patient.last_name}{patient.first_name}</TableCell>
                      <TableCell>{t(`patients.gender.${patient.gender}`)}</TableCell>
                      <TableCell>{calculateAge(patient.date_of_birth)}</TableCell>
                      <TableCell>{patient.phone || '-'}</TableCell>
                      <TableCell>{formatDate(patient.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/patients/${patient.id}`}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                          <Link to={`/orders/new?patient=${patient.id}`}><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />{t('patients.actions.order')}</Button></Link>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('patients.form.title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('patients.form.last_name')}</Label>
                <Input 
                  id="lastName" 
                  required 
                  value={formData.last_name} 
                  onChange={e => setFormData({...formData, last_name: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('patients.form.first_name')}</Label>
                <Input 
                  id="firstName" 
                  required 
                  value={formData.first_name} 
                  onChange={e => setFormData({...formData, first_name: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">{t('patients.form.gender')}</Label>
                <Select 
                  value={formData.gender} 
                  onChange={e => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="male">{t('patients.gender.male')}</option>
                  <option value="female">{t('patients.gender.female')}</option>
                  <option value="other">{t('patients.gender.other')}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">{t('patients.form.dob')}</Label>
                <Input 
                  id="dob" 
                  type="date" 
                  required 
                  value={formData.date_of_birth} 
                  onChange={e => setFormData({...formData, date_of_birth: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('patients.form.phone')}</Label>
              <Input 
                id="phone" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t('patients.form.address')}</Label>
              <Input 
                id="address" 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
