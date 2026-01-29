import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 定义支持的行业类型
export type IndustryType = 'dental' | 'repair' | 'optical' | 'jewelry' | 'general';

// 术语字典接口
export interface Terminology {
    client: string;       // Doctor / Customer / Client
    client_plural: string;
    subject: string;      // Patient / Device / Order
    subject_plural: string;
    order: string;        // Case / Ticket / Order
    order_plural: string;
    identifier: string;   // Pan # / Ticket # / Order #
    batch: string;        // Pan / Batch
    technician: string;   // Technician / Engineer / Maker
    honorific: string;    // Dr. / empty string
}

// 默认配置（Dental）
const dentalTerms: Terminology = {
    client: 'Doctor',
    client_plural: 'Doctors',
    subject: 'Patient',
    subject_plural: 'Patients',
    order: 'Case',
    order_plural: 'Cases',
    identifier: 'Pan #',
    batch: 'Pan',
    technician: 'Technician',
    honorific: 'Dr.',
};

// 维修店配置 (Repair)
const repairTerms: Terminology = {
    client: 'Customer',
    client_plural: 'Customers',
    subject: 'Device',
    subject_plural: 'Devices',
    order: 'Ticket',
    order_plural: 'Tickets',
    identifier: 'Ticket #',
    batch: 'Batch',
    technician: 'Technician',
    honorific: '',
};

// 光学实验室配置 (Optical)
const opticalTerms: Terminology = {
    client: 'Clinic',
    client_plural: 'Clinics',
    subject: 'Patient',
    subject_plural: 'Patients',
    order: 'Order',
    order_plural: 'Orders',
    identifier: 'Tray #',
    batch: 'Tray',
    technician: 'Lab Tech',
    honorific: '',
};

// 珠宝工作室配置 (Jewelry)
const jewelryTerms: Terminology = {
    client: 'Client',
    client_plural: 'Clients',
    subject: 'Project',
    subject_plural: 'Projects',
    order: 'Order',
    order_plural: 'Orders',
    identifier: 'Order #',
    batch: 'Batch',
    technician: 'Jeweler',
    honorific: '',
};

// 简单的通用配置
const generalTerms: Terminology = {
    client: 'Client',
    client_plural: 'Clients',
    subject: 'Item',
    subject_plural: 'Items',
    order: 'Order',
    order_plural: 'Orders',
    identifier: 'ID',
    batch: 'Batch',
    technician: 'Maker',
    honorific: '',
};

// 映射表
const definitions: Record<IndustryType, Terminology> = {
    dental: dentalTerms,
    repair: repairTerms,
    optical: opticalTerms,
    jewelry: jewelryTerms,
    general: generalTerms,
};

// Store Interface
interface TerminologyState {
    industry: IndustryType;
    terms: Terminology;
    setIndustry: (industry: IndustryType) => void;
}

// Global Store Hook
export const useTerminologyStore = create<TerminologyState>()(
    persist(
        (set) => ({
            industry: 'dental', // 默认为牙科，生产环境应从 AuthContext/User Profile加载
            terms: dentalTerms,
            setIndustry: (industry) => set({
                industry,
                terms: definitions[industry] || generalTerms
            }),
        }),
        {
            name: 'simplelab-terminology', // LocalStorage key
        }
    )
);

// Helper helper for React components
export function useTerms() {
    const terms = useTerminologyStore((state) => state.terms);
    return terms;
}

// Standalone getter for non-React usage
export function getTerms(industry: IndustryType = 'dental'): Terminology {
    return definitions[industry] || generalTerms;
}
