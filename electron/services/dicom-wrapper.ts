import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface PatientDemographics {
  patientId: string;
  name: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'O';
}

export interface StudyMetadata {
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  modality: 'US' | 'XA' | 'CR' | 'DX' | 'OT';
  institutionName?: string;
  referringPhysician?: string;
}

export interface DicomFile {
  path: string;
  sopInstanceUID: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  modality: string;
  patientId: string;
  createdAt: string;
}

const DICOM_TAGS = {
  FileMetaInformationGroupLength: '00020000',
  FileMetaInformationVersion: '00020001',
  MediaStorageSOPClassUID: '00020002',
  MediaStorageSOPInstanceUID: '00020003',
  TransferSyntaxUID: '00020010',
  ImplementationClassUID: '00020012',
  ImplementationVersionName: '00020013',
  PatientName: '00100010',
  PatientID: '00100020',
  PatientBirthDate: '00100030',
  PatientSex: '00100040',
  StudyInstanceUID: '0020000D',
  SeriesInstanceUID: '0020000E',
  StudyDate: '00080020',
  StudyTime: '00080030',
  Modality: '00080060',
  Manufacturer: '00080070',
  InstitutionName: '00080080',
  ReferringPhysicianName: '00080090',
  StudyDescription: '00081030',
  SOPClassUID: '00080016',
  SOPInstanceUID: '00080018',
  InstanceNumber: '00200013',
  SamplesPerPixel: '00280002',
  PhotometricInterpretation: '00280004',
  Rows: '00280010',
  Columns: '00280011',
  BitsAllocated: '00280100',
  BitsStored: '00280101',
  HighBit: '00280102',
  PixelRepresentation: '00280103',
  NumberOfFrames: '00280008',
  PixelData: '7FE00010',
};

const SOP_CLASSES = {
  SecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7',
  UltrasoundImageStorage: '1.2.840.10008.5.1.4.1.1.6.1',
  XRayAngiographicImageStorage: '1.2.840.10008.5.1.4.1.1.12.1',
  ComputedRadiographyImageStorage: '1.2.840.10008.5.1.4.1.1.1',
  DigitalXRayImageStorageForPresentation: '1.2.840.10008.5.1.4.1.1.1.1',
  MultiFrameSecondaryCaptureImageStorage: '1.2.840.10008.5.1.4.1.1.7.2',
};

const TRANSFER_SYNTAX = {
  ExplicitVRLittleEndian: '1.2.840.10008.1.2.1',
  JPEGBaseline: '1.2.840.10008.1.2.4.50',
};

const UID_ROOT = '1.2.826.0.1.3680043';
const IMPLEMENTATION_CLASS_UID = `${UID_ROOT}.9.7892.1.1`;
const IMPLEMENTATION_VERSION = 'SIMPLELIMS_1.0';

class DicomWrapper extends EventEmitter {
  private dicomStorePath: string = '';

  constructor() {
    super();
    this.ensureTableExists();
  }

  private ensureTableExists(): void {
    try {
      const db = getDatabase();
      db.exec(`
        CREATE TABLE IF NOT EXISTS dicom_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          sop_instance_uid TEXT NOT NULL UNIQUE,
          study_instance_uid TEXT NOT NULL,
          series_instance_uid TEXT NOT NULL,
          modality TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          metadata TEXT
        )
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_dicom_patient_id ON dicom_files(patient_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_dicom_study_uid ON dicom_files(study_instance_uid)`);
    } catch {
      // Table creation may fail if database not yet initialized
    }
  }

  setStorePath(storePath: string): void {
    this.dicomStorePath = storePath;
    if (!fs.existsSync(storePath)) {
      fs.mkdirSync(storePath, { recursive: true });
    }
  }

  generateUID(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    const numericRandom = BigInt(`0x${random}`).toString().slice(0, 12);
    return `${UID_ROOT}.${timestamp}.${numericRandom}`;
  }

  private writeTag(
    buffer: Buffer,
    offset: number,
    tag: string,
    vr: string,
    value: Buffer | string
  ): number {
    const group = parseInt(tag.slice(0, 4), 16);
    const element = parseInt(tag.slice(4, 8), 16);

    buffer.writeUInt16LE(group, offset);
    offset += 2;
    buffer.writeUInt16LE(element, offset);
    offset += 2;

    buffer.write(vr, offset, 2, 'ascii');
    offset += 2;

    const valueBuffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    let valueLength = valueBuffer.length;

    if (['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UR', 'UT'].includes(vr)) {
      buffer.writeUInt16LE(0, offset);
      offset += 2;
      buffer.writeUInt32LE(valueLength, offset);
      offset += 4;
    } else {
      if (valueLength % 2 !== 0) valueLength++;
      buffer.writeUInt16LE(valueLength, offset);
      offset += 2;
    }

    valueBuffer.copy(buffer, offset);
    offset += valueBuffer.length;

    if (valueBuffer.length % 2 !== 0) {
      buffer.writeUInt8(vr === 'UI' ? 0 : 0x20, offset);
      offset += 1;
    }

    return offset;
  }

  private calculateTagSize(vr: string, value: Buffer | string): number {
    const valueBuffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    let valueLength = valueBuffer.length;
    if (valueLength % 2 !== 0) valueLength++;

    if (['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UR', 'UT'].includes(vr)) {
      return 4 + 2 + 2 + 4 + valueLength;
    }
    return 4 + 2 + 2 + valueLength;
  }

  private getSopClassForModality(modality: string): string {
    switch (modality) {
      case 'US':
        return SOP_CLASSES.UltrasoundImageStorage;
      case 'XA':
        return SOP_CLASSES.XRayAngiographicImageStorage;
      case 'CR':
        return SOP_CLASSES.ComputedRadiographyImageStorage;
      case 'DX':
        return SOP_CLASSES.DigitalXRayImageStorageForPresentation;
      default:
        return SOP_CLASSES.SecondaryCaptureImageStorage;
    }
  }

  private getImageDimensions(
    imageBuffer: Buffer
  ): { width: number; height: number; isJpeg: boolean; isPng: boolean } {
    if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
      let offset = 2;
      while (offset < imageBuffer.length) {
        if (imageBuffer[offset] !== 0xff) break;
        const marker = imageBuffer[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = imageBuffer.readUInt16BE(offset + 5);
          const width = imageBuffer.readUInt16BE(offset + 7);
          return { width, height, isJpeg: true, isPng: false };
        }
        const length = imageBuffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
      return { width: 512, height: 512, isJpeg: true, isPng: false };
    }

    if (
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e &&
      imageBuffer[3] === 0x47
    ) {
      const width = imageBuffer.readUInt32BE(16);
      const height = imageBuffer.readUInt32BE(20);
      return { width, height, isJpeg: false, isPng: true };
    }

    return { width: 512, height: 512, isJpeg: false, isPng: false };
  }

  private buildFileMetaInformation(
    sopClassUID: string,
    sopInstanceUID: string,
    transferSyntax: string
  ): Buffer {
    const tags: Array<{ tag: string; vr: string; value: string }> = [
      { tag: DICOM_TAGS.FileMetaInformationVersion, vr: 'OB', value: '\x00\x01' },
      { tag: DICOM_TAGS.MediaStorageSOPClassUID, vr: 'UI', value: sopClassUID },
      { tag: DICOM_TAGS.MediaStorageSOPInstanceUID, vr: 'UI', value: sopInstanceUID },
      { tag: DICOM_TAGS.TransferSyntaxUID, vr: 'UI', value: transferSyntax },
      { tag: DICOM_TAGS.ImplementationClassUID, vr: 'UI', value: IMPLEMENTATION_CLASS_UID },
      { tag: DICOM_TAGS.ImplementationVersionName, vr: 'SH', value: IMPLEMENTATION_VERSION },
    ];

    let metaSize = 0;
    for (const t of tags) {
      metaSize += this.calculateTagSize(t.vr, t.value);
    }

    const groupLengthSize = this.calculateTagSize('UL', Buffer.alloc(4));
    const totalMetaSize = groupLengthSize + metaSize;

    const buffer = Buffer.alloc(totalMetaSize);
    let offset = 0;

    const groupLengthBuffer = Buffer.alloc(4);
    groupLengthBuffer.writeUInt32LE(metaSize, 0);
    offset = this.writeTag(buffer, offset, DICOM_TAGS.FileMetaInformationGroupLength, 'UL', groupLengthBuffer);

    for (const t of tags) {
      offset = this.writeTag(buffer, offset, t.tag, t.vr, t.value);
    }

    return buffer;
  }

  private encapsulatePixelData(imageData: Buffer): Buffer {
    const itemTag = Buffer.alloc(8);
    itemTag.writeUInt16LE(0xfffe, 0);
    itemTag.writeUInt16LE(0xe000, 2);
    itemTag.writeUInt32LE(0, 4);

    const frameItemTag = Buffer.alloc(8);
    frameItemTag.writeUInt16LE(0xfffe, 0);
    frameItemTag.writeUInt16LE(0xe000, 2);
    frameItemTag.writeUInt32LE(imageData.length, 4);

    const delimiterTag = Buffer.alloc(8);
    delimiterTag.writeUInt16LE(0xfffe, 0);
    delimiterTag.writeUInt16LE(0xe0dd, 2);
    delimiterTag.writeUInt32LE(0, 4);

    return Buffer.concat([itemTag, frameItemTag, imageData, delimiterTag]);
  }

  private buildDataset(
    patient: PatientDemographics,
    study: StudyMetadata,
    sopClassUID: string,
    sopInstanceUID: string,
    imageData: Buffer,
    dimensions: { width: number; height: number },
    isEncapsulated: boolean,
    numberOfFrames: number = 1
  ): Buffer {
    const now = new Date();
    const studyDate = study.studyDate || now.toISOString().slice(0, 10).replace(/-/g, '');
    const studyTime = study.studyTime || now.toISOString().slice(11, 19).replace(/:/g, '');
    const studyInstanceUID = study.studyInstanceUID || this.generateUID();
    const seriesInstanceUID = study.seriesInstanceUID || this.generateUID();

    const tags: Array<{ tag: string; vr: string; value: string | Buffer }> = [
      { tag: DICOM_TAGS.SOPClassUID, vr: 'UI', value: sopClassUID },
      { tag: DICOM_TAGS.SOPInstanceUID, vr: 'UI', value: sopInstanceUID },
      { tag: DICOM_TAGS.StudyDate, vr: 'DA', value: studyDate },
      { tag: DICOM_TAGS.StudyTime, vr: 'TM', value: studyTime },
      { tag: DICOM_TAGS.Modality, vr: 'CS', value: study.modality },
      { tag: DICOM_TAGS.Manufacturer, vr: 'LO', value: 'SimpleLIMS' },
    ];

    if (study.institutionName) {
      tags.push({ tag: DICOM_TAGS.InstitutionName, vr: 'LO', value: study.institutionName });
    }
    if (study.referringPhysician) {
      tags.push({ tag: DICOM_TAGS.ReferringPhysicianName, vr: 'PN', value: study.referringPhysician });
    }
    if (study.studyDescription) {
      tags.push({ tag: DICOM_TAGS.StudyDescription, vr: 'LO', value: study.studyDescription });
    }

    tags.push({ tag: DICOM_TAGS.PatientName, vr: 'PN', value: patient.name.replace(/\s+/g, '^') });
    tags.push({ tag: DICOM_TAGS.PatientID, vr: 'LO', value: patient.patientId });

    if (patient.birthDate) {
      tags.push({ tag: DICOM_TAGS.PatientBirthDate, vr: 'DA', value: patient.birthDate });
    }
    if (patient.gender) {
      tags.push({ tag: DICOM_TAGS.PatientSex, vr: 'CS', value: patient.gender });
    }

    tags.push({ tag: DICOM_TAGS.StudyInstanceUID, vr: 'UI', value: studyInstanceUID });
    tags.push({ tag: DICOM_TAGS.SeriesInstanceUID, vr: 'UI', value: seriesInstanceUID });
    tags.push({ tag: DICOM_TAGS.InstanceNumber, vr: 'IS', value: '1' });

    if (numberOfFrames > 1) {
      tags.push({ tag: DICOM_TAGS.NumberOfFrames, vr: 'IS', value: numberOfFrames.toString() });
    }

    tags.push({ tag: DICOM_TAGS.SamplesPerPixel, vr: 'US', value: Buffer.from([3, 0]) });
    tags.push({ tag: DICOM_TAGS.PhotometricInterpretation, vr: 'CS', value: 'YBR_FULL_422' });

    const rowsBuffer = Buffer.alloc(2);
    rowsBuffer.writeUInt16LE(dimensions.height, 0);
    tags.push({ tag: DICOM_TAGS.Rows, vr: 'US', value: rowsBuffer });

    const colsBuffer = Buffer.alloc(2);
    colsBuffer.writeUInt16LE(dimensions.width, 0);
    tags.push({ tag: DICOM_TAGS.Columns, vr: 'US', value: colsBuffer });

    tags.push({ tag: DICOM_TAGS.BitsAllocated, vr: 'US', value: Buffer.from([8, 0]) });
    tags.push({ tag: DICOM_TAGS.BitsStored, vr: 'US', value: Buffer.from([8, 0]) });
    tags.push({ tag: DICOM_TAGS.HighBit, vr: 'US', value: Buffer.from([7, 0]) });
    tags.push({ tag: DICOM_TAGS.PixelRepresentation, vr: 'US', value: Buffer.from([0, 0]) });

    tags.sort((a, b) => {
      const aGroup = parseInt(a.tag.slice(0, 4), 16);
      const bGroup = parseInt(b.tag.slice(0, 4), 16);
      if (aGroup !== bGroup) return aGroup - bGroup;
      const aElement = parseInt(a.tag.slice(4, 8), 16);
      const bElement = parseInt(b.tag.slice(4, 8), 16);
      return aElement - bElement;
    });

    let datasetSize = 0;
    for (const t of tags) {
      datasetSize += this.calculateTagSize(t.vr, t.value);
    }

    let pixelDataBuffer: Buffer;
    if (isEncapsulated) {
      const encapsulatedData = this.encapsulatePixelData(imageData);
      pixelDataBuffer = Buffer.alloc(12 + encapsulatedData.length);
      pixelDataBuffer.writeUInt16LE(0x7fe0, 0);
      pixelDataBuffer.writeUInt16LE(0x0010, 2);
      pixelDataBuffer.write('OB', 4, 2, 'ascii');
      pixelDataBuffer.writeUInt16LE(0, 6);
      pixelDataBuffer.writeUInt32LE(0xffffffff, 8);
      encapsulatedData.copy(pixelDataBuffer, 12);
    } else {
      const paddedLength = imageData.length % 2 === 0 ? imageData.length : imageData.length + 1;
      pixelDataBuffer = Buffer.alloc(12 + paddedLength);
      pixelDataBuffer.writeUInt16LE(0x7fe0, 0);
      pixelDataBuffer.writeUInt16LE(0x0010, 2);
      pixelDataBuffer.write('OW', 4, 2, 'ascii');
      pixelDataBuffer.writeUInt16LE(0, 6);
      pixelDataBuffer.writeUInt32LE(paddedLength, 8);
      imageData.copy(pixelDataBuffer, 12);
    }

    const datasetBuffer = Buffer.alloc(datasetSize);
    let offset = 0;
    for (const t of tags) {
      offset = this.writeTag(datasetBuffer, offset, t.tag, t.vr, t.value);
    }

    return Buffer.concat([datasetBuffer, pixelDataBuffer]);
  }

  async wrapImage(
    imagePath: string,
    patient: PatientDemographics,
    study: StudyMetadata
  ): Promise<DicomFile> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const dimensions = this.getImageDimensions(imageBuffer);
    const sopInstanceUID = study.sopInstanceUID || this.generateUID();
    const studyInstanceUID = study.studyInstanceUID || this.generateUID();
    const seriesInstanceUID = study.seriesInstanceUID || this.generateUID();
    const sopClassUID = this.getSopClassForModality(study.modality);

    const transferSyntax = dimensions.isJpeg
      ? TRANSFER_SYNTAX.JPEGBaseline
      : TRANSFER_SYNTAX.ExplicitVRLittleEndian;

    const preamble = Buffer.alloc(128, 0);
    const magic = Buffer.from('DICM', 'ascii');

    const fileMeta = this.buildFileMetaInformation(sopClassUID, sopInstanceUID, transferSyntax);
    const dataset = this.buildDataset(
      patient,
      { ...study, studyInstanceUID, seriesInstanceUID, sopInstanceUID },
      sopClassUID,
      sopInstanceUID,
      imageBuffer,
      dimensions,
      dimensions.isJpeg
    );

    const dicomBuffer = Buffer.concat([preamble, magic, fileMeta, dataset]);

    const outputFilename = `${sopInstanceUID}.dcm`;
    const outputPath = this.dicomStorePath
      ? path.join(this.dicomStorePath, outputFilename)
      : path.join(path.dirname(imagePath), outputFilename);

    fs.writeFileSync(outputPath, dicomBuffer);

    const dicomFile: DicomFile = {
      path: outputPath,
      sopInstanceUID,
      studyInstanceUID,
      seriesInstanceUID,
      modality: study.modality,
      patientId: patient.patientId,
      createdAt: new Date().toISOString(),
    };

    this.saveToDatabase(dicomFile);
    this.emit('dicom-created', dicomFile);

    return dicomFile;
  }

  async wrapVideo(
    videoPath: string,
    patient: PatientDemographics,
    study: StudyMetadata
  ): Promise<DicomFile> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const videoBuffer = fs.readFileSync(videoPath);
    const sopInstanceUID = study.sopInstanceUID || this.generateUID();
    const studyInstanceUID = study.studyInstanceUID || this.generateUID();
    const seriesInstanceUID = study.seriesInstanceUID || this.generateUID();
    const sopClassUID = SOP_CLASSES.MultiFrameSecondaryCaptureImageStorage;

    const preamble = Buffer.alloc(128, 0);
    const magic = Buffer.from('DICM', 'ascii');

    const fileMeta = this.buildFileMetaInformation(
      sopClassUID,
      sopInstanceUID,
      TRANSFER_SYNTAX.ExplicitVRLittleEndian
    );

    const dimensions = { width: 640, height: 480 };
    const numberOfFrames = 1;

    const dataset = this.buildDataset(
      patient,
      { ...study, studyInstanceUID, seriesInstanceUID, sopInstanceUID },
      sopClassUID,
      sopInstanceUID,
      videoBuffer,
      dimensions,
      false,
      numberOfFrames
    );

    const dicomBuffer = Buffer.concat([preamble, magic, fileMeta, dataset]);

    const outputFilename = `${sopInstanceUID}.dcm`;
    const outputPath = this.dicomStorePath
      ? path.join(this.dicomStorePath, outputFilename)
      : path.join(path.dirname(videoPath), outputFilename);

    fs.writeFileSync(outputPath, dicomBuffer);

    const dicomFile: DicomFile = {
      path: outputPath,
      sopInstanceUID,
      studyInstanceUID,
      seriesInstanceUID,
      modality: study.modality,
      patientId: patient.patientId,
      createdAt: new Date().toISOString(),
    };

    this.saveToDatabase(dicomFile);
    this.emit('dicom-created', dicomFile);

    return dicomFile;
  }

  async extractMetadata(dicomPath: string): Promise<Record<string, unknown>> {
    if (!fs.existsSync(dicomPath)) {
      throw new Error(`DICOM file not found: ${dicomPath}`);
    }

    const buffer = fs.readFileSync(dicomPath);

    if (buffer.toString('ascii', 128, 132) !== 'DICM') {
      throw new Error('Invalid DICOM file: missing DICM magic');
    }

    const metadata: Record<string, unknown> = {};
    let offset = 132;

    const tagNames: Record<string, string> = {
      '00100010': 'PatientName',
      '00100020': 'PatientID',
      '00100030': 'PatientBirthDate',
      '00100040': 'PatientSex',
      '0020000D': 'StudyInstanceUID',
      '0020000E': 'SeriesInstanceUID',
      '00080020': 'StudyDate',
      '00080030': 'StudyTime',
      '00080060': 'Modality',
      '00080016': 'SOPClassUID',
      '00080018': 'SOPInstanceUID',
      '00080080': 'InstitutionName',
      '00081030': 'StudyDescription',
    };

    while (offset < buffer.length - 8) {
      const group = buffer.readUInt16LE(offset);
      const element = buffer.readUInt16LE(offset + 2);
      const tag = group.toString(16).padStart(4, '0').toUpperCase() +
        element.toString(16).padStart(4, '0').toUpperCase();

      if (tag === '7FE00010') break;

      const vr = buffer.toString('ascii', offset + 4, offset + 6);
      let valueLength: number;
      let valueOffset: number;

      if (['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UR', 'UT'].includes(vr)) {
        valueLength = buffer.readUInt32LE(offset + 8);
        valueOffset = offset + 12;
      } else {
        valueLength = buffer.readUInt16LE(offset + 6);
        valueOffset = offset + 8;
      }

      if (valueLength === 0xffffffff) {
        offset = valueOffset;
        continue;
      }

      if (tagNames[tag] && valueLength > 0 && valueLength < 256) {
        let value = buffer.toString('utf8', valueOffset, valueOffset + valueLength).replace(/\0/g, '').trim();
        if (vr === 'PN') {
          value = value.replace(/\^/g, ' ');
        }
        metadata[tagNames[tag]] = value;
      }

      offset = valueOffset + valueLength;
      if (offset % 2 !== 0) offset++;
    }

    return metadata;
  }

  getDicomFiles(patientId?: string): DicomFile[] {
    const db = getDatabase();
    let sql = `
      SELECT path, sop_instance_uid as sopInstanceUID, study_instance_uid as studyInstanceUID,
             series_instance_uid as seriesInstanceUID, modality, patient_id as patientId,
             created_at as createdAt
      FROM dicom_files
    `;
    const params: string[] = [];

    if (patientId) {
      sql += ' WHERE patient_id = ?';
      params.push(patientId);
    }

    sql += ' ORDER BY created_at DESC';

    return db.prepare(sql).all(...params) as DicomFile[];
  }

  private saveToDatabase(dicomFile: DicomFile): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT OR REPLACE INTO dicom_files
        (path, sop_instance_uid, study_instance_uid, series_instance_uid, modality, patient_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        dicomFile.path,
        dicomFile.sopInstanceUID,
        dicomFile.studyInstanceUID,
        dicomFile.seriesInstanceUID,
        dicomFile.modality,
        dicomFile.patientId,
        dicomFile.createdAt
      );
    } catch (err) {
      console.error('Failed to save DICOM file to database:', err);
    }
  }
}

export const dicomWrapper = new DicomWrapper();
