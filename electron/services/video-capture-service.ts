/**
 * Video Capture Service
 * Handles video/image capture from legacy medical imaging devices (ultrasound, X-ray)
 * via USB video capture cards using native Node.js capabilities and ffmpeg shell commands.
 *
 * Database table for captured images (add to schema.ts):
 * ```sql
 * CREATE TABLE IF NOT EXISTS captured_images (
 *   id TEXT PRIMARY KEY,
 *   path TEXT NOT NULL,
 *   patient_id TEXT,
 *   instrument_id INTEGER,
 *   captured_at TEXT NOT NULL,
 *   metadata TEXT,
 *   FOREIGN KEY (patient_id) REFERENCES patients(id),
 *   FOREIGN KEY (instrument_id) REFERENCES instruments(id)
 * );
 * CREATE INDEX IF NOT EXISTS idx_captured_images_patient ON captured_images(patient_id);
 * CREATE INDEX IF NOT EXISTS idx_captured_images_instrument ON captured_images(instrument_id);
 * ```
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../database/index.js';
import { app } from 'electron';
import { spawn, exec, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface VideoDevice {
  id: string;
  name: string;
  path: string;
  type: 'camera' | 'capture_card' | 'virtual';
  capabilities?: {
    resolutions?: string[];
    formats?: string[];
  };
}

export interface CaptureConfig {
  devicePath: string;
  resolution?: string;
  format?: string;
  quality?: number;
}

export interface CapturedImage {
  id: string;
  path: string;
  patientId?: string;
  instrumentId?: number;
  capturedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RecordingSession {
  id: string;
  devicePath: string;
  outputPath: string;
  startedAt: Date;
  status: 'recording' | 'stopped' | 'error';
}

interface PreviewProcess {
  process: ChildProcess;
  outputPath: string;
  type: 'mjpeg' | 'frames';
}

interface ActiveRecording {
  session: RecordingSession;
  process: ChildProcess;
}

export class VideoCaptureService extends EventEmitter {
  private storagePath: string;
  private previewProcesses: Map<string, PreviewProcess> = new Map();
  private activeRecordings: Map<string, ActiveRecording> = new Map();
  private ffmpegPath: string = 'ffmpeg';
  private ffmpegAvailable: boolean = false;
  private platform: NodeJS.Platform;

  constructor() {
    super();
    this.platform = process.platform;
    this.storagePath = path.join(app.getPath('userData'), 'captures');
    this.ensureStorageDirectory();
    this.checkFfmpegAvailability();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private checkFfmpegAvailability(): void {
    exec('ffmpeg -version', (error) => {
      this.ffmpegAvailable = !error;
      if (!this.ffmpegAvailable) {
        console.warn('ffmpeg not found in PATH. Video capture features will be limited.');
      } else {
        console.log('ffmpeg detected and available for video capture.');
      }
    });
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  setStoragePath(newPath: string): void {
    this.storagePath = newPath;
    this.ensureStorageDirectory();
  }

  async listDevices(): Promise<VideoDevice[]> {
    switch (this.platform) {
      case 'linux':
        return this.listDevicesLinux();
      case 'darwin':
        return this.listDevicesMacOS();
      case 'win32':
        return this.listDevicesWindows();
      default:
        console.warn(`Unsupported platform: ${this.platform}`);
        return [];
    }
  }

  private async listDevicesLinux(): Promise<VideoDevice[]> {
    const devices: VideoDevice[] = [];

    try {
      const videoDevices = fs.readdirSync('/dev').filter(f => f.startsWith('video'));

      for (const dev of videoDevices) {
        const devicePath = `/dev/${dev}`;
        const device = await this.getDeviceInfoLinux(devicePath);
        if (device) {
          devices.push(device);
        }
      }
    } catch (error) {
      console.error('Error listing Linux video devices:', error);
    }

    return devices;
  }

  private getDeviceInfoLinux(devicePath: string): Promise<VideoDevice | null> {
    return new Promise((resolve) => {
      exec(`v4l2-ctl --device=${devicePath} --all`, (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const nameMatch = stdout.match(/Card name\s*:\s*(.+)/);
        const name = nameMatch ? nameMatch[1].trim() : path.basename(devicePath);

        const type = this.inferDeviceType(name);

        const resolutions: string[] = [];
        const formats: string[] = [];

        exec(`v4l2-ctl --device=${devicePath} --list-formats-ext`, (err, fmtStdout) => {
          if (!err) {
            const fmtRegex = /\[(\d+)\]:\s+'(\w+)'/g;
            let fmtMatch: RegExpExecArray | null;
            while ((fmtMatch = fmtRegex.exec(fmtStdout)) !== null) {
              formats.push(fmtMatch[2]);
            }

            const resRegex = /Size:\s+Discrete\s+(\d+x\d+)/g;
            let resMatch: RegExpExecArray | null;
            while ((resMatch = resRegex.exec(fmtStdout)) !== null) {
              if (!resolutions.includes(resMatch[1])) {
                resolutions.push(resMatch[1]);
              }
            }
          }

          resolve({
            id: devicePath.replace(/\//g, '_'),
            name,
            path: devicePath,
            type,
            capabilities: {
              resolutions: resolutions.length > 0 ? resolutions : undefined,
              formats: formats.length > 0 ? formats : undefined,
            },
          });
        });
      });
    });
  }

  private async listDevicesMacOS(): Promise<VideoDevice[]> {
    return new Promise((resolve) => {
      exec('system_profiler SPCameraDataType -json', (error, stdout) => {
        const devices: VideoDevice[] = [];

        if (error) {
          console.error('Error listing macOS cameras:', error);
          resolve(devices);
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const cameras = data.SPCameraDataType || [];

          for (const cam of cameras) {
            const name = cam._name || 'Unknown Camera';
            devices.push({
              id: cam._name?.replace(/\s+/g, '_') || randomUUID(),
              name,
              path: cam._name || '0',
              type: this.inferDeviceType(name),
              capabilities: {
                resolutions: ['1920x1080', '1280x720', '640x480'],
                formats: ['mjpeg', 'yuyv'],
              },
            });
          }
        } catch (parseError) {
          console.error('Error parsing macOS camera data:', parseError);
        }

        if (this.ffmpegAvailable) {
          exec('ffmpeg -f avfoundation -list_devices true -i "" 2>&1', (_, ffmpegStdout) => {
            const lines = ffmpegStdout.split('\n');
            let inVideoSection = false;

            for (const line of lines) {
              if (line.includes('AVFoundation video devices')) {
                inVideoSection = true;
                continue;
              }
              if (line.includes('AVFoundation audio devices')) {
                inVideoSection = false;
                continue;
              }
              if (inVideoSection) {
                const match = line.match(/\[(\d+)\]\s+(.+)/);
                if (match) {
                  const [, idx, name] = match;
                  const existingDevice = devices.find(d => d.name === name.trim());
                  if (!existingDevice) {
                    devices.push({
                      id: `avf_${idx}`,
                      name: name.trim(),
                      path: idx,
                      type: this.inferDeviceType(name),
                      capabilities: {
                        resolutions: ['1920x1080', '1280x720', '640x480'],
                        formats: ['mjpeg', 'yuyv'],
                      },
                    });
                  }
                }
              }
            }

            resolve(devices);
          });
        } else {
          resolve(devices);
        }
      });
    });
  }

  private async listDevicesWindows(): Promise<VideoDevice[]> {
    return new Promise((resolve) => {
      if (!this.ffmpegAvailable) {
        resolve([]);
        return;
      }

      exec('ffmpeg -f dshow -list_devices true -i dummy 2>&1', (_, stdout) => {
        const devices: VideoDevice[] = [];
        const lines = stdout.split('\n');
        let inVideoSection = false;

        for (const line of lines) {
          if (line.includes('DirectShow video devices')) {
            inVideoSection = true;
            continue;
          }
          if (line.includes('DirectShow audio devices')) {
            inVideoSection = false;
            continue;
          }
          if (inVideoSection) {
            const match = line.match(/\[dshow.*\]\s+"(.+)"/);
            if (match) {
              const name = match[1];
              devices.push({
                id: name.replace(/\s+/g, '_'),
                name,
                path: name,
                type: this.inferDeviceType(name),
                capabilities: {
                  resolutions: ['1920x1080', '1280x720', '640x480'],
                  formats: ['mjpeg', 'yuyv'],
                },
              });
            }
          }
        }

        resolve(devices);
      });
    });
  }

  private inferDeviceType(name: string): 'camera' | 'capture_card' | 'virtual' {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('virtual') || lowerName.includes('obs') || lowerName.includes('snap')) {
      return 'virtual';
    }
    if (
      lowerName.includes('capture') ||
      lowerName.includes('elgato') ||
      lowerName.includes('avermedia') ||
      lowerName.includes('magewell') ||
      lowerName.includes('blackmagic') ||
      lowerName.includes('usb') ||
      lowerName.includes('grabber')
    ) {
      return 'capture_card';
    }
    return 'camera';
  }

  async startPreview(config: CaptureConfig): Promise<string> {
    if (!this.ffmpegAvailable) {
      throw new Error('ffmpeg is not available. Cannot start preview.');
    }

    const existingPreview = this.previewProcesses.get(config.devicePath);
    if (existingPreview) {
      return existingPreview.outputPath;
    }

    const previewDir = path.join(this.storagePath, 'preview');
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    const outputPath = path.join(previewDir, `preview_${Date.now()}.mjpeg`);
    const args = this.buildFfmpegPreviewArgs(config, outputPath);

    const ffmpegProcess = spawn(this.ffmpegPath, args);

    ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('error') || msg.includes('Error')) {
        console.error('ffmpeg preview error:', msg);
        this.emit('previewError', { devicePath: config.devicePath, error: msg });
      }
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`Preview process for ${config.devicePath} exited with code ${code}`);
      this.previewProcesses.delete(config.devicePath);
      this.emit('previewStopped', { devicePath: config.devicePath });
    });

    this.previewProcesses.set(config.devicePath, {
      process: ffmpegProcess,
      outputPath,
      type: 'mjpeg',
    });

    this.emit('previewStarted', { devicePath: config.devicePath, outputPath });
    return outputPath;
  }

  private buildFfmpegPreviewArgs(config: CaptureConfig, outputPath: string): string[] {
    const args: string[] = ['-y'];

    switch (this.platform) {
      case 'linux':
        args.push('-f', 'v4l2');
        if (config.format) {
          args.push('-input_format', config.format);
        }
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-i', config.devicePath);
        break;

      case 'darwin':
        args.push('-f', 'avfoundation');
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-framerate', '30');
        args.push('-i', `${config.devicePath}:none`);
        break;

      case 'win32':
        args.push('-f', 'dshow');
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-i', `video=${config.devicePath}`);
        break;
    }

    args.push('-c:v', 'mjpeg');
    args.push('-q:v', String(config.quality || 5));
    args.push('-f', 'mjpeg');
    args.push(outputPath);

    return args;
  }

  stopPreview(devicePath: string): void {
    const preview = this.previewProcesses.get(devicePath);
    if (preview) {
      preview.process.kill('SIGTERM');
      this.previewProcesses.delete(devicePath);
      this.emit('previewStopped', { devicePath });
    }
  }

  async captureFrame(config: CaptureConfig, patientId?: string): Promise<CapturedImage> {
    if (!this.ffmpegAvailable) {
      throw new Error('ffmpeg is not available. Cannot capture frame.');
    }

    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const fileName = `capture_${id}.jpg`;
    const filePath = path.join(this.storagePath, fileName);

    const args = this.buildFfmpegCaptureArgs(config, filePath);

    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn(this.ffmpegPath, args);
      let errorOutput = '';

      ffmpegProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Frame capture failed with code ${code}: ${errorOutput}`));
          return;
        }

        if (!fs.existsSync(filePath)) {
          reject(new Error('Captured file was not created'));
          return;
        }

        const capturedImage: CapturedImage = {
          id,
          path: filePath,
          patientId,
          capturedAt: timestamp,
          metadata: {
            resolution: config.resolution,
            format: config.format,
            quality: config.quality,
            devicePath: config.devicePath,
          },
        };

        this.saveCaptureToDatabase(capturedImage);
        this.emit('frameCaptured', capturedImage);
        resolve(capturedImage);
      });
    });
  }

  private buildFfmpegCaptureArgs(config: CaptureConfig, outputPath: string): string[] {
    const args: string[] = ['-y'];

    switch (this.platform) {
      case 'linux':
        args.push('-f', 'v4l2');
        if (config.format) {
          args.push('-input_format', config.format);
        }
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-i', config.devicePath);
        break;

      case 'darwin':
        args.push('-f', 'avfoundation');
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-framerate', '30');
        args.push('-i', `${config.devicePath}:none`);
        break;

      case 'win32':
        args.push('-f', 'dshow');
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-i', `video=${config.devicePath}`);
        break;
    }

    args.push('-frames:v', '1');
    args.push('-q:v', String(Math.max(1, Math.min(31, 32 - (config.quality || 85) / 3))));
    args.push(outputPath);

    return args;
  }

  async startRecording(
    config: CaptureConfig,
    patientId?: string,
    maxDurationSec?: number
  ): Promise<RecordingSession> {
    if (!this.ffmpegAvailable) {
      throw new Error('ffmpeg is not available. Cannot start recording.');
    }

    const existingRecording = this.activeRecordings.get(config.devicePath);
    if (existingRecording) {
      throw new Error(`Recording already in progress for device ${config.devicePath}`);
    }

    const id = randomUUID();
    const timestamp = new Date();
    const fileName = `recording_${id}.mp4`;
    const outputPath = path.join(this.storagePath, fileName);

    const args = this.buildFfmpegRecordingArgs(config, outputPath, maxDurationSec);

    const ffmpegProcess = spawn(this.ffmpegPath, args);
    let errorOutput = '';
    let stdoutOutput = '';

    ffmpegProcess.stdout.on('data', (data) => {
      stdoutOutput += data.toString();
      console.log('ffmpeg stdout:', data.toString());
    });

    ffmpegProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      const msg = data.toString();
      // ffmpeg outputs progress info to stderr, so don't treat everything as error
      if (msg.includes('error') || msg.includes('Error') || msg.includes('Invalid')) {
        console.error('ffmpeg recording error:', msg);
      } else {
        // Progress info
        console.log('ffmpeg recording progress:', msg);
      }
    });

    const session: RecordingSession = {
      id,
      devicePath: config.devicePath,
      outputPath,
      startedAt: timestamp,
      status: 'recording',
    };

    ffmpegProcess.on('close', (code) => {
      console.log(`Recording process exited with code ${code}`);
      console.log('Output file:', outputPath);
      console.log('File exists:', fs.existsSync(outputPath));

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log('File size:', stats.size, 'bytes');
      }

      const recording = this.activeRecordings.get(config.devicePath);
      if (recording) {
        recording.session.status = code === 0 ? 'stopped' : 'error';
        this.activeRecordings.delete(config.devicePath);

        if (code === 0 && fs.existsSync(outputPath)) {
          const capturedImage: CapturedImage = {
            id,
            path: outputPath,
            patientId,
            capturedAt: timestamp.toISOString(),
            metadata: {
              type: 'video',
              duration: maxDurationSec,
              resolution: config.resolution,
              devicePath: config.devicePath,
            },
          };
          this.saveCaptureToDatabase(capturedImage);
          this.emit('recordingCompleted', capturedImage);
        } else if (code !== 0) {
          console.error('Recording failed with error output:', errorOutput);
        }

        this.emit('recordingStopped', { session: recording.session, code });
      }
    });

    this.activeRecordings.set(config.devicePath, {
      session,
      process: ffmpegProcess,
    });

    this.emit('recordingStarted', session);
    return session;
  }

  async saveWebRecording(buffer: ArrayBuffer, patientId?: string, format: string = 'webm'): Promise<CapturedImage> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const fileName = `recording_${id}.${format}`;
    const filePath = path.join(this.storagePath, fileName);

    const fs = await import('fs/promises');
    await fs.writeFile(filePath, Buffer.from(buffer));

    const capturedImage: CapturedImage = {
      id,
      path: filePath,
      patientId,
      capturedAt: timestamp,
      metadata: {
        type: 'video',
        source: 'web_recorder',
        format
      },
    };

    this.saveCaptureToDatabase(capturedImage);
    this.emit('recordingCompleted', capturedImage);

    return capturedImage;
  }

  private buildFfmpegRecordingArgs(
    config: CaptureConfig,
    outputPath: string,
    maxDurationSec?: number
  ): string[] {
    const args: string[] = ['-y'];

    switch (this.platform) {
      case 'linux':
        args.push('-f', 'v4l2');
        if (config.format) {
          args.push('-input_format', config.format);
        }
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-i', config.devicePath);
        break;

      case 'darwin':
        args.push('-f', 'avfoundation');
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-framerate', '30');
        args.push('-i', `${config.devicePath}:none`);
        break;

      case 'win32':
        args.push('-f', 'dshow');
        if (config.resolution) {
          args.push('-video_size', config.resolution);
        }
        args.push('-i', `video=${config.devicePath}`);
        break;
    }

    if (maxDurationSec) {
      args.push('-t', String(maxDurationSec));
    }

    // Use H.264 with web-compatible settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'ultrafast'); // Faster encoding for real-time
    args.push('-tune', 'zerolatency'); // Optimize for low latency
    args.push('-crf', '23');
    args.push('-pix_fmt', 'yuv420p'); // Required for browser compatibility
    args.push('-movflags', '+faststart'); // Enable streaming/progressive download
    args.push('-profile:v', 'baseline'); // Maximum compatibility
    args.push('-level', '3.0'); // Compatible with most devices
    args.push(outputPath);

    return args;
  }

  async stopRecording(sessionId: string): Promise<string> {
    const entries = Array.from(this.activeRecordings.entries());
    for (const [devicePath, recording] of entries) {
      if (recording.session.id === sessionId) {
        return new Promise((resolve, reject) => {
          recording.process.once('close', (code) => {
            console.log('Recording stopped, exit code:', code);

            if (fs.existsSync(recording.session.outputPath)) {
              const stats = fs.statSync(recording.session.outputPath);
              console.log('Recording file size:', stats.size, 'bytes');

              if (stats.size === 0) {
                reject(new Error('Recording file is empty'));
                return;
              }

              // Give the file system a moment to finish writing
              setTimeout(() => {
                resolve(recording.session.outputPath);
              }, 500);
            } else {
              reject(new Error('Recording file was not created'));
            }
          });

          // Send 'q' command to ffmpeg for graceful shutdown
          try {
            recording.process.stdin?.write('q');
          } catch (e) {
            console.error('Failed to send quit command to ffmpeg:', e);
          }

          // Fallback: force kill after timeout
          setTimeout(() => {
            if (this.activeRecordings.has(devicePath)) {
              console.warn('Force killing recording process after timeout');
              recording.process.kill('SIGTERM');
            }
          }, 3000);
        });
      }
    }

    throw new Error(`Recording session ${sessionId} not found`);
  }

  private saveCaptureToDatabase(capture: CapturedImage): void {
    try {
      const db = getDatabase();
      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='captured_images'")
        .get();

      if (!tableExists) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS captured_images (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            patient_id TEXT,
            instrument_id INTEGER,
            captured_at TEXT NOT NULL,
            metadata TEXT
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_captured_images_patient ON captured_images(patient_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_captured_images_instrument ON captured_images(instrument_id)');
      }

      db.prepare(`
        INSERT INTO captured_images (id, path, patient_id, instrument_id, captured_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        capture.id,
        capture.path,
        capture.patientId || null,
        capture.instrumentId || null,
        capture.capturedAt,
        capture.metadata ? JSON.stringify(capture.metadata) : null
      );
    } catch (error) {
      console.error('Error saving capture to database:', error);
    }
  }

  getCaptures(patientId?: string): CapturedImage[] {
    try {
      const db = getDatabase();
      const tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='captured_images'")
        .get();

      if (!tableExists) {
        return [];
      }

      let sql = 'SELECT * FROM captured_images';
      const params: string[] = [];

      if (patientId) {
        sql += ' WHERE patient_id = ?';
        params.push(patientId);
      }

      sql += ' ORDER BY captured_at DESC';

      interface CapturedImageRow {
        id: string;
        path: string;
        patient_id: string | null;
        instrument_id: number | null;
        captured_at: string;
        metadata: string | null;
      }

      const rows = db.prepare(sql).all(...params) as CapturedImageRow[];

      return rows.map((row) => ({
        id: row.id,
        path: row.path,
        patientId: row.patient_id,
        instrumentId: row.instrument_id,
        capturedAt: row.captured_at,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error('Error fetching captures from database:', error);
      return [];
    }
  }

  getRecordingStatus(sessionId: string): RecordingSession | null {
    const recordings = Array.from(this.activeRecordings.values());
    for (const recording of recordings) {
      if (recording.session.id === sessionId) {
        return recording.session;
      }
    }
    return null;
  }

  async cleanup(): Promise<void> {
    const previewDevicePaths = Array.from(this.previewProcesses.keys());
    for (const devicePath of previewDevicePaths) {
      this.stopPreview(devicePath);
    }

    const recordingEntries = Array.from(this.activeRecordings.entries());
    for (const [, recording] of recordingEntries) {
      try {
        await this.stopRecording(recording.session.id);
      } catch (error) {
        console.error('Error stopping recording during cleanup:', error);
        recording.process.kill('SIGKILL');
      }
    }

    this.previewProcesses.clear();
    this.activeRecordings.clear();
  }
}

export const videoCaptureService = new VideoCaptureService();
