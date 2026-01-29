
// Default production workflow templates for different lab types
// Durations are in minutes

export interface ProductionStep {
    id: string;
    name: string;
    durationMinutes: number;
    color: string;
    requiredEquipment?: string[];
    department?: 'plaster' | 'cad' | 'cam' | 'ceramic' | 'qc';
}

export type LabType = 'dental' | 'general' | 'dental_manual';

export const WORKFLOW_TEMPLATES: Record<LabType, ProductionStep[]> = {
    // Standard Digital Workflow (Intraoral Scan -> Design -> Mill)
    dental: [
        { id: 'cad_design', name: 'CAD Design', durationMinutes: 45, color: '#3b82f6', requiredEquipment: ['Exocad'], department: 'cad' },
        { id: 'milling', name: 'Milling', durationMinutes: 120, color: '#8b5cf6', requiredEquipment: ['Milling Machine'], department: 'cam' },
        { id: 'sintering', name: 'Sintering', durationMinutes: 480, color: '#ef4444', requiredEquipment: ['Sintering Furnace'], department: 'cam' },
        { id: 'glazing', name: 'Stain & Glaze', durationMinutes: 90, color: '#f59e0b', requiredEquipment: ['Ceramic Furnace'], department: 'ceramic' },
        { id: 'finishing', name: 'Final Polish', durationMinutes: 30, color: '#10b981', requiredEquipment: [], department: 'ceramic' },
    ],
    // Manual/Hybrid Workflow (Impression -> Model -> Scan -> Design -> Mill)
    // "The Forgotten Model Room" Coverage
    dental_manual: [
        { id: 'model_pour', name: 'Model Pouring', durationMinutes: 60, color: '#78716c', requiredEquipment: ['Vibrator'], department: 'plaster' },
        { id: 'model_pin', name: 'Pinning & Base', durationMinutes: 45, color: '#a8a29e', department: 'plaster' },
        { id: 'model_die', name: 'Die Trimming', durationMinutes: 30, color: '#d6d3d1', department: 'plaster' },
        { id: 'model_scan', name: 'Desktop Scan', durationMinutes: 20, color: '#0ea5e9', requiredEquipment: ['Desktop Scanner'], department: 'cad' },
        { id: 'cad_design', name: 'CAD Design', durationMinutes: 45, color: '#3b82f6', requiredEquipment: ['Exocad'], department: 'cad' },
        { id: 'milling', name: 'Milling', durationMinutes: 120, color: '#8b5cf6', requiredEquipment: ['Milling Machine'], department: 'cam' },
        { id: 'sintering', name: 'Sintering', durationMinutes: 480, color: '#ef4444', requiredEquipment: ['Sintering Furnace'], department: 'cam' },
        { id: 'glazing', name: 'Stain & Glaze', durationMinutes: 90, color: '#f59e0b', requiredEquipment: ['Ceramic Furnace'], department: 'ceramic' },
        { id: 'finishing', name: 'Final Polish', durationMinutes: 30, color: '#10b981', department: 'ceramic' },
    ],
    general: [
        { id: 'intake', name: 'Intake & Review', durationMinutes: 30, color: '#94a3b8' },
        { id: 'processing', name: 'Processing', durationMinutes: 240, color: '#3b82f6' },
        { id: 'review', name: 'Quality Review', durationMinutes: 60, color: '#f59e0b' },
    ]
};
