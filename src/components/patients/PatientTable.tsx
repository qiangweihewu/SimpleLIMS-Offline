import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, UserPlus } from 'lucide-react';
import { calculateAge, formatDate, getPatientNameFromObject } from '@/lib/utils';
import { Patient } from '@/services/database.service';

interface PatientTableProps {
  patients: Patient[];
  loading?: boolean;
}

export function PatientTable({ patients, loading }: PatientTableProps) {
  const { t, i18n } = useTranslation();

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="text-center py-12">
        <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('patients.no_patients_found')}
        </h3>
        <p className="text-gray-500 mb-4">
          {t('patients.no_patients_description')}
        </p>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('patients.add_patient')}
        </Button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">{t('patients.table.id')}</TableHead>
            <TableHead className="font-semibold">{t('patients.table.name')}</TableHead>
            <TableHead className="font-semibold">{t('patients.table.gender')}</TableHead>
            <TableHead className="font-semibold">{t('patients.table.age')}</TableHead>
            <TableHead className="font-semibold">{t('patients.table.phone')}</TableHead>
            <TableHead className="font-semibold">{t('patients.table.registered_at')}</TableHead>
            <TableHead className="text-right font-semibold">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.id} className="hover:bg-gray-50">
              <TableCell className="font-mono text-sm">
                <Badge variant="outline" className="font-mono">
                  {patient.patient_id}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {patient.last_name[0]}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {getPatientNameFromObject(patient, i18n.language)}
                    </div>
                    {patient.email && (
                      <div className="text-sm text-gray-500">{patient.email}</div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    patient.gender === 'male' ? 'bg-blue-100 text-blue-800' :
                      patient.gender === 'female' ? 'bg-pink-100 text-pink-800' :
                        'bg-gray-100 text-gray-800'
                  }
                >
                  {t(`patients.gender.${patient.gender}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {calculateAge(patient.date_of_birth)} {t('patients.detail.years_old')}
                </span>
              </TableCell>
              <TableCell>
                {patient.phone ? (
                  <a
                    href={`tel:${patient.phone}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {patient.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {formatDate(patient.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Link to={`/patients/${patient.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to={`/patients/${patient.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to={`/orders/new?patient=${patient.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-primary border-primary hover:bg-primary hover:text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('patients.actions.order')}
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}