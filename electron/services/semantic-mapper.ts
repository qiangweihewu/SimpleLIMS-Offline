/**
 * SemanticMapper Service
 * 
 * Implements dual-layer mapping architecture:
 * - Layer 1: Device Raw Data → openEHR Archetype
 * - Layer 2: openEHR Archetype → FHIR R4 Resource
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../database/index.js';
import { timeSyncService } from './time-sync-service.js';

// ============================================================================
// Interfaces
// ============================================================================

export interface ArchetypeMapping {
  archetypeId: string;
  deviceField: string;
  archetypePath: string;
  transform?: (value: any) => any;
}

export interface FhirMapping {
  archetypeId: string;
  fhirResourceType: 'Observation' | 'DiagnosticReport' | 'Specimen';
  fhirPath: string;
  coding?: {
    system: string;
    code: string;
    display: string;
  };
}

export interface ArchetypeDocument {
  archetypeId: string;
  name: string;
  data: Record<string, any>;
  context?: {
    startTime: string;
    settingCode?: string;
  };
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: { profile?: string[] };
  status: string;
  code?: { coding: any[]; text?: string };
  subject?: { reference: string };
  effectiveDateTime?: string;
  valueQuantity?: { value: number; unit: string; system?: string; code?: string };
  component?: any[];
  [key: string]: any;
}

interface ArchetypeDefinition {
  archetypeId: string;
  name: string;
  description?: string;
  version?: string;
  deviceMappings: DeviceMapping[];
  fhirProfile?: string;
  fhirCategory?: {
    coding: Array<{ system: string; code: string; display: string }>;
  };
}

interface DeviceMapping {
  deviceField: string;
  archetypePath: string;
  fhirPath: string;
  loinc?: {
    code: string;
    display: string;
  };
  unit?: string;
  ucumCode?: string;
}

interface InstrumentArchetypeConfig {
  instrumentId: number;
  archetypeId: string;
  fieldMappings?: Record<string, string>;
}

// ============================================================================
// Built-in LOINC Mappings
// ============================================================================

const LOINC_MAPPINGS: Record<string, { code: string; display: string; unit?: string; ucumCode?: string }> = {
  WBC: { code: '6690-2', display: 'Leukocytes [#/volume] in Blood by Automated count', unit: '10^9/L', ucumCode: '10*9/L' },
  RBC: { code: '789-8', display: 'Erythrocytes [#/volume] in Blood by Automated count', unit: '10^12/L', ucumCode: '10*12/L' },
  HGB: { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood', unit: 'g/dL', ucumCode: 'g/dL' },
  HCT: { code: '4544-3', display: 'Hematocrit [Volume Fraction] of Blood', unit: '%', ucumCode: '%' },
  MCV: { code: '787-2', display: 'MCV [Entitic volume]', unit: 'fL', ucumCode: 'fL' },
  MCH: { code: '785-6', display: 'MCH [Entitic mass]', unit: 'pg', ucumCode: 'pg' },
  MCHC: { code: '786-4', display: 'MCHC [Mass/volume]', unit: 'g/dL', ucumCode: 'g/dL' },
  PLT: { code: '777-3', display: 'Platelets [#/volume] in Blood by Automated count', unit: '10^9/L', ucumCode: '10*9/L' },
  RDW: { code: '788-0', display: 'RDW [Ratio]', unit: '%', ucumCode: '%' },
  MPV: { code: '32623-1', display: 'MPV [Entitic volume]', unit: 'fL', ucumCode: 'fL' },
  GLU: { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  CREA: { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  BUN: { code: '3094-0', display: 'Urea nitrogen [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  ALT: { code: '1742-6', display: 'ALT [Enzymatic activity/volume] in Serum or Plasma', unit: 'U/L', ucumCode: 'U/L' },
  AST: { code: '1920-8', display: 'AST [Enzymatic activity/volume] in Serum or Plasma', unit: 'U/L', ucumCode: 'U/L' },
  ALP: { code: '6768-6', display: 'Alkaline phosphatase [Enzymatic activity/volume]', unit: 'U/L', ucumCode: 'U/L' },
  TBIL: { code: '1975-2', display: 'Bilirubin.total [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  TP: { code: '2885-2', display: 'Protein [Mass/volume] in Serum or Plasma', unit: 'g/dL', ucumCode: 'g/dL' },
  ALB: { code: '1751-7', display: 'Albumin [Mass/volume] in Serum or Plasma', unit: 'g/dL', ucumCode: 'g/dL' },
  CHOL: { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  TG: { code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  HDL: { code: '2085-9', display: 'HDL Cholesterol [Mass/volume]', unit: 'mg/dL', ucumCode: 'mg/dL' },
  LDL: { code: '2089-1', display: 'LDL Cholesterol [Mass/volume]', unit: 'mg/dL', ucumCode: 'mg/dL' },
  NA: { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma', unit: 'mmol/L', ucumCode: 'mmol/L' },
  K: { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma', unit: 'mmol/L', ucumCode: 'mmol/L' },
  CL: { code: '2075-0', display: 'Chloride [Moles/volume] in Serum or Plasma', unit: 'mmol/L', ucumCode: 'mmol/L' },
  CA: { code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  TSH: { code: '3016-3', display: 'TSH [Units/volume] in Serum or Plasma', unit: 'mIU/L', ucumCode: 'mIU/L' },
  T4: { code: '3026-2', display: 'T4 [Mass/volume] in Serum or Plasma', unit: 'ug/dL', ucumCode: 'ug/dL' },
  T3: { code: '3053-6', display: 'T3 [Mass/volume] in Serum or Plasma', unit: 'ng/dL', ucumCode: 'ng/dL' },
  'NEU%': { code: '770-8', display: 'Neutrophils/100 leukocytes', unit: '%', ucumCode: '%' },
  'LYM%': { code: '736-9', display: 'Lymphocytes/100 leukocytes', unit: '%', ucumCode: '%' },
  'MONO%': { code: '5905-5', display: 'Monocytes/100 leukocytes', unit: '%', ucumCode: '%' },
  'EOS%': { code: '713-8', display: 'Eosinophils/100 leukocytes', unit: '%', ucumCode: '%' },
  'BASO%': { code: '706-2', display: 'Basophils/100 leukocytes', unit: '%', ucumCode: '%' },
  UA: { code: '3084-1', display: 'Urate [Mass/volume] in Serum or Plasma', unit: 'mg/dL', ucumCode: 'mg/dL' },
  GGT: { code: '2324-2', display: 'GGT [Enzymatic activity/volume]', unit: 'U/L', ucumCode: 'U/L' },
  LDH: { code: '2532-0', display: 'LDH [Enzymatic activity/volume]', unit: 'U/L', ucumCode: 'U/L' },
  CK: { code: '2157-6', display: 'Creatine kinase [Enzymatic activity/volume]', unit: 'U/L', ucumCode: 'U/L' },
  AMY: { code: '1798-8', display: 'Amylase [Enzymatic activity/volume]', unit: 'U/L', ucumCode: 'U/L' },
  LIP: { code: '3040-3', display: 'Lipase [Enzymatic activity/volume]', unit: 'U/L', ucumCode: 'U/L' },
  HBA1C: { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total', unit: '%', ucumCode: '%' },
  CRP: { code: '1988-5', display: 'C reactive protein [Mass/volume]', unit: 'mg/L', ucumCode: 'mg/L' },
  ESR: { code: '4537-7', display: 'Erythrocyte sedimentation rate', unit: 'mm/h', ucumCode: 'mm/h' },
};

// ============================================================================
// SemanticMapper Class
// ============================================================================

export class SemanticMapper extends EventEmitter {
  private archetypes: Map<string, ArchetypeDefinition> = new Map();
  private instrumentArchetypes: Map<number, InstrumentArchetypeConfig> = new Map();
  private initialized = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const archetypesDir = path.join(__dirname, '..', 'archetypes');
      if (fs.existsSync(archetypesDir)) {
        const files = fs.readdirSync(archetypesDir).filter(f => f.endsWith('.archetype.json'));
        for (const file of files) {
          await this.loadArchetype(path.join(archetypesDir, file));
        }
      }

      this.loadInstrumentArchetypeConfigs();
      this.initialized = true;
      console.log('[SemanticMapper] Initialized with', this.archetypes.size, 'archetypes');
    } catch (err) {
      console.error('[SemanticMapper] Failed to initialize:', err);
    }
  }

  async loadArchetype(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const definition: ArchetypeDefinition = JSON.parse(content);
      this.archetypes.set(definition.archetypeId, definition);
      console.log('[SemanticMapper] Loaded archetype:', definition.archetypeId);
    } catch (err) {
      console.error('[SemanticMapper] Failed to load archetype:', filePath, err);
      throw err;
    }
  }

  private loadInstrumentArchetypeConfigs(): void {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT key, value FROM settings 
        WHERE key LIKE 'instrument_archetype_%'
      `).all() as { key: string; value: string }[];

      for (const row of rows) {
        const instrumentId = parseInt(row.key.replace('instrument_archetype_', ''));
        if (!isNaN(instrumentId)) {
          const config: InstrumentArchetypeConfig = JSON.parse(row.value);
          this.instrumentArchetypes.set(instrumentId, config);
        }
      }
    } catch (err) {
      console.error('[SemanticMapper] Failed to load instrument configs:', err);
    }
  }

  toArchetype(deviceData: Record<string, any>, instrumentId: number): ArchetypeDocument {
    const config = this.instrumentArchetypes.get(instrumentId);
    const archetypeId = config?.archetypeId || 'openEHR-EHR-OBSERVATION.laboratory_test_result.v1';
    const archetype = this.archetypes.get(archetypeId);

    const mappedData: Record<string, any> = {};

    if (archetype) {
      for (const mapping of archetype.deviceMappings) {
        const deviceField = config?.fieldMappings?.[mapping.deviceField] || mapping.deviceField;
        if (deviceData[deviceField] !== undefined) {
          mappedData[mapping.archetypePath] = {
            value: deviceData[deviceField],
            unit: mapping.unit,
            ucumCode: mapping.ucumCode,
            loinc: mapping.loinc,
          };
        }
      }
    } else {
      for (const [field, value] of Object.entries(deviceData)) {
        const loinc = LOINC_MAPPINGS[field.toUpperCase()];
        mappedData[`/data/events/data/items/${field}/value`] = {
          value,
          loinc,
          unit: loinc?.unit,
          ucumCode: loinc?.ucumCode,
        };
      }
    }

    const receiptTime = timeSyncService.getReceiptTimestamp();

    return {
      archetypeId,
      name: archetype?.name || 'Laboratory Test Result',
      data: mappedData,
      context: {
        startTime: receiptTime,
        settingCode: 'laboratory',
      },
    };
  }

  toFhir(archetype: ArchetypeDocument): FhirResource {
    const archetypeDef = this.archetypes.get(archetype.archetypeId);
    const components: any[] = [];
    let primaryValue: any = null;

    for (const [archetypePath, pathData] of Object.entries(archetype.data)) {
      const { value, loinc, unit, ucumCode } = pathData;

      if (loinc) {
        const component: any = {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: loinc.code,
                display: loinc.display,
              },
            ],
          },
        };

        if (typeof value === 'number') {
          component.valueQuantity = {
            value,
            unit: unit || '',
            system: 'http://unitsofmeasure.org',
            code: ucumCode || unit || '',
          };
        } else if (typeof value === 'string') {
          component.valueString = value;
        }

        components.push(component);

        if (!primaryValue && typeof value === 'number') {
          primaryValue = {
            valueQuantity: component.valueQuantity,
            code: component.code,
          };
        }
      }
    }

    const fhirResource: FhirResource = {
      resourceType: 'Observation',
      id: this.generateResourceId(),
      meta: {
        profile: archetypeDef?.fhirProfile ? [archetypeDef.fhirProfile] : ['http://hl7.org/fhir/StructureDefinition/Observation'],
      },
      status: 'final',
      category: archetypeDef?.fhirCategory ? [archetypeDef.fhirCategory] : [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      effectiveDateTime: archetype.context?.startTime,
    };

    if (components.length > 1) {
      fhirResource.code = {
        coding: [
          {
            system: 'http://loinc.org',
            code: '58410-2',
            display: 'Complete blood count (CBC) panel',
          },
        ],
        text: archetype.name,
      };
      fhirResource.component = components;
    } else if (components.length === 1 && primaryValue) {
      fhirResource.code = primaryValue.code;
      fhirResource.valueQuantity = primaryValue.valueQuantity;
    }

    return fhirResource;
  }

  deviceToFhir(deviceData: Record<string, any>, instrumentId: number): FhirResource {
    const archetype = this.toArchetype(deviceData, instrumentId);
    return this.toFhir(archetype);
  }

  async saveFhirResource(resource: FhirResource, sourceResultId?: number): Promise<number> {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO fhir_resources (resource_id, resource_type, resource_json, source_result_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      resource.id || this.generateResourceId(),
      resource.resourceType,
      JSON.stringify(resource),
      sourceResultId || null
    );

    console.log('[SemanticMapper] Saved FHIR resource:', resource.id, 'type:', resource.resourceType);
    this.emit('resource-saved', { resourceId: resource.id, resourceType: resource.resourceType });

    return result.lastInsertRowid as number;
  }

  getFhirResource(resourceId: string): FhirResource | null {
    const db = getDatabase();
    
    const row = db.prepare(`
      SELECT resource_json FROM fhir_resources WHERE resource_id = ?
    `).get(resourceId) as { resource_json: string } | undefined;

    if (!row) return null;

    return JSON.parse(row.resource_json) as FhirResource;
  }

  getFhirResourcesByResult(resultId: number): FhirResource[] {
    const db = getDatabase();
    
    const rows = db.prepare(`
      SELECT resource_json FROM fhir_resources WHERE source_result_id = ?
    `).all(resultId) as { resource_json: string }[];

    return rows.map(row => JSON.parse(row.resource_json) as FhirResource);
  }

  getLoincCode(testCode: string): { code: string; display: string; unit?: string; ucumCode?: string } | undefined {
    return LOINC_MAPPINGS[testCode.toUpperCase()];
  }

  getAllLoincMappings(): Record<string, { code: string; display: string; unit?: string; ucumCode?: string }> {
    return { ...LOINC_MAPPINGS };
  }

  getLoadedArchetypes(): string[] {
    return Array.from(this.archetypes.keys());
  }

  async setInstrumentArchetype(instrumentId: number, archetypeId: string, fieldMappings?: Record<string, string>): Promise<void> {
    const config: InstrumentArchetypeConfig = {
      instrumentId,
      archetypeId,
      fieldMappings,
    };

    this.instrumentArchetypes.set(instrumentId, config);

    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `).run(`instrument_archetype_${instrumentId}`, JSON.stringify(config));

    console.log('[SemanticMapper] Set archetype for instrument', instrumentId, ':', archetypeId);
  }

  createDiagnosticReport(observations: FhirResource[], patientRef?: string): FhirResource {
    const report: FhirResource = {
      resourceType: 'DiagnosticReport',
      id: this.generateResourceId(),
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'],
      },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '58410-2',
            display: 'Complete blood count (CBC) panel',
          },
        ],
      },
      effectiveDateTime: new Date().toISOString(),
      result: observations.map(obs => ({
        reference: `Observation/${obs.id}`,
      })),
    };

    if (patientRef) {
      report.subject = { reference: patientRef };
    }

    return report;
  }

  private generateResourceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }
}

export const semanticMapper = new SemanticMapper();
