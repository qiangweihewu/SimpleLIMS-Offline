import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export interface DeltaAlertData {
  id: number;
  testName: string;
  currentValue: string;
  previousValue: number;
  previousDate: string;
  changePercent: number;
  patientName: string;
  unit?: string;
}

interface DeltaCheckAlertProps {
  open: boolean;
  alert: DeltaAlertData | null;
  onConfirm: (resultId: number) => void;
  onOpenChange: (open: boolean) => void;
}

export function DeltaCheckAlert({ open, alert, onConfirm, onOpenChange }: DeltaCheckAlertProps) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = () => {
    if (alert && acknowledged) {
      onConfirm(alert.id);
      setAcknowledged(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setAcknowledged(false);
    }
    onOpenChange(isOpen);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (!alert) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-yellow-500 border-2">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-100">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <DialogTitle className="text-yellow-600 text-xl">
              {t('delta.alert_title', 'Delta Check 警告')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-yellow-700 font-medium mt-2">
            {t('delta.message', '检测到该患者检测值的剧烈波动，请核实样本或患者信息')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 bg-yellow-50 rounded-lg p-4 mt-2">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('critical.patient')}:</span>
            <span className="font-semibold">{alert.patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('critical.test')}:</span>
            <span className="font-semibold">{alert.testName}</span>
          </div>
          <div className="border-t border-yellow-200 pt-3 mt-3">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">{t('delta.current_value', '当前值')}:</span>
              <span className="font-bold text-yellow-700 text-lg">
                {alert.currentValue} {alert.unit || ''}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">{t('delta.previous_value', '前次值')}:</span>
              <span className="font-medium text-gray-700">
                {alert.previousValue} {alert.unit || ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('delta.previous_date', '测试日期')}:</span>
              <span className="font-medium text-gray-700">
                {formatDate(alert.previousDate)}
              </span>
            </div>
          </div>
          <div className="bg-yellow-100 rounded p-3 mt-3">
            <span className="text-yellow-800 font-bold text-lg">
              {t('delta.change_percent', '变化幅度')}：{alert.changePercent.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="acknowledge-delta"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
          />
          <label htmlFor="acknowledge-delta" className="text-sm text-gray-700 cursor-pointer">
            {t('delta.acknowledge', '我已确认此警告')}
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button
            onClick={handleConfirm}
            disabled={!acknowledged}
            className="bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-gray-300"
          >
            {t('critical.confirm', '确认')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
