interface Window {
    electronAPI: {
        db: {
            query: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
            run: (sql: string, params?: any[]) => Promise<{ lastInsertRowid: number | bigint; changes: number }>;
            get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
            all: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
        };
        instrument: {
            listPorts: () => Promise<any[]>;
            connect: (portPath: string, options: any) => Promise<boolean>;
            disconnect: (portPath: string, options?: any) => Promise<void>;
            getStatus: (portPath: string) => Promise<any>;
            getAllStatuses: () => Promise<any>;
            simulate: (portPath: string) => Promise<boolean>;
            onData: (callback: (data: any) => void) => () => void;
            onStatus: (callback: (status: any) => void) => () => void;
        };
        timeSync: {
            getDrift: (instrumentId: number) => Promise<number>;
            setOffset: (instrumentId: number, offsetMs: number) => Promise<void>;
            getHistory: (instrumentId: number) => Promise<any[]>;
            getSystemTime: () => Promise<Date>;
        };
        quality: {
            getMetrics: (instrumentId: number) => Promise<any>;
            getHistory: (instrumentId: number, hours: number) => Promise<any[]>;
        };
        lifecycle: {
            addEvent: (instrumentId: number, event: any) => Promise<number>;
            getHistory: (instrumentId: number) => Promise<any[]>;
            getUpcomingDueDates: (days: number) => Promise<any[]>;
        };
        maintenance: {
            evaluateHealth: (instrumentId: number) => Promise<any>;
        };
        video: {
            listDevices: () => Promise<any[]>;
            startPreview: (config: any) => Promise<string>;
            stopPreview: (devicePath: string) => Promise<void>;
            capture: (config: any, patientId?: string) => Promise<any>;
            startRecording: (config: any, patientId?: string, duration?: number) => Promise<any>;
            stopRecording: (sessionId: string) => Promise<string>;
            getCaptures: (patientId?: string) => Promise<any[]>;
        };
        dicom: {
            wrap: (imagePath: string, patient: any, study: any) => Promise<any>;
            list: (patientId?: string) => Promise<any[]>;
        };
        orthanc: {
            test: () => Promise<{ success: boolean; version?: string; error?: string }>;
            upload: (filePath: string) => Promise<any>;
            search: (query: any) => Promise<any[]>;
        };
        [key: string]: any;
    }
}
