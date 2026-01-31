import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Wifi, WifiOff, RefreshCw, Plug, Loader2, Terminal } from 'lucide-react';
import { InstrumentForm } from '@/components/instruments/InstrumentForm';
import { InstrumentSetupWizard } from '@/components/instruments/InstrumentSetupWizard';
import { TestMappingEditor } from '@/components/instruments/TestMappingEditor';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useInstruments } from '@/hooks/use-instruments';
import { Instrument } from '@/services/database.service';
import { useState } from 'react';
import { Trash2, FileCode } from 'lucide-react';
import { InstrumentDebugger } from '@/components/instruments/InstrumentDebugger';
import { cn } from '@/lib/utils';



export function InstrumentsPage() {
  const { t } = useTranslation();
  const { instruments, loading, connectInstrument, disconnectInstrument, addInstrument, updateInstrument, deleteInstrument } = useInstruments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [useWizard, setUseWizard] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | undefined>(undefined);
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [mappingInstrument, setMappingInstrument] = useState<Instrument | undefined>(undefined);

  const handleAddClick = () => {
    setEditingInstrument(undefined);
    setUseWizard(true);
    setIsDialogOpen(true);
  };

  const handleEditClick = (instrument: Instrument) => {
    setEditingInstrument(instrument);
    setIsDialogOpen(true);
  };

  const handleMappingClick = (instrument: Instrument) => {
    setMappingInstrument(instrument);
    setIsMappingDialogOpen(true);
  };

  const handleDeleteClick = async (instrument: Instrument) => {
    if (confirm(t('common.confirm_delete'))) {
      await deleteInstrument(instrument.id);
    }
  };

  const handleSave = async (data: any) => {
    let success = false;
    if (editingInstrument) {
      success = await updateInstrument(editingInstrument.id, data);
    } else {
      success = await addInstrument(data);
    }

    if (success) {
      setIsDialogOpen(false);
    }
    return success;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('instruments.title')}</h1><p className="text-gray-500">{t('instruments.subtitle')}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsDebugOpen(true)}>
            <Terminal className="h-4 w-4 mr-2" /> {t('instruments.debugger.title')}
          </Button>
          <Button onClick={handleAddClick}><Plus className="h-4 w-4 mr-2" />{t('instruments.add_instrument')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-green-100"><Wifi className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-gray-500">{t('instruments.stats.online')}</p><p className="text-xl font-bold">{instruments.filter(i => i.is_connected).length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-red-100"><WifiOff className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-gray-500">{t('instruments.stats.offline')}</p><p className="text-xl font-bold">{instruments.filter(i => !i.is_connected).length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-100"><Plug className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">{t('instruments.stats.total')}</p><p className="text-xl font-bold">{instruments.length}</p></div></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {instruments.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-gray-500">{t('instruments.no_instruments')}</div>
          ) : (
            instruments.map((instrument) => (
              <Card key={instrument.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${instrument.is_connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      <div><CardTitle className="text-lg">{instrument.name}</CardTitle><p className="text-sm text-gray-500">{instrument.manufacturer} {instrument.model}</p></div>
                    </div>
                    <Badge variant={instrument.is_connected ? 'success' : 'secondary'}>{instrument.is_connected ? t('instruments.status.online') : t('instruments.status.offline')}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-gray-500">{t('instruments.fields.connection_type')}</p><p className="font-medium">{t(`instruments.connection_types.${instrument.connection_type}`)}</p></div>
                      <div><p className="text-gray-500">{t('instruments.fields.protocol')}</p><p className="font-medium">{t(`instruments.protocols.${instrument.protocol}`)}</p></div>
                      {instrument.port_path && <div><p className="text-gray-500">{t('instruments.fields.port')}</p><p className="font-mono">{instrument.port_path}</p></div>}
                      {instrument.baud_rate && <div><p className="text-gray-500">{t('instruments.fields.baud_rate')}</p><p className="font-mono">{instrument.baud_rate}</p></div>}
                    </div>
                    {instrument.last_activity && <p className="text-xs text-gray-400">{t('instruments.fields.last_activity')}: {instrument.last_activity}</p>}
                    <div className="flex gap-2 pt-2">
                      {instrument.is_connected ? (
                        <Button variant="outline" size="sm" onClick={() => disconnectInstrument(instrument)}>
                          <WifiOff className="h-4 w-4 mr-1" />{t('instruments.actions.disconnect')}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => connectInstrument(instrument)}>
                          <Wifi className="h-4 w-4 mr-1" />{t('instruments.actions.connect')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => connectInstrument(instrument)} disabled={!instrument.is_connected}><RefreshCw className="h-4 w-4 mr-1" />{t('instruments.actions.test')}</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleMappingClick(instrument)} title={t('mappings.title')}><FileCode className="h-4 w-4 mr-1" />{t('common.actions')}</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(instrument)}><Settings className="h-4 w-4 mr-1" />{t('instruments.actions.configure')}</Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(instrument)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn(
          "p-0 overflow-hidden border border-gray-200 bg-white shadow-lg",
          !editingInstrument && useWizard ? "max-w-4xl" : "max-w-2xl"
        )}>
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">
              {editingInstrument
                ? t('instruments.edit_instrument')
                : (useWizard ? t('instruments.wizard.title') : t('instruments.add_instrument'))
              }
            </DialogTitle>
          </div>

          <div className="p-6">
            {!editingInstrument && useWizard ? (
              <InstrumentSetupWizard
                onComplete={async (config) => {
                  await handleSave(config);
                  setUseWizard(false);
                }}
                onCancel={() => {
                  setUseWizard(false);
                  setIsDialogOpen(false);
                }}
              />
            ) : (
              <InstrumentForm
                initialData={editingInstrument}
                onSubmit={handleSave}
                onCancel={() => setIsDialogOpen(false)}
              />
            )}

            {!editingInstrument && (
              <div className="flex justify-end mt-4 border-t pt-2">
                <Button variant="link" size="sm" className="text-primary" onClick={() => setUseWizard(!useWizard)}>
                  {useWizard ? t('instruments.wizard.switch_manual') : t('instruments.wizard.switch_wizard')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden border border-gray-200 bg-white shadow-lg">
          <div className="bg-primary px-6 py-4">
            <DialogTitle className="text-xl font-bold text-white">
              {mappingInstrument?.name} - {t('mappings.title')}
            </DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {mappingInstrument && <TestMappingEditor instrumentId={mappingInstrument.id} />}
          </div>
          <div className="p-4 border-t bg-gray-50 flex justify-end">
            <Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <InstrumentDebugger />
        </DialogContent>
      </Dialog>
    </div >
  );
}
