import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle, Cpu, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDrivers } from '@/hooks/use-drivers';
import type { InstrumentDriverConfig, PortInfo } from '@/types/electron';
import { toast } from 'sonner';

interface InstrumentSetupWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete: (data: InstrumentFormData) => void;
  onCancel?: () => void;
}

interface InstrumentFormData {
  name: string;
  model: string;
  manufacturer: string;
  driverId?: string;
  connection_type: 'serial' | 'tcp' | 'file';
  protocol: 'astm' | 'hl7' | 'csv' | 'custom';
  port_path?: string;
  baud_rate?: number;
  data_bits?: number;
  stop_bits?: number;
  parity?: string;
  host?: string;
  port?: number;
  tcp_mode?: 'client' | 'server'; // For HL7
  watch_folder?: string;
  file_pattern?: string;
}

const STEPS = ['driver', 'connection', 'test', 'mapping', 'confirm'] as const;
type Step = typeof STEPS[number];

export function InstrumentSetupWizard({ open, onOpenChange, onComplete, onCancel }: InstrumentSetupWizardProps) {
  const isEmbedded = open === undefined;
  const { t } = useTranslation();
  const { loading: driversLoading, groupedByManufacturer } = useDrivers();

  const [currentStep, setCurrentStep] = useState<Step>('driver');
  const [selectedDriver, setSelectedDriver] = useState<InstrumentDriverConfig | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState<string>('');

  const [formData, setFormData] = useState<InstrumentFormData>({
    name: '',
    model: '',
    manufacturer: '',
    connection_type: 'serial',
    protocol: 'astm',
    baud_rate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: 'none',
  });

  const currentStepIndex = STEPS.indexOf(currentStep);

  useEffect(() => {
    if ((open || isEmbedded) && window.electronAPI) {
      window.electronAPI.instrument.listPorts().then(setPorts).catch(console.error);
    }
  }, [open, isEmbedded]);

  useEffect(() => {
    if (selectedDriver) {
      setFormData(prev => ({
        ...prev,
        name: selectedDriver.name,
        model: selectedDriver.model || '',
        manufacturer: selectedDriver.manufacturer || '',
        driverId: selectedDriver.id,
        connection_type: selectedDriver.connection,
        protocol: selectedDriver.protocol,
        baud_rate: selectedDriver.serialConfig?.baudRate || 9600,
        data_bits: selectedDriver.serialConfig?.dataBits || 8,
        stop_bits: selectedDriver.serialConfig?.stopBits || 1,
        parity: selectedDriver.serialConfig?.parity || 'none',
      }));
    } else if (useCustom) {
      // Clear specific driver info if switching to custom
      setFormData(prev => ({ ...prev, driverId: undefined }));
    }
  }, [selectedDriver, useCustom]);

  const handleNext = () => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1]);
    }
  };

  const handleBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1]);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestError('');

    try {
      if (formData.connection_type === 'serial' && formData.port_path) {
        const result = await window.electronAPI.instrument.connect(formData.port_path, {
          baudRate: formData.baud_rate || 9600,
          dataBits: (formData.data_bits || 8) as 5 | 6 | 7 | 8,
          stopBits: (formData.stop_bits || 1) as 1 | 1.5 | 2,
          parity: (formData.parity || 'none') as 'none' | 'even' | 'odd' | 'mark' | 'space',
        });

        if (result) {
          setTestStatus('success');
          await window.electronAPI.instrument.disconnect(formData.port_path);
        } else {
          setTestStatus('failed');
          setTestError(t('instruments.wizard.connection_failed'));
        }
      } else {
        setTestStatus('success');
      }
    } catch (err) {
      setTestStatus('failed');
      setTestError((err as Error).message);
    }
  };

  const handleComplete = () => {
    if (!formData.name) {
      toast.error(t('common.required_field'));
      return;
    }
    onComplete(formData);
    onOpenChange?.(false);
    resetWizard();
  };

  const resetWizard = () => {
    setCurrentStep('driver');
    setSelectedDriver(null);
    setUseCustom(false);
    setTestStatus('idle');
    setTestError('');
    setFormData({
      name: '',
      model: '',
      manufacturer: '',
      connection_type: 'serial',
      protocol: 'astm',
      baud_rate: 9600,
      data_bits: 8,
      stop_bits: 1,
      parity: 'none',
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'driver':
        return selectedDriver !== null || useCustom;
      case 'connection':
        if (formData.connection_type === 'serial') return !!formData.port_path;
        if (formData.connection_type === 'tcp') return !!formData.host && !!formData.port;
        if (formData.connection_type === 'file') return !!formData.watch_folder;
        return false;
      case 'test':
        return testStatus === 'success' || testStatus === 'idle';
      case 'mapping':
        return true;
      case 'confirm':
        return !!formData.name && !!formData.model;
      default:
        return false;
    }
  };

  const handleCancel = () => {
    resetWizard();
    onCancel?.();
    onOpenChange?.(false);
  };

  const content = (
    <>
      <div className="flex items-center w-full mb-8">
        {STEPS.map((step, idx) => (
          <div key={step} className={cn("flex items-center", idx < STEPS.length - 1 ? "flex-1" : "flex-none")}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
              idx < currentStepIndex ? 'bg-green-500 text-white' :
                idx === currentStepIndex ? 'bg-blue-500 text-white shadow-md shadow-blue-200' :
                  'bg-gray-200 text-gray-500'
            )}>
              {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            {idx < STEPS.length - 1 && (
              <div className="mx-2 h-[2px] flex-1 bg-gray-100 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full bg-green-500 transition-all duration-500 ease-in-out",
                    idx < currentStepIndex ? "w-full" : "w-0"
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {/* Step 1: Select Driver */}
        {currentStep === 'driver' && (
          <div className="space-y-4">
            <p className="text-gray-600">{t('instruments.wizard.select_driver')}</p>

            {driversLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {Object.entries(groupedByManufacturer).map(([manufacturer, mfrDrivers]) => (
                  <div key={manufacturer}>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">{manufacturer}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {mfrDrivers.map(driver => (
                        <Card
                          key={driver.id}
                          className={cn('cursor-pointer transition-colors', selectedDriver?.id === driver.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50')}
                          onClick={() => { setSelectedDriver(driver); setUseCustom(false); }}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{driver.name}</p>
                                <p className="text-xs text-gray-500">{driver.model}</p>
                              </div>
                              <Badge variant="secondary">{driver.protocol.toUpperCase()}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}

                <Card
                  className={cn('cursor-pointer transition-colors', useCustom ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50')}
                  onClick={() => { setUseCustom(true); setSelectedDriver(null); }}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{t('instruments.wizard.custom_driver')}</p>
                      <p className="text-xs text-gray-500">{t('instruments.wizard.custom_driver_desc')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Connection Settings */}
        {currentStep === 'connection' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('instruments.form.connection_type')}</Label>
                <Select
                  value={formData.connection_type}
                  onValueChange={v => setFormData({ ...formData, connection_type: v as 'serial' | 'tcp' | 'file' })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serial">{t('instruments.connections.serial')}</SelectItem>
                    <SelectItem value="tcp">{t('instruments.connections.tcp')}</SelectItem>
                    <SelectItem value="file">{t('instruments.connections.file')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('instruments.form.protocol')}</Label>
                <Select
                  value={formData.protocol}
                  onValueChange={v => setFormData({ ...formData, protocol: v as 'astm' | 'hl7' | 'csv' })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="astm">ASTM</SelectItem>
                    <SelectItem value="hl7">HL7 v2.x</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.connection_type === 'serial' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('instruments.form.port')}</Label>
                  <Select
                    value={formData.port_path || ''}
                    onValueChange={v => setFormData({ ...formData, port_path: v })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t('instruments.form.select_port')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.map(p => (
                        <SelectItem key={p.path} value={p.path}>{p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('instruments.form.baud_rate')}</Label>
                    <Select value={String(formData.baud_rate)} onValueChange={v => setFormData({ ...formData, baud_rate: Number(v) })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9600">9600</SelectItem>
                        <SelectItem value="19200">19200</SelectItem>
                        <SelectItem value="38400">38400</SelectItem>
                        <SelectItem value="57600">57600</SelectItem>
                        <SelectItem value="115200">115200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('instruments.form.parity')}</Label>
                    <Select value={formData.parity} onValueChange={v => setFormData({ ...formData, parity: v })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('instruments.parity.none')}</SelectItem>
                        <SelectItem value="even">{t('instruments.parity.even')}</SelectItem>
                        <SelectItem value="odd">{t('instruments.parity.odd')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {formData.connection_type === 'tcp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('instruments.form.host')}</Label>
                    <Input value={formData.host || ''} onChange={e => setFormData({ ...formData, host: e.target.value })} placeholder="192.168.1.100" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('instruments.form.port_number')}</Label>
                    <Input type="number" value={formData.port || ''} onChange={e => setFormData({ ...formData, port: Number(e.target.value) })} placeholder="4001" />
                  </div>
                </div>

                {/* HL7-specific TCP mode selection */}
                {formData.protocol === 'hl7' && (
                  <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Label>{t('instruments.form.hl7_mode')}</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hl7_mode"
                          value="client"
                          checked={formData.tcp_mode === 'client'}
                          onChange={() => setFormData({ ...formData, tcp_mode: 'client' })}
                        />
                        <span className="text-sm">
                          <p className="font-medium">{t('instruments.form.client_mode')}</p>
                          <p className="text-xs text-gray-600">{t('instruments.form.client_mode_desc')}</p>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hl7_mode"
                          value="server"
                          checked={formData.tcp_mode === 'server'}
                          onChange={() => setFormData({ ...formData, tcp_mode: 'server' })}
                        />
                        <span className="text-sm">
                          <p className="font-medium">{t('instruments.form.server_mode')}</p>
                          <p className="text-xs text-gray-600">{t('instruments.form.server_mode_desc')}</p>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.connection_type === 'file' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('instruments.form.watch_folder')}</Label>
                  <div className="flex gap-2">
                    <Input value={formData.watch_folder || ''} onChange={e => setFormData({ ...formData, watch_folder: e.target.value })} />
                    <Button variant="outline" onClick={async () => {
                      const folder = await window.electronAPI.file.selectFolder();
                      if (folder) setFormData({ ...formData, watch_folder: folder });
                    }}>{t('common.browse')}</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('instruments.form.file_pattern')}</Label>
                  <Input value={formData.file_pattern || ''} onChange={e => setFormData({ ...formData, file_pattern: e.target.value })} placeholder="*.csv" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Test Connection */}
        {currentStep === 'test' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center',
              testStatus === 'idle' ? 'bg-gray-100' :
                testStatus === 'testing' ? 'bg-blue-100' :
                  testStatus === 'success' ? 'bg-green-100' : 'bg-red-100'
            )}>
              {testStatus === 'idle' && <Cpu className="h-10 w-10 text-gray-400" />}
              {testStatus === 'testing' && <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />}
              {testStatus === 'success' && <CheckCircle className="h-10 w-10 text-green-500" />}
              {testStatus === 'failed' && <AlertCircle className="h-10 w-10 text-red-500" />}
            </div>

            <p className="text-lg font-medium">
              {testStatus === 'idle' && t('instruments.wizard.test_prompt')}
              {testStatus === 'testing' && t('instruments.wizard.testing_connection')}
              {testStatus === 'success' && t('instruments.wizard.connection_success')}
              {testStatus === 'failed' && t('instruments.wizard.connection_failed')}
            </p>

            {testError && <p className="text-red-500 text-sm">{testError}</p>}

            <Button onClick={handleTestConnection} disabled={testStatus === 'testing'}>
              {testStatus === 'testing' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('instruments.wizard.test_connection')}
            </Button>
          </div>
        )}

        {/* Step 4: Test Mapping */}
        {currentStep === 'mapping' && (
          <div className="space-y-4">
            <p className="text-gray-600">{t('instruments.wizard.mapping_desc')}</p>

            {selectedDriver?.testMapping && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">{t('instruments.wizard.instrument_code')}</th>
                      <th className="px-4 py-2 text-left">{t('instruments.wizard.lims_code')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedDriver.testMapping).map(([instrCode, limsCode]) => (
                      <tr key={instrCode} className="border-t">
                        <td className="px-4 py-2 font-mono">{instrCode}</td>
                        <td className="px-4 py-2 font-mono">{limsCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!selectedDriver?.testMapping && (
              <p className="text-gray-500 text-center py-8">{t('instruments.wizard.no_mapping')}</p>
            )}
          </div>
        )}

        {/* Step 5: Confirm */}
        {currentStep === 'confirm' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('instruments.form.name')}</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('instruments.form.name_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('instruments.fields.model')}</Label>
                <Input
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g. BC-3000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('instruments.fields.manufacturer')}</Label>
              <Input
                value={formData.manufacturer}
                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="e.g. Mindray"
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium">{t('instruments.wizard.summary')}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">{t('instruments.wizard.driver_label')}</span>
                <span>{selectedDriver?.name || t('instruments.wizard.custom_driver')}</span>
                <span className="text-gray-500">{t('instruments.form.connection_type')}</span>
                <span>{t(`instruments.connections.${formData.connection_type}`)}</span>
                <span className="text-gray-500">{t('instruments.form.protocol')}</span>
                <span>{formData.protocol.toUpperCase()}</span>
                {formData.port_path && <>
                  <span className="text-gray-500">{t('instruments.form.port')}</span>
                  <span>{formData.port_path}</span>
                </>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6 pt-4 border-t">
        <Button variant="outline" onClick={currentStepIndex === 0 ? handleCancel : handleBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {currentStepIndex === 0 ? t('common.cancel') : t('common.back')}
        </Button>

        {currentStep === 'confirm' ? (
          <Button onClick={handleComplete} disabled={!canProceed()}>
            {t('common.save')}
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            {t('common.next')}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </>
  );

  // If embedded (no open prop), return content directly
  if (isEmbedded) {
    return <div className="space-y-4">{content}</div>;
  }

  // Otherwise wrap in Dialog
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('instruments.wizard.title')}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
