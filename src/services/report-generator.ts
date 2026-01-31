/**
 * Report Generator Service
 * Handles PDF and Excel export for laboratory reports
 */

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { ReportData, ReportResultItem } from './database.service';

export interface ReportGeneratorOptions {
  includeHeader?: boolean;
  includeReferenceRanges?: boolean;
  includeVerificationStatus?: boolean;
  landscape?: boolean;
}

export class ReportGenerator {
  /**
   * Generate PDF report
   */
  static generatePDF(
    reportData: ReportData,
    options: ReportGeneratorOptions = {}
  ): Blob {
    const {
      includeHeader = true,
      includeReferenceRanges = true,
      includeVerificationStatus = true,
      landscape = false,
    } = options;

    const doc = new jsPDF({
      orientation: landscape ? 'l' : 'p',
      unit: 'mm',
      format: 'a4',
    });

    let yPosition = 15;
    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    // Header section
    if (includeHeader) {
      yPosition = this.addHeader(doc, reportData, margin, yPosition, contentWidth);
    }

    // Patient info
    yPosition = this.addPatientInfo(doc, reportData, margin, yPosition, contentWidth);

    // Results table
    yPosition = this.addResultsTable(
      doc,
      reportData.results,
      margin,
      yPosition,
      contentWidth,
      includeReferenceRanges,
      includeVerificationStatus
    );

    // Footer
    this.addFooter(doc, reportData, margin, pageHeight);

    return doc.output('blob');
  }

  /**
   * Generate Excel report
   */
  static generateExcel(
    reportData: ReportData,
    includeReferenceRanges: boolean = true,
    includeVerificationStatus: boolean = true
  ): Blob {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Sample Info
    const sampleData = [
      ['Sample Report'],
      [],
      ['Sample ID', reportData.sample.sample_id],
      ['Patient Name', `${reportData.sample.first_name} ${reportData.sample.last_name}`],
      ['Patient Code', reportData.sample.patient_code],
      ['Date of Birth', reportData.sample.date_of_birth],
      ['Gender', reportData.sample.gender],
      [],
    ];

    // Sheet 2: Results
    const resultsHeaders = [
      'Test Code',
      'Test Name',
      'Value',
      'Unit',
      'Flag',
      includeReferenceRanges ? 'Ref Range' : '',
      includeVerificationStatus ? 'Status' : '',
    ].filter(Boolean);

    const resultsData: unknown[][] = [resultsHeaders];

    for (const result of reportData.results) {
      const row = [
        result.test_code,
        result.test_name,
        result.value,
        result.unit || '',
        result.flag || '',
      ];

      if (includeReferenceRanges) {
        const refRange =
          result.ref_range_low && result.ref_range_high
            ? `${result.ref_range_low}-${result.ref_range_high}`
            : '';
        row.push(refRange);
      }

      if (includeVerificationStatus) {
        const status = result.verified_at ? 'Verified' : 'Pending';
        row.push(status);
      }

      resultsData.push(row);
    }

    const sampleSheet = XLSX.utils.aoa_to_sheet(sampleData);
    const resultsSheet = XLSX.utils.aoa_to_sheet(resultsData);

    // Set column widths
    sampleSheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
    resultsSheet['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
      { wch: 10 },
      { wch: 6 },
      { wch: 15 },
      { wch: 12 },
    ].slice(0, resultsHeaders.length);

    XLSX.utils.book_append_sheet(wb, sampleSheet, 'Sample Info');
    XLSX.utils.book_append_sheet(wb, resultsSheet, 'Results');

    return new Blob(
      [XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
  }

  /**
   * Generate CSV export
   */
  static generateCSV(reportData: ReportData): Blob {
    const lines: string[] = [];

    // Header
    lines.push('SimpleLIMS Laboratory Report');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    // Lab Info
    lines.push('Laboratory Information');
    lines.push(`Name,${reportData.labSettings.lab_name}`);
    lines.push(`Address,${reportData.labSettings.lab_address}`);
    lines.push(`Phone,${reportData.labSettings.lab_phone}`);
    lines.push(`Email,${reportData.labSettings.lab_email}`);
    lines.push('');

    // Patient Info
    lines.push('Patient Information');
    lines.push(`Sample ID,${reportData.sample.sample_id}`);
    lines.push(`Patient Name,${reportData.sample.first_name} ${reportData.sample.last_name}`);
    lines.push(`Patient Code,${reportData.sample.patient_code}`);
    lines.push(`Date of Birth,${reportData.sample.date_of_birth}`);
    lines.push(`Gender,${reportData.sample.gender}`);
    lines.push('');

    // Results
    lines.push('Test Results');
    lines.push(
      'Test Code,Test Name,Value,Unit,Reference Range,Flag,Verified,Released'
    );

    for (const result of reportData.results) {
      const refRange =
        result.ref_range_low && result.ref_range_high
          ? `${result.ref_range_low}-${result.ref_range_high}`
          : '';
      const verified = result.verified_at ? 'Yes' : 'No';
      const released = result.released_at ? 'Yes' : 'No';

      const row = [
        this.escapeCSV(result.test_code),
        this.escapeCSV(result.test_name),
        result.value,
        result.unit || '',
        refRange,
        result.flag || '',
        verified,
        released,
      ];

      lines.push(row.join(','));
    }

    // Footer
    lines.push('');
    lines.push('---');
    if (reportData.labSettings.report_footer) {
      lines.push(reportData.labSettings.report_footer);
    }

    return new Blob([lines.join('\n')], { type: 'text/csv' });
  }

  /**
   * Private helper: Add header to PDF
   */
  private static addHeader(
    doc: jsPDF,
    reportData: ReportData,
    margin: number,
    yPos: number,
    width: number
  ): number {
    const fontSize = 14;
    const lineHeight = 8;

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.labSettings.lab_name, margin, yPos);

    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${reportData.labSettings.lab_address} | ${reportData.labSettings.lab_phone}`, margin, yPos);

    yPos += lineHeight;
    doc.text(`Email: ${reportData.labSettings.lab_email}`, margin, yPos);

    yPos += lineHeight * 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Laboratory Report', margin, yPos);

    yPos += lineHeight + 2;
    return yPos;
  }

  /**
   * Private helper: Add patient info to PDF
   */
  private static addPatientInfo(
    doc: jsPDF,
    reportData: ReportData,
    margin: number,
    yPos: number,
    width: number
  ): number {
    const fontSize = 10;
    const lineHeight = 6;

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');

    const labels = [
      `Sample ID: ${reportData.sample.sample_id}`,
      `Patient: ${reportData.sample.first_name} ${reportData.sample.last_name}`,
      `Patient Code: ${reportData.sample.patient_code}`,
      `DOB: ${reportData.sample.date_of_birth} | Gender: ${reportData.sample.gender}`,
      `Report Generated: ${new Date().toLocaleString()}`,
    ];

    for (const label of labels) {
      doc.text(label, margin, yPos);
      yPos += lineHeight;
    }

    yPos += lineHeight;
    return yPos;
  }

  /**
   * Private helper: Add results table to PDF
   */
  private static addResultsTable(
    doc: jsPDF,
    results: ReportResultItem[],
    margin: number,
    yPos: number,
    width: number,
    includeRefRange: boolean,
    includeVerification: boolean
  ): number {
    const fontSize = 9;
    const lineHeight = 6;
    const cellPadding = 2;

    // Table headers
    const headers = ['Code', 'Test Name', 'Value', 'Unit', 'Flag'];
    if (includeRefRange) headers.push('Ref Range');
    if (includeVerification) headers.push('Status');

    const columnWidths = this.calculateColumnWidths(width, headers.length);

    // Draw header row
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(200, 200, 200);

    let xPos = margin;
    for (let i = 0; i < headers.length; i++) {
      doc.rect(xPos, yPos, columnWidths[i], lineHeight + cellPadding * 2, 'F');
      doc.text(headers[i], xPos + cellPadding, yPos + lineHeight);
      xPos += columnWidths[i];
    }

    yPos += lineHeight + cellPadding * 2;
    doc.setFont('helvetica', 'normal');

    // Draw data rows
    for (const result of results) {
      // Check if we need a new page
      if (yPos + lineHeight > 280) {
        doc.addPage();
        yPos = 15;
      }

      xPos = margin;
      const cells = [
        result.test_code,
        result.test_name,
        result.value || '',
        result.unit || '',
        result.flag || '',
      ];

      if (includeRefRange) {
        const refRange =
          result.ref_range_low && result.ref_range_high
            ? `${result.ref_range_low}-${result.ref_range_high}`
            : '';
        cells.push(refRange);
      }

      if (includeVerification) {
        const status = result.verified_at ? 'V' : 'P';
        cells.push(status);
      }

      // Alternate row colors
      if (results.indexOf(result) % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        xPos = margin;
        for (let i = 0; i < headers.length; i++) {
          doc.rect(xPos, yPos, columnWidths[i], lineHeight + cellPadding * 2, 'F');
          xPos += columnWidths[i];
        }
      }

      xPos = margin;
      for (let i = 0; i < cells.length; i++) {
        const cellText = cells[i]?.toString() || '';
        const truncated = cellText.length > 15 ? cellText.substring(0, 12) + '...' : cellText;
        doc.text(truncated, xPos + cellPadding, yPos + lineHeight);
        xPos += columnWidths[i];
      }

      yPos += lineHeight + cellPadding * 2;
    }

    yPos += lineHeight;
    return yPos;
  }

  /**
   * Private helper: Add footer to PDF
   */
  private static addFooter(doc: jsPDF, reportData: ReportData, margin: number, pageHeight: number) {
    const fontSize = 8;
    const footerY = pageHeight - 10;

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'italic');

    const footerText = reportData.labSettings.report_footer || 'This is an electronically generated report.';
    doc.text(footerText, margin, footerY);

    // Page number
    doc.text(`Page ${doc.internal.pages.length}`, 210 - margin - 20, footerY);
  }

  /**
   * Private helper: Calculate column widths for PDF table
   */
  private static calculateColumnWidths(totalWidth: number, columnCount: number): number[] {
    const baseWidth = totalWidth / columnCount;
    return Array(columnCount).fill(baseWidth);
  }

  /**
   * Private helper: Escape CSV special characters
   */
  private static escapeCSV(value: string | number | undefined): string {
    if (!value) return '';
    const str = value.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Download file to user's computer
   */
  static downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Helper function to get filename with timestamp
 */
export function getReportFilename(sampleId: string, format: 'pdf' | 'xlsx' | 'csv'): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const formatMap = {
    pdf: 'pdf',
    xlsx: 'xlsx',
    csv: 'csv',
  };
  return `report_${sampleId}_${timestamp}.${formatMap[format]}`;
}
