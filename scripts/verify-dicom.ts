
/**
 * DICOM Generation Verification Script
 * 
 * Tests the creation of a valid DICOM file using the DicomWrapper service.
 * Simulates a Phase 5 scenario: Encapsulating a captured image into DICOM.
 * 
 * Usage: npx tsx scripts/verify-dicom.ts
 */

import { dicomWrapper } from '../electron/services/dicom-wrapper';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

async function runVerification() {
    console.log("Starting DICOM Verification...");

    // 1. Setup Test Data
    const testDir = path.join(process.cwd(), 'tmp', 'dicom-test');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a dummy JPG image
    const imagePath = path.join(testDir, 'test-image.jpg');
    // Create a minimal valid JPEG (1x1 pixel white)
    const jpegBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    fs.writeFileSync(imagePath, jpegBuffer);
    console.log(`Created dummy image at ${imagePath}`);

    // Test Patient & Study
    const patient = {
        patientId: 'TEST-12345',
        name: 'Doe^John',
        dob: '19800101',
        sex: 'M'
    };

    const study = {
        studyInstanceUID: '1.2.840.10008.5.1.4.1.1.7.12345',
        accessionNumber: 'ACC-2023-001',
        studyDate: '20231027',
        modality: 'US'
    };

    try {
        // 2. Run DICOM Wrapping
        console.log("Wrapping image...");
        // Mock ffmpeg dependency or assume it's not strictly needed for the 'wrapImage' buffer read part
        // Actually DicomWrapper uses 'image-size' or ffmpeg to get dimensions.
        // The implementation details in the context showed it uses `ffmpeg` probe.
        // If ffmpeg is missing in this script's env, it might fail.
        // However, let's try calling it.

        // NOTE: The IPC handler imports the Singleton instance. 
        // We can use it directly.

        const result = await dicomWrapper.wrapImage(imagePath, patient, study);
        console.log("DICOM generation successful!");
        console.log("Generated file:", result.filePath);
        console.log("SOP Instance UID:", result.sopInstanceUID);

        // 3. Validation
        if (!fs.existsSync(result.filePath)) {
            throw new Error("Output file does not exist");
        }

        const fileSize = fs.statSync(result.filePath).size;
        console.log(`File size: ${fileSize} bytes`);

        // Basic Header Check (DICOM preamble)
        const fd = fs.openSync(result.filePath, 'r');
        const preamble = Buffer.alloc(128);
        const dicm = Buffer.alloc(4);
        fs.readSync(fd, preamble, 0, 128, 0);
        fs.readSync(fd, dicm, 0, 4, 128);
        fs.closeSync(fd);

        if (dicm.toString() !== 'DICM') {
            throw new Error("Invalid DICOM Header: Missing 'DICM' prefix");
        }
        console.log("✅ Valid DICOM Header detected.");

        console.log("Phase 5.3 Verification PASSED.");

    } catch (error) {
        console.error("Verification FAILED:", error);
        process.exit(1);
    }
}

runVerification();
