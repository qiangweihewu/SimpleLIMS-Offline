import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface User {
    id: number;
    username: string;
    full_name: string;
    role: 'admin' | 'technician' | 'viewer';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Load persisted user from localStorage
        const saved = localStorage.getItem('lims_user');
        if (saved) {
            try {
                setUser(JSON.parse(saved));
            } catch (e) {
                localStorage.removeItem('lims_user');
            }
        }
    }, []);

    const login = async (username: string, password: string) => {
        if (!window.electronAPI) {
            toast.error('Application not running in Electron environment');
            return false;
        }

        try {
            const result = await window.electronAPI.auth.login({ username, password });
            if (result.success && result.user) {
                setUser(result.user);
                localStorage.setItem('lims_user', JSON.stringify(result.user));
                toast.success('Login successful');
                return true;
            } else {
                toast.error(result.error ? `Login failed: ${result.error}` : 'Invalid credentials');
                return false;
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred during login');
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('lims_user');
        toast.info('Logged out');
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
