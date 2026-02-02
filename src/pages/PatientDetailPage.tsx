import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, User, FileText, Loader2, Tag, Camera, Settings } from 'lucide-react';
import { calculateAge, getPatientNameFromObject } from '@/lib/utils';
import { usePatientDetail } from '@/hooks/use-patient-detail';
import { useBarcodeStore } from '@/stores/barcode-store';
import { ImageCapture } from '@/components/imaging/ImageCapture';
import { CameraTest } from '@/components/imaging/CameraTest';
import { useState } from 'react';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const patientId = parseInt(id || '0', 10);
  const { patient, samples, loading, error } = usePatientDetail(patientId);
  const { print } = useBarcodeStore();
  const [showCameraTest, setShowCameraTest] = useState(false);

  const handlePrintLabel = (sample: any) => {
    if (!patient) return;
    print({
      sampleId: sample.sample_id,
      patientName: getPatientNameFromObject(patient, i18n.language),
      tests: sample.tests || '',
      date: new Date(sample.collected_at || sample.created_at).toLocaleDateString()
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-500">{t('common.loading')}</span>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/patients">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('patients.detail.not_found')}</h1>
        </div>
      </div>
    );
  }

  const statusVariants: Record<string, 'default' | 'secondary' | 'success'> = {
    registered: 'secondary',
    in_progress: 'default',
    completed: 'success',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/patients">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{getPatientNameFromObject(patient, i18n.language)}</h1>
          <p className="text-gray-500">{patient.patient_id}</p>
        </div>
        <Link to={`/orders/new?patient=${patient.id}`}>
          <Button><Plus className="h-4 w-4 mr-2" />{t('orders.title')}</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />{t('patients.detail.basic_info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{patient.last_name[0]}</span>
              </div>
              <div>
                <p className="text-lg font-medium">{getPatientNameFromObject(patient, i18n.language)}</p>
                <p className="text-sm text-gray-500">{patient.patient_id}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('patients.table.gender')}</span>
                <span>{t(`patients.gender.${patient.gender}`)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('patients.table.age')}</span>
                <span>{calculateAge(patient.date_of_birth)} {t('patients.detail.years_old')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('patients.table.phone')}</span>
                <span>{patient.phone || '-'}</span>
              </div>
            </div>
            {patient.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-1">{t('patients.detail.notes')}</p>
                <p className="text-sm bg-yellow-50 p-2 rounded">{patient.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />{t('patients.detail.history')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {samples.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('samples.no_data')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('samples.table.sample_id')}</TableHead>
                    <TableHead>{t('samples.table.tests')}</TableHead>
                    <TableHead>{t('samples.table.status')}</TableHead>
                    <TableHead>{t('samples.table.collected_at')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell className="font-mono">{sample.sample_id}</TableCell>
                      <TableCell>{sample.tests || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[sample.status] || 'default'}>
                          {t(`samples.status_filter.${sample.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{sample.collected_at || sample.created_at}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintLabel(sample)}
                            title={t('dashboard.print_barcode') || "Print Label"}
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/reports/${sample.id}`)}
                          >
                            {t('patients.detail.view_report')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="pt-6 border-t">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="h-5 w-5" /> Imaging & Capture (Legacy Devices)
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCameraTest(!showCameraTest)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {showCameraTest ? 'Hide Test' : 'Camera Test'}
          </Button>
        </div>
        
        {showCameraTest ? (
          <CameraTest />
        ) : (
          <ImageCapture patientId={patient.patient_id} />
        )}
      </div>

    </div>
  );
}
