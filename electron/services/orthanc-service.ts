import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';
import fs from 'fs';

export interface OrthancConfig {
  enabled: boolean;
  url: string;
  username?: string;
  password?: string;
  aetTitle?: string;
}

export interface OrthancInstance {
  id: string;
  parentSeries: string;
  parentStudy: string;
  parentPatient: string;
  mainDicomTags: Record<string, string>;
  fileSize: number;
  indexInSeries: number;
}

export interface OrthancStudy {
  id: string;
  parentPatient: string;
  mainDicomTags: {
    StudyInstanceUID: string;
    StudyDate?: string;
    StudyDescription?: string;
    AccessionNumber?: string;
  };
  series: string[];
}

export interface OrthancPatient {
  id: string;
  mainDicomTags: {
    PatientID: string;
    PatientName?: string;
    PatientBirthDate?: string;
    PatientSex?: string;
  };
  studies: string[];
}

export interface UploadResult {
  success: boolean;
  instanceId?: string;
  parentSeries?: string;
  parentStudy?: string;
  parentPatient?: string;
  error?: string;
}

export interface QueryParams {
  PatientID?: string;
  PatientName?: string;
  StudyDate?: string;
  Modality?: string;
  StudyDescription?: string;
}

interface ServerStats {
  countInstances: number;
  countStudies: number;
  countPatients: number;
}

class OrthancService extends EventEmitter {
  private config: OrthancConfig = {
    enabled: false,
    url: 'http://localhost:8042'
  };

  constructor() {
    super();
  }

  configure(config: OrthancConfig): void {
    this.config = { ...config };
    this.logAudit('ORTHANC_CONFIGURE', null, { enabled: config.enabled, url: config.url });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.username && this.config.password) {
      const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }
    return headers;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        }
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private logAudit(
    action: string,
    entityId: string | null,
    details: Record<string, unknown> = {}
  ): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        null,
        action,
        'ORTHANC',
        entityId,
        null,
        JSON.stringify(details),
        null
      );
    } catch (err) {
      console.error('Orthanc audit logging failed:', err);
    }
  }

  async testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    if (!this.config.enabled) {
      return { success: false, error: 'Orthanc integration is disabled' };
    }

    try {
      const response = await this.fetchWithTimeout(`${this.config.url}/system`);
      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        this.logAudit('ORTHANC_CONNECTION_FAILED', null, { error });
        return { success: false, error };
      }

      const data = await response.json();
      this.logAudit('ORTHANC_CONNECTION_SUCCESS', null, { version: data.Version });
      return { success: true, version: data.Version };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      this.logAudit('ORTHANC_CONNECTION_FAILED', null, { error });
      return { success: false, error };
    }
  }

  async uploadDicom(dicomPath: string): Promise<UploadResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Orthanc integration is disabled' };
    }

    try {
      const data = fs.readFileSync(dicomPath);
      return this.uploadDicomBuffer(data);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to read DICOM file';
      this.emit('upload:error', { path: dicomPath, error });
      this.logAudit('ORTHANC_UPLOAD_FAILED', null, { path: dicomPath, error });
      return { success: false, error };
    }
  }

  async uploadDicomBuffer(data: Buffer): Promise<UploadResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Orthanc integration is disabled' };
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.url}/instances`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/dicom' },
          body: data
        },
        30000
      );

      if (!response.ok) {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        this.emit('upload:error', { error });
        this.logAudit('ORTHANC_UPLOAD_FAILED', null, { error });
        return { success: false, error };
      }

      const result = await response.json();
      const uploadResult: UploadResult = {
        success: true,
        instanceId: result.ID,
        parentSeries: result.ParentSeries,
        parentStudy: result.ParentStudy,
        parentPatient: result.ParentPatient
      };

      this.emit('upload:success', uploadResult);
      this.logAudit('ORTHANC_UPLOAD_SUCCESS', result.ID, {
        parentStudy: result.ParentStudy,
        parentPatient: result.ParentPatient
      });

      return uploadResult;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Upload failed';
      this.emit('upload:error', { error });
      this.logAudit('ORTHANC_UPLOAD_FAILED', null, { error });
      return { success: false, error };
    }
  }

  async getInstance(instanceId: string): Promise<OrthancInstance | null> {
    if (!this.config.enabled) return null;

    try {
      const response = await this.fetchWithTimeout(`${this.config.url}/instances/${instanceId}`);
      if (!response.ok) return null;

      const data = await response.json();
      return {
        id: data.ID,
        parentSeries: data.ParentSeries,
        parentStudy: data.ParentStudy,
        parentPatient: data.ParentPatient,
        mainDicomTags: data.MainDicomTags || {},
        fileSize: data.FileSize || 0,
        indexInSeries: data.IndexInSeries || 0
      };
    } catch {
      return null;
    }
  }

  async getStudy(studyId: string): Promise<OrthancStudy | null> {
    if (!this.config.enabled) return null;

    try {
      const response = await this.fetchWithTimeout(`${this.config.url}/studies/${studyId}`);
      if (!response.ok) return null;

      const data = await response.json();
      return {
        id: data.ID,
        parentPatient: data.ParentPatient,
        mainDicomTags: {
          StudyInstanceUID: data.MainDicomTags?.StudyInstanceUID || '',
          StudyDate: data.MainDicomTags?.StudyDate,
          StudyDescription: data.MainDicomTags?.StudyDescription,
          AccessionNumber: data.MainDicomTags?.AccessionNumber
        },
        series: data.Series || []
      };
    } catch {
      return null;
    }
  }

  async getPatient(patientId: string): Promise<OrthancPatient | null> {
    if (!this.config.enabled) return null;

    try {
      const response = await this.fetchWithTimeout(`${this.config.url}/patients/${patientId}`);
      if (!response.ok) return null;

      const data = await response.json();
      return {
        id: data.ID,
        mainDicomTags: {
          PatientID: data.MainDicomTags?.PatientID || '',
          PatientName: data.MainDicomTags?.PatientName,
          PatientBirthDate: data.MainDicomTags?.PatientBirthDate,
          PatientSex: data.MainDicomTags?.PatientSex
        },
        studies: data.Studies || []
      };
    } catch {
      return null;
    }
  }

  async findStudies(query: QueryParams): Promise<OrthancStudy[]> {
    if (!this.config.enabled) return [];

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.url}/tools/find`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Level: 'Study',
            Query: this.buildQuery(query),
            Expand: true
          })
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.map((item: Record<string, unknown>) => ({
        id: item.ID,
        parentPatient: item.ParentPatient,
        mainDicomTags: {
          StudyInstanceUID: (item.MainDicomTags as Record<string, string>)?.StudyInstanceUID || '',
          StudyDate: (item.MainDicomTags as Record<string, string>)?.StudyDate,
          StudyDescription: (item.MainDicomTags as Record<string, string>)?.StudyDescription,
          AccessionNumber: (item.MainDicomTags as Record<string, string>)?.AccessionNumber
        },
        series: (item.Series as string[]) || []
      }));
    } catch {
      return [];
    }
  }

  async findPatients(query: QueryParams): Promise<OrthancPatient[]> {
    if (!this.config.enabled) return [];

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.url}/tools/find`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Level: 'Patient',
            Query: this.buildQuery(query),
            Expand: true
          })
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.map((item: Record<string, unknown>) => ({
        id: item.ID,
        mainDicomTags: {
          PatientID: (item.MainDicomTags as Record<string, string>)?.PatientID || '',
          PatientName: (item.MainDicomTags as Record<string, string>)?.PatientName,
          PatientBirthDate: (item.MainDicomTags as Record<string, string>)?.PatientBirthDate,
          PatientSex: (item.MainDicomTags as Record<string, string>)?.PatientSex
        },
        studies: (item.Studies as string[]) || []
      }));
    } catch {
      return [];
    }
  }

  private buildQuery(params: QueryParams): Record<string, string> {
    const query: Record<string, string> = {};
    if (params.PatientID) query.PatientID = params.PatientID;
    if (params.PatientName) query.PatientName = `*${params.PatientName}*`;
    if (params.StudyDate) query.StudyDate = params.StudyDate;
    if (params.Modality) query.ModalitiesInStudy = params.Modality;
    if (params.StudyDescription) query.StudyDescription = `*${params.StudyDescription}*`;
    return query;
  }

  async getInstancePreview(instanceId: string): Promise<Buffer> {
    if (!this.config.enabled) {
      throw new Error('Orthanc integration is disabled');
    }

    const response = await this.fetchWithTimeout(
      `${this.config.url}/instances/${instanceId}/preview`
    );

    if (!response.ok) {
      throw new Error(`Failed to get preview: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getInstanceDicom(instanceId: string): Promise<Buffer> {
    if (!this.config.enabled) {
      throw new Error('Orthanc integration is disabled');
    }

    const response = await this.fetchWithTimeout(
      `${this.config.url}/instances/${instanceId}/file`,
      {},
      60000
    );

    if (!response.ok) {
      throw new Error(`Failed to download DICOM: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    this.logAudit('ORTHANC_DOWNLOAD', instanceId, { action: 'download_dicom' });
    return Buffer.from(arrayBuffer);
  }

  getViewerUrl(instanceId: string): string {
    return `${this.config.url}/app/explorer.html#instance?uuid=${instanceId}`;
  }

  async deleteInstance(instanceId: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.url}/instances/${instanceId}`,
        { method: 'DELETE' }
      );

      const success = response.ok;
      this.logAudit('ORTHANC_DELETE_INSTANCE', instanceId, { success });
      return success;
    } catch {
      this.logAudit('ORTHANC_DELETE_INSTANCE', instanceId, { success: false });
      return false;
    }
  }

  async deleteStudy(studyId: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.url}/studies/${studyId}`,
        { method: 'DELETE' }
      );

      const success = response.ok;
      this.logAudit('ORTHANC_DELETE_STUDY', studyId, { success });
      return success;
    } catch {
      this.logAudit('ORTHANC_DELETE_STUDY', studyId, { success: false });
      return false;
    }
  }

  async getServerStats(): Promise<ServerStats> {
    if (!this.config.enabled) {
      return { countInstances: 0, countStudies: 0, countPatients: 0 };
    }

    try {
      const response = await this.fetchWithTimeout(`${this.config.url}/statistics`);
      if (!response.ok) {
        return { countInstances: 0, countStudies: 0, countPatients: 0 };
      }

      const data = await response.json();
      return {
        countInstances: data.CountInstances || 0,
        countStudies: data.CountStudies || 0,
        countPatients: data.CountPatients || 0
      };
    } catch {
      return { countInstances: 0, countStudies: 0, countPatients: 0 };
    }
  }
}

export const orthancService = new OrthancService();
