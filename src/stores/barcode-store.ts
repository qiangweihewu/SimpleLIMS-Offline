import { create } from 'zustand';

export interface BarcodeData {
  sampleId: string;
  patientName: string;
  tests: string;
  date: string;
}

interface BarcodeStore {
  data: BarcodeData | null;
  print: (data: BarcodeData) => void;
  clear: () => void;
}

export const useBarcodeStore = create<BarcodeStore>((set) => ({
  data: null,
  print: (data) => set({ data }),
  clear: () => set({ data: null }),
}));
