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
            onData: (callback: (data: any) => void) => void;
            onStatus: (callback: (status: any) => void) => () => void;
        };
        [key: string]: any;
    }
}
