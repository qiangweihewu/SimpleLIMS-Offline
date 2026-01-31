import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export interface CriticalResult {
  id: number;
  testName: string;
  value: string;
  unit?: string;
  refRangeLow?: number;
  refRangeHigh?: number;
  patientName: string;
  flag: 'HH' | 'LL';
}

interface CriticalValueAlertProps {
  open: boolean;
  result: CriticalResult | null;
  onConfirm: (resultId: number) => void;
  onOpenChange: (open: boolean) => void;
}

export function CriticalValueAlert({ open, result, onConfirm, onOpenChange }: CriticalValueAlertProps) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = () => {
    if (result && acknowledged) {
      onConfirm(result.id);
      setAcknowledged(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setAcknowledged(false);
    }
    onOpenChange(isOpen);
  };

  const formatRefRange = () => {
    if (result?.refRangeLow === undefined || result?.refRangeHigh === undefined) return '-';
    return `${result.refRangeLow} - ${result.refRangeHigh}`;
  };

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-red-500 border-2">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-red-600 text-xl">
              {t('critical.alert_title')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-red-600 font-medium mt-2">
            {t('critical.message')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 bg-red-50 rounded-lg p-4 mt-2">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('critical.patient')}:</span>
            <span className="font-semibold">{result.patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('critical.test')}:</span>
            <span className="font-semibold">{result.testName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('critical.value')}:</span>
            <span className="font-bold text-red-600 text-lg">
              {result.value} {result.unit || ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{t('critical.ref_range')}:</span>
            <span className="font-medium">{formatRefRange()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="acknowledge-critical"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <label htmlFor="acknowledge-critical" className="text-sm text-gray-700 cursor-pointer">
            {t('critical.acknowledge')}
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button
            onClick={handleConfirm}
            disabled={!acknowledged}
            className="bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300"
          >
            {t('critical.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
