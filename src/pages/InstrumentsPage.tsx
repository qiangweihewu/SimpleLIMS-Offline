import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Wifi, WifiOff, RefreshCw, Plug, Loader2 } from 'lucide-react';
import { useInstruments } from '@/hooks/use-instruments';

export function InstrumentsPage() {
  const { t } = useTranslation();
  const { instruments, loading, connectInstrument, disconnectInstrument } = useInstruments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('instruments.title')}</h1><p className="text-gray-500">{t('instruments.subtitle')}</p></div>
        <Button><Plus className="h-4 w-4 mr-2" />{t('instruments.add_instrument')}</Button>
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
                      <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" />{t('instruments.actions.test')}</Button>
                      <Button variant="ghost" size="sm"><Settings className="h-4 w-4 mr-1" />{t('instruments.actions.configure')}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
