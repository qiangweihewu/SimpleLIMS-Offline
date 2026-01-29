import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Search, Check, Plus, Loader2 } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { usePatients } from '@/hooks/use-patients';
import { useTestPanels } from '@/hooks/use-test-panels';
import { sampleService, orderService } from '@/services/database.service';

export function NewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patient');
  
  const { patients, searchPatients, loading: patientsLoading } = usePatients();
  const { testPanels, loading: panelsLoading } = useTestPanels();
  
  const [selectedPatient, setSelectedPatient] = useState<number | null>(initialPatientId ? parseInt(initialPatientId) : null);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter patients based on search
  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 10); // Show first 10 if no search
    return patients.filter(p => 
      p.patient_id.toLowerCase().includes(patientSearch.toLowerCase()) || 
      `${p.last_name}${p.first_name}`.includes(patientSearch)
    );
  }, [patients, patientSearch]);

  // Group panels by category
  const panelsByCategory = useMemo(() => {
    const groups: Record<string, typeof testPanels> = {};
    testPanels.forEach(panel => {
      if (!groups[panel.category]) groups[panel.category] = [];
      groups[panel.category].push(panel);
    });
    return groups;
  }, [testPanels]);

  const selectedPatientData = patients.find(p => p.id === selectedPatient);

  const togglePanel = (id: number) => {
    setSelectedPanelIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handlePatientSearch = (term: string) => {
    setPatientSearch(term);
    searchPatients(term);
  };

  const handleSubmit = async () => {
    if (!selectedPatient) { toast.error(t('orders.messages.select_patient')); return; }
    if (selectedPanelIds.length === 0) { toast.error(t('orders.messages.select_tests')); return; }
    
    try {
      setIsSubmitting(true);
      
      const sampleId = generateId('S');
      
      // 1. Create Sample
      const sampleResult = await sampleService.create({
        patient_id: selectedPatient,
        sample_id: sampleId,
        sample_type: 'blood', // Default for now
        priority,
      });
      
      if (!sampleResult.lastInsertRowid) throw new Error('Failed to create sample');
      
      // 2. Create Orders
      await orderService.createOrders(
        sampleResult.lastInsertRowid as number,
        selectedPanelIds
      );
      
      toast.success(t('orders.messages.success', { id: sampleId }));
      navigate('/samples');
      
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error(t('orders.messages.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div><h1 className="text-2xl font-bold text-gray-900">{t('orders.title')}</h1><p className="text-gray-500">{t('orders.subtitle')}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader><CardTitle>{t('orders.steps.patient')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder={t('orders.search_patient')} 
                value={patientSearch} 
                onChange={(e) => handlePatientSearch(e.target.value)} 
                className="pl-10" 
              />
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {patientsLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center p-4 text-gray-500">{t('orders.no_patient_found')}</div>
              ) : (
                filteredPatients.map(p => (
                  <div 
                    key={p.id} 
                    className={cn(
                      'p-3 border rounded-lg cursor-pointer transition-colors', 
                      selectedPatient === p.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    )} 
                    onClick={() => setSelectedPatient(p.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{p.last_name}{p.first_name}</p>
                        <p className="text-xs text-gray-500">{p.patient_id}</p>
                      </div>
                      {selectedPatient === p.id && <Check className="h-5 w-5 text-blue-500" />}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/patients')}><Plus className="h-4 w-4 mr-2" />{t('orders.add_patient')}</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 h-fit">
          <CardHeader><CardTitle>{t('orders.steps.tests')}</CardTitle></CardHeader>
          <CardContent>
            {panelsLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-6">
                {Object.entries(panelsByCategory).map(([category, panels]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase">{category}</h3>
                    <div className="space-y-2">
                      {panels.map(panel => (
                        <div 
                          key={panel.id} 
                          className={cn(
                            'p-3 border rounded-lg cursor-pointer transition-colors', 
                            selectedPanelIds.includes(panel.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                          )} 
                          onClick={() => togglePanel(panel.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{panel.name}</p>
                              <p className="text-xs text-gray-500">{panel.code}</p>
                            </div>
                            {selectedPanelIds.includes(panel.id) && <Check className="h-5 w-5 text-blue-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 h-fit sticky top-6">
          <CardHeader><CardTitle>{t('orders.steps.confirm')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('orders.priority')}</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="normal">{t('samples.priority.normal')}</option>
                <option value="urgent">{t('samples.priority.urgent')}</option>
                <option value="stat">{t('samples.priority.stat')}</option>
              </Select>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">{t('orders.summary.title')}</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('orders.summary.patient')}</span>
                  <span className="font-medium">
                    {selectedPatientData ? `${selectedPatientData.last_name}${selectedPatientData.first_name}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('orders.summary.tests')}</span>
                  <span className="font-medium">{t('orders.summary.count', { count: selectedPanelIds.length })}</span>
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleSubmit} 
              disabled={!selectedPatient || selectedPanelIds.length === 0 || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('orders.create_sample')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
