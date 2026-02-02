import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Search, Check, Loader2, Package, User, Beaker, ClipboardCheck, UserPlus, Info } from 'lucide-react';
import { cn, generateId, getPatientNameFromObject } from '@/lib/utils';
import { toast } from 'sonner';
import { usePatients } from '@/hooks/use-patients';
import { useTestPanels } from '@/hooks/use-test-panels';
import { useTestPackages } from '@/hooks/use-test-packages';
import { sampleService, orderService } from '@/services/database.service';

export function NewOrderPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patient');

  const { patients, searchPatients, loading: patientsLoading } = usePatients();
  const { testPanels } = useTestPanels();
  const { testPackages } = useTestPackages();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(initialPatientId ? parseInt(initialPatientId) : null);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [priority, setPriority] = useState<string>('normal');
  const [sampleType, setSampleType] = useState<string>('blood');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useCustomSampleId, setUseCustomSampleId] = useState(false);
  const [customSampleId, setCustomSampleId] = useState('');
  const [sampleIdError, setSampleIdError] = useState('');

  // New state for viewing patient details
  const [viewingPatient, setViewingPatient] = useState<any | null>(null);

  // Filter patients based on search
  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.data.slice(0, 10);
    return patients.data.filter(p =>
      p.patient_id.toLowerCase().includes(patientSearch.toLowerCase()) ||
      getPatientNameFromObject(p, i18n.language).includes(patientSearch)
    );
  }, [patients.data, patientSearch, i18n.language]);

  const panelsByCategory = useMemo(() => {
    const groups: Record<string, typeof testPanels> = {};
    testPanels.forEach(panel => {
      if (!groups[panel.category]) groups[panel.category] = [];
      groups[panel.category].push(panel);
    });
    return groups;
  }, [testPanels]);

  const selectedPatientData = patients.data.find(p => p.id === selectedPatient);

  const togglePanel = (id: number) => {
    setSelectedPanelIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectPackage = (panelIds: number[]) => {
    const allSelected = panelIds.every(id => selectedPanelIds.includes(id));
    if (allSelected) {
      setSelectedPanelIds(prev => prev.filter(id => !panelIds.includes(id)));
    } else {
      setSelectedPanelIds(prev => {
        const newIds = new Set(prev);
        panelIds.forEach(id => newIds.add(id));
        return Array.from(newIds);
      });
    }
  };

  const selectAll = () => {
    setSelectedPanelIds(testPanels.map(p => p.id));
  };

  const clearAll = () => {
    setSelectedPanelIds([]);
  };

  const handlePatientSearch = (term: string) => {
    setPatientSearch(term);
    searchPatients(term);
  };

  const handleCustomSampleIdChange = async (value: string) => {
    setCustomSampleId(value);
    setSampleIdError('');
    if (value.trim()) {
      const exists = await sampleService.checkIdExists(value.trim());
      if (exists) {
        setSampleIdError(t('orders.id_exists_error'));
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient) { toast.error(t('orders.messages.select_patient')); return; }
    if (selectedPanelIds.length === 0) { toast.error(t('orders.messages.select_tests')); return; }
    if (useCustomSampleId && !customSampleId.trim()) { toast.error(t('orders.messages.select_tests')); return; }
    if (useCustomSampleId && sampleIdError) { toast.error(sampleIdError); return; }

    try {
      setIsSubmitting(true);
      const sampleId = useCustomSampleId ? customSampleId.trim() : generateId('S');

      if (useCustomSampleId) {
        const exists = await sampleService.checkIdExists(sampleId);
        if (exists) {
          setSampleIdError(t('orders.id_exists_error'));
          toast.error(t('orders.id_exists_error'));
          setIsSubmitting(false);
          return;
        }
      }

      const sampleResult = await sampleService.create({
        patient_id: selectedPatient,
        sample_id: sampleId,
        sample_type: sampleType,
        priority,
      });

      if (!sampleResult.lastInsertRowid) throw new Error('Failed to create sample');

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

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const steps = [
    { id: 1, title: t('orders.steps.select_patient'), icon: User },
    { id: 2, title: t('orders.steps.select_tests'), icon: Beaker },
    { id: 3, title: t('orders.steps.confirm_order'), icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header with improved navigation */}
      <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
          </Button>
          <h1 className="text-xl font-bold text-gray-900 border-l pl-4">{t('orders.title')}</h1>
        </div>
        {/* Simplified Stepper for Visibility */}
        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                currentStep === step.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500",
                currentStep > step.id && "bg-green-100 text-green-700"
              )}>
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs border border-white/20">
                  {currentStep > step.id ? <Check className="h-3 w-3" /> : step.id}
                </span>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
              {index < steps.length - 1 && <div className="w-8 h-px bg-gray-300 mx-1 hidden sm:block" />}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        {/* Step 1: Select Patient */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 shadow-md">
              <CardHeader className="bg-gray-50 border-b py-4">
                <CardTitle className="text-lg">{t('orders.steps.select_patient')}</CardTitle>
                <CardDescription>{t('orders.select_patient_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <Input
                      autoFocus
                      placeholder={t('orders.search_patient')}
                      value={patientSearch}
                      onChange={(e) => handlePatientSearch(e.target.value)}
                      className="pl-12 h-14 text-lg border-2 border-gray-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="border-2 rounded-lg overflow-hidden border-gray-200">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 font-bold text-gray-700 flex justify-between">
                    <span>{t('patients.search_results')}</span>
                    <span className="bg-white px-2 py-0.5 rounded text-sm border">{filteredPatients.length}</span>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-200">
                    {patientsLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                    ) : filteredPatients.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <p className="text-lg mb-4">{t('orders.no_patient_found')}</p>
                        <p className="text-sm">{t('orders.register_helper')}</p>
                      </div>
                    ) : (
                      filteredPatients.map(p => {
                        const isSelected = selectedPatient === p.id;
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              'p-4 cursor-pointer transition-colors border-l-4 hover:bg-gray-50',
                              isSelected ? 'bg-blue-50 border-l-blue-600' : 'border-l-transparent'
                            )}
                            onClick={() => setSelectedPatient(prev => prev === p.id ? null : p.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-baseline gap-3 mb-1">
                                  <span
                                    className="text-xl font-bold text-gray-900 hover:text-blue-600 hover:underline cursor-help"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingPatient(p);
                                    }}
                                  >
                                    {getPatientNameFromObject(p, i18n.language)}
                                  </span>
                                  <span
                                    className="text-sm font-mono bg-gray-200 px-2 py-0.5 rounded text-gray-700 hover:bg-gray-300 cursor-help"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingPatient(p);
                                    }}
                                  >
                                    {p.patient_id}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 flex gap-4 mt-1">
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-gray-500">{t('patients.form.gender')}:</span>
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded font-medium",
                                      p.gender === 'male' ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                                    )}>
                                      {t(`patients.gender.${p.gender}`)}
                                    </span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-gray-500">{t('patients.form.dob')}:</span>
                                    <span>{p.date_of_birth}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingPatient(p);
                                  }}
                                >
                                  <Info className="h-6 w-6" />
                                </Button>
                                <div className={cn(
                                  "w-8 h-8 rounded-full border-2 flex items-center justify-center",
                                  isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-transparent"
                                )}>
                                  <Check className="h-5 w-5" />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-900">{t('patients.form.title')}</CardTitle>
                  <CardDescription className="text-blue-700">{t('orders.patient_not_found_helper')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    size="lg"
                    className="w-full h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-md"
                    onClick={() => navigate('/patients')}
                  >
                    <UserPlus className="mr-2 h-6 w-6" />
                    {t('orders.add_patient')}
                  </Button>
                </CardContent>
              </Card>

              <Card className={cn("transition-opacity", selectedPatient ? "opacity-100" : "opacity-50")}>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500 mb-4 font-medium">
                    {selectedPatient ? t('orders.patient_selected') : t('orders.please_select_patient')}
                  </p>
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold"
                    onClick={nextStep}
                    disabled={!selectedPatient}
                  >
                    {t('common.next')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Select Tests */}
        {currentStep === 2 && (
          <Card className="shadow-md">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-6">
                <h2 className="text-lg font-bold text-gray-800">{t('orders.steps.select_tests')}</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 border-2 font-bold hover:bg-blue-50 hover:text-blue-600 border-blue-200"
                    onClick={selectAll}
                  >
                    {t('common.select_all')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 border-2 font-bold hover:bg-red-50 hover:text-red-600 border-red-200"
                    onClick={clearAll}
                  >
                    {t('common.clear_all')}
                  </Button>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-500 uppercase block">{t('orders.selected_count')}</span>
                  <span className="text-2xl font-bold text-blue-600 leading-none">{selectedPanelIds.length}</span>
                </div>
                <Button size="lg" className="h-12 px-8 font-bold text-lg" onClick={nextStep} disabled={selectedPanelIds.length === 0}>
                  {t('common.next')} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <CardContent className="p-6">
              {testPackages.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-md font-bold text-gray-700 mb-3 pl-2 border-l-4 border-blue-500 uppercase">
                    {t('orders.quick_packages')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {testPackages.map(pkg => {
                      const isFullySelected = pkg.panel_ids.every(id => selectedPanelIds.includes(id));
                      return (
                        <button
                          key={pkg.id}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left bg-white shadow-sm relative",
                            isFullySelected
                              ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                              : "border-gray-200 hover:border-blue-400"
                          )}
                          onClick={() => selectPackage(pkg.panel_ids)}
                        >
                          <div className={cn(
                            "p-3 rounded-md transition-colors",
                            isFullySelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                          )}>
                            <Package className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-lg text-gray-900">{t(pkg.name)}</div>
                              {isFullySelected && <Check className="h-5 w-5 text-blue-600" />}
                            </div>
                            <div className="text-sm text-gray-600 mt-1 font-medium italic">
                              {t('orders.package_includes', { tests: pkg.panel_codes.join(', ') })}
                            </div>
                          </div>
                          {isFullySelected && (
                            <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-md">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {Object.entries(panelsByCategory).map(([category, panels]) => (
                  <div key={category} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-md font-bold text-gray-800 mb-4 pb-2 border-b border-gray-300 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-gray-600 rounded-full"></span>
                      {t(`catalog.categories.${category}`) || category}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {panels.map(panel => {
                        const isSelected = selectedPanelIds.includes(panel.id);
                        return (
                          <button
                            key={panel.id}
                            onClick={() => togglePanel(panel.id)}
                            className={cn(
                              "flex flex-col p-3 rounded-lg border-2 transition-all text-left relative overflow-hidden h-full",
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white shadow-md z-10"
                                : "bg-white border-gray-300 hover:border-blue-300 text-gray-700"
                            )}
                          >
                            <span className="font-bold text-md leading-tight">{t(panel.name)}</span>
                            <span className={cn("text-xs font-mono mt-auto pt-1", isSelected ? "text-blue-100" : "text-gray-500")}>
                              {panel.code}
                            </span>
                            {isSelected && (
                              <div className="absolute top-1 right-1">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirm Order */}
        {currentStep === 3 && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg border-t-8 border-t-green-600">
              <CardHeader className="bg-gray-50 border-b py-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900">{t('orders.steps.confirm_order')}</h2>
                <p className="text-gray-500 mt-1">{t('orders.confirm_desc')}</p>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {/* Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">{t('orders.summary.patient')}</h3>
                    <div
                      className="text-2xl font-bold text-gray-900 mb-1 hover:text-blue-600 cursor-help underline decoration-dotted"
                      onClick={() => setViewingPatient(selectedPatientData)}
                    >
                      {selectedPatientData ? getPatientNameFromObject(selectedPatientData, i18n.language) : '-'}
                    </div>
                    <div className="text-lg text-gray-600 font-mono mb-4">
                      {selectedPatientData?.patient_id}
                    </div>
                    <div className="flex gap-2">
                      {selectedPatientData && (
                        <>
                          <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">
                            {t(`patients.gender.${selectedPatientData.gender}`)}
                          </span>
                          <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">
                            {selectedPatientData.date_of_birth}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">{t('orders.summary.tests')}</h3>
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {t('orders.summary.count', { count: selectedPanelIds.length })}
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
                      {testPanels.filter(p => selectedPanelIds.includes(p.id)).map(p => (
                        <span key={p.id} className="text-sm bg-blue-50 text-blue-800 border border-blue-100 px-2 py-1 rounded">
                          {p.code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Settings Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <Label className="text-lg font-bold text-gray-700">{t('orders.priority')}</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="h-14 text-lg border-2 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal" className="text-lg py-3 font-medium">
                          {t('samples.priority.normal')}
                        </SelectItem>
                        <SelectItem value="urgent" className="text-lg py-3 font-medium text-orange-600">
                          {t('samples.priority.urgent')}
                        </SelectItem>
                        <SelectItem value="stat" className="text-lg py-3 font-medium text-red-600">
                          {t('samples.priority.stat')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-lg font-bold text-gray-700">{t('samples.table.type')}</Label>
                    <Select value={sampleType} onValueChange={setSampleType}>
                      <SelectTrigger className="h-14 text-lg border-2 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blood" className="text-lg py-3">{t('samples.type.blood')}</SelectItem>
                        <SelectItem value="serum" className="text-lg py-3">{t('samples.type.serum')}</SelectItem>
                        <SelectItem value="plasma" className="text-lg py-3">{t('samples.type.plasma')}</SelectItem>
                        <SelectItem value="urine" className="text-lg py-3">{t('samples.type.urine')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-lg border-2 border-transparent hover:border-gray-300 transition-colors">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={useCustomSampleId}
                        onChange={(e) => {
                          setUseCustomSampleId(e.target.checked);
                          if (!e.target.checked) {
                            setCustomSampleId('');
                            setSampleIdError('');
                          }
                        }}
                        className="w-6 h-6 rounded border-gray-400 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-lg font-medium text-gray-800">{t('orders.custom_sample_id')}</span>
                  </label>

                  {useCustomSampleId && (
                    <div className="mt-4 pl-2 animate-in slide-in-from-top-2">
                      <Input
                        placeholder={t('orders.custom_sample_id_placeholder')}
                        value={customSampleId}
                        onChange={(e) => handleCustomSampleIdChange(e.target.value)}
                        className={cn(
                          "h-14 text-xl font-mono tracking-widest border-2",
                          sampleIdError ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300'
                        )}
                      />
                      {sampleIdError && (
                        <p className="text-sm text-red-600 font-bold mt-2 ml-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                          {sampleIdError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="bg-gray-100 p-6 flex justify-between rounded-b-lg">
                <Button variant="outline" size="lg" onClick={prevStep} className="h-14 px-8 text-lg border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700">
                  <ArrowLeft className="mr-2 h-5 w-5" /> {t('common.back')}
                </Button>
                <Button
                  size="lg"
                  className="h-14 px-12 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-md transition-transform active:scale-95"
                  onClick={handleSubmit}
                  disabled={isSubmitting || (useCustomSampleId && !!sampleIdError)}
                >
                  {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Check className="h-6 w-6 mr-2" />}
                  {t('orders.create_sample')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      {/* Patient Details Dialog */}
      <Dialog open={!!viewingPatient} onOpenChange={(open) => !open && setViewingPatient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-blue-600" />
              {t('patients.details.title')}
            </DialogTitle>
          </DialogHeader>

          {viewingPatient && (
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-500 text-sm">{t('patients.form.patient_id')}</Label>
                  <div className="text-lg font-mono font-bold bg-gray-100 px-2 py-1 rounded inline-block">
                    {viewingPatient.patient_id}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 text-sm">{t('patients.form.name')}</Label>
                  <div className="text-xl font-bold">
                    {getPatientNameFromObject(viewingPatient, i18n.language)}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 text-sm">{t('patients.form.gender')}</Label>
                  <div className="text-lg font-medium">
                    {t(`patients.gender.${viewingPatient.gender}`)}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-gray-500 text-sm">{t('patients.form.dob')}</Label>
                  <div className="text-lg font-medium">
                    {viewingPatient.date_of_birth}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 text-sm">{t('patients.form.phone')}</Label>
                  <div className="text-lg font-medium">
                    {viewingPatient.phone || '-'}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 text-sm">{t('patients.form.address')}</Label>
                  <div className="text-lg font-medium leading-tight">
                    {viewingPatient.address || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button size="lg" onClick={() => setViewingPatient(null)}>
              {t('common.close') || '关闭'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
