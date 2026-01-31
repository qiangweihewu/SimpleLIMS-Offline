import schedule from 'node-schedule';
import path from 'path';
import fs from 'fs';
import { getDatabase, backupDatabase } from '../database/index.js';

// Backup Service
// Handles automatic scheduled backups based on user settings

let backupJob: schedule.Job | null = null;

export const backupService = {
    // Initialize the backup service
    init() {
        this.scheduleBackup();
    },

    // Read settings and schedule the job
    scheduleBackup() {
        const db = getDatabase();

        // Get backup settings
        const enabledSetting = db.prepare("SELECT value FROM settings WHERE key = 'auto_backup_enabled'").get() as { value: string } | undefined;
        const intervalSetting = db.prepare("SELECT value FROM settings WHERE key = 'auto_backup_interval'").get() as { value: string } | undefined;
        const pathSetting = db.prepare("SELECT value FROM settings WHERE key = 'auto_backup_path'").get() as { value: string } | undefined;

        const enabled = enabledSetting?.value === 'true';
        const interval = intervalSetting?.value || 'daily'; // daily, weekly, monthly
        const backupPath = pathSetting?.value;

        // Cancel existing job
        if (backupJob) {
            backupJob.cancel();
            backupJob = null;
        }

        if (!enabled || !backupPath) {
            console.log('Automatic backup disabled or path not set.');
            return;
        }

        // Determine cron schedule
        let cron = '0 0 * * *'; // Daily at midnight
        if (interval === 'weekly') {
            cron = '0 0 * * 0'; // Weekly on Sunday midnight
        } else if (interval === 'monthly') {
            cron = '0 0 1 * *'; // Monthly on 1st at midnight
        } else if (interval === 'hourly') {
            cron = '0 * * * *'; // Hourly (for testing or aggressive backup)
        }

        console.log(`Scheduling auto-backup: ${interval} (${cron}) to ${backupPath}`);

        backupJob = schedule.scheduleJob(cron, () => {
            this.performBackup(backupPath);
        });
    },

    // Perform the actual backup
    performBackup(targetDir: string) {
        try {
            if (!fs.existsSync(targetDir)) {
                console.error(`Backup directory not found: ${targetDir}`);
                return;
            }

            const now = new Date();
            // Format: simplelims_auto_YYYY-MM-DD_HH-mm-ss.db
            const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
            const filename = `simplelims_auto_${timestamp}.db`;
            const fullPath = path.join(targetDir, filename);

            console.log(`Starting auto-backup to ${fullPath}...`);
            const success = backupDatabase(fullPath);

            if (success) {
                console.log('Auto-backup completed successfully.');
                // Update last backup time
                const db = getDatabase();
                db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup_at', ?)").run(now.toISOString());
            } else {
                console.error('Auto-backup failed.');
            }
        } catch (err) {
            console.error('Error during auto-backup:', err);
        }
    },

    // Trigger a reschedule (e.g. after settings change)
    reload() {
        this.scheduleBackup();
    },

    // Stop the backup service
    stop() {
        if (backupJob) {
            backupJob.cancel();
            backupJob = null;
        }
    }
};
