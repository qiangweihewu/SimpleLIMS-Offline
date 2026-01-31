export interface LabInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

export interface PatientInfo {
  name: string;
  patientId: string;
  gender: string;
  age: number;
}

export interface SampleInfo {
  sampleId: string;
  collectedAt: string;
  sampleType: string;
}

export interface TestResult {
  category: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  refRange: string;
  flag: string | null;
}

export interface VerificationInfo {
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface ReportData {
  labInfo: LabInfo;
  patient: PatientInfo;
  sample: SampleInfo;
  orderingPhysician?: string;
  results: TestResult[];
  verification: VerificationInfo;
  footer: string;
}
