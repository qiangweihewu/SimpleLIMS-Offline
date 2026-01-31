/**
 * Instrument Driver Manager
 * Loads, validates, and manages instrument driver configurations
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { InstrumentDriverConfig } from '../types/instrument-driver.js';
import { validateDriverConfig } from '../types/instrument-driver.js';

export class InstrumentDriverManager {
  private drivers: Map<string, InstrumentDriverConfig> = new Map();
  private driversPath: string;

  constructor() {
    // Store drivers in app data directory
    const userDataPath = app.getPath('userData');
    this.driversPath = path.join(userDataPath, 'drivers');

    // Ensure drivers directory exists
    if (!fs.existsSync(this.driversPath)) {
      fs.mkdirSync(this.driversPath, { recursive: true });
    }
  }

  /**
   * Load all driver configurations from disk
   */
  async loadDrivers(): Promise<void> {
    try {
      // Load built-in drivers first
      await this.loadBuiltInDrivers();

      // Then load custom drivers from user data
      const files = fs.readdirSync(this.driversPath);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.driversPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const config = JSON.parse(content) as InstrumentDriverConfig;

          if (validateDriverConfig(config)) {
            this.drivers.set(config.id, config);
            console.log(`[DriverManager] Loaded driver: ${config.name} (${config.id})`);
          } else {
            console.error(`[DriverManager] Invalid driver config: ${file}`);
          }
        } catch (err) {
          console.error(`[DriverManager] Error loading driver ${file}:`, err);
        }
      }

      console.log(`[DriverManager] Loaded ${this.drivers.size} driver(s)`);
    } catch (err) {
      console.error('[DriverManager] Error loading drivers:', err);
    }
  }

  /**
   * Load built-in driver configurations
   */
  private async loadBuiltInDrivers(): Promise<void> {
    // Built-in drivers are bundled with the app
    const builtInPath = path.join(__dirname, '../drivers');

    if (!fs.existsSync(builtInPath)) {
      console.warn('[DriverManager] No built-in drivers directory found');
      return;
    }

    const files = fs.readdirSync(builtInPath);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(builtInPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(content) as InstrumentDriverConfig;

        if (validateDriverConfig(config)) {
          this.drivers.set(config.id, config);
          console.log(`[DriverManager] Loaded built-in driver: ${config.name}`);
        }
      } catch (err) {
        console.error(`[DriverManager] Error loading built-in driver ${file}:`, err);
      }
    }
  }

  /**
   * Get all loaded drivers
   */
  getAllDrivers(): InstrumentDriverConfig[] {
    return Array.from(this.drivers.values());
  }

  /**
   * Get driver by ID
   */
  getDriver(id: string): InstrumentDriverConfig | undefined {
    return this.drivers.get(id);
  }

  /**
   * Get drivers by manufacturer
   */
  getDriversByManufacturer(manufacturer: string): InstrumentDriverConfig[] {
    return Array.from(this.drivers.values()).filter(
      d => d.manufacturer.toLowerCase() === manufacturer.toLowerCase()
    );
  }

  /**
   * Get drivers by category
   */
  getDriversByCategory(category: string): InstrumentDriverConfig[] {
    return Array.from(this.drivers.values()).filter(
      d => d.category === category
    );
  }

  /**
   * Save custom driver configuration
   */
  async saveDriver(config: InstrumentDriverConfig): Promise<void> {
    if (!validateDriverConfig(config)) {
      throw new Error('Invalid driver configuration');
    }

    const filePath = path.join(this.driversPath, `${config.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');

    this.drivers.set(config.id, config);
    console.log(`[DriverManager] Saved driver: ${config.name} (${config.id})`);
  }

  /**
   * Delete custom driver
   */
  async deleteDriver(id: string): Promise<void> {
    const filePath = path.join(this.driversPath, `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.drivers.delete(id);
      console.log(`[DriverManager] Deleted driver: ${id}`);
    }
  }

  /**
   * Export driver configuration to file
   */
  async exportDriver(id: string, destinationPath: string): Promise<void> {
    const driver = this.drivers.get(id);
    if (!driver) {
      throw new Error(`Driver not found: ${id}`);
    }

    fs.writeFileSync(destinationPath, JSON.stringify(driver, null, 2), 'utf-8');
    console.log(`[DriverManager] Exported driver ${id} to ${destinationPath}`);
  }

  /**
   * Import driver configuration from file
   */
  async importDriver(sourcePath: string): Promise<InstrumentDriverConfig> {
    const content = fs.readFileSync(sourcePath, 'utf-8');
    const config = JSON.parse(content) as InstrumentDriverConfig;

    if (!validateDriverConfig(config)) {
      throw new Error('Invalid driver configuration file');
    }

    await this.saveDriver(config);
    return config;
  }

  /**
   * Create driver instance from config
   * Returns configuration ready for SerialService
   */
  createDriverInstance(driverId: string, portPath?: string): any {
    const config = this.drivers.get(driverId);
    if (!config) {
      throw new Error(`Driver not found: ${driverId}`);
    }

    return {
      name: config.name,
      protocol: config.protocol,
      connection: config.connection,
      portPath: portPath || config.serialConfig?.toString(),
      baudRate: config.serialConfig?.baudRate,
      testMapping: config.testMapping,
      options: config.protocolOptions,
      dataOptions: config.dataOptions,
    };
  }
}

// Singleton instance
let instance: InstrumentDriverManager | null = null;

export function getDriverManager(): InstrumentDriverManager {
  if (!instance) {
    instance = new InstrumentDriverManager();
  }
  return instance;
}
