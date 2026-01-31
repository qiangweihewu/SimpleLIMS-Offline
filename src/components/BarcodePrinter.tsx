import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBarcodeStore } from '@/stores/barcode-store';
import { BarcodeLabel } from './ui/BarcodeLabel';

export function BarcodePrinter() {
  const { data, clear } = useBarcodeStore();

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        window.print();
        // We delay clearing to ensure print dialog has captured the content
        // In many browsers, print() blocks, so clear() runs after dialog closes
        clear();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data, clear]);

  if (!data) return null;

  return createPortal(
    <div className="print-label-container">
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          .print-label-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 50mm;
            height: 30mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
        }
        @media screen {
           .print-label-container {
             position: fixed;
             top: -1000px;
             left: -1000px;
             visibility: hidden;
           }
        }
      `}</style>
      <BarcodeLabel {...data} />
    </div>,
    document.body
  );
}
