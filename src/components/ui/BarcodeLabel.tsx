import React from 'react';
import Barcode from 'react-barcode';

interface BarcodeLabelProps {
  sampleId: string;
  patientName: string;
  tests: string;
  date: string;
}

export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ sampleId, patientName, tests, date }) => {
  return (
    <div 
      className="flex flex-col items-center justify-center bg-white text-black font-sans box-border overflow-hidden"
      style={{ 
        width: '50mm', 
        height: '30mm', 
        padding: '2mm',
        border: '1px solid #ccc', // Visible border for preview, removed in print via CSS if needed
        pageBreakAfter: 'always'
      }}
    >
      <div className="font-bold text-sm mb-1">{sampleId}</div>
      <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
        <Barcode 
          value={sampleId} 
          width={1.2} 
          height={30} 
          fontSize={0} 
          margin={0} 
          displayValue={false} 
        />
      </div>
      <div className="w-full flex justify-between items-end text-xs mt-1">
        <span className="font-bold truncate max-w-[65%]" title={patientName}>{patientName}</span>
        <span className="text-[10px] whitespace-nowrap">{date}</span>
      </div>
      <div className="text-[10px] w-full text-center truncate mt-0.5" title={tests}>
        {tests}
      </div>
    </div>
  );
};
