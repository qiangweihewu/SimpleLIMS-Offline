import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
    id: number;
    user_id: number | null;
    username: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    old_value: string | null; // JSON string
    new_value: string | null; // JSON string
    ip_address: string | null;
    created_at: string;
}

export function AuditLogPage() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        action: '',
        entityType: ''
    });

    useEffect(() => {
        loadLogs();
    }, [page, filters, currentUser?.role]);

    const loadLogs = async () => {
        if (!window.electronAPI || !currentUser) return;
        setLoading(true);
        try {
            const result = await window.electronAPI.audit.getLogs(currentUser.role, {
                page,
                pageSize: 20,
                filters
            });
            setLogs(result.logs || []);
            setTotalPages(result.totalPages || 1);
        } catch (err) {
            console.error('Failed to load audit logs:', err);
            toast.error('Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        // Simple CSV export of current view (or fetch all if needed)
        // For now, export current data
        const headers = ['ID', 'Time', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'];
        const rows = logs.map(log => [
            log.id,
            log.created_at,
            log.username || 'System',
            log.action,
            log.entity_type,
            log.entity_id || '-',
            `New: ${log.new_value || '-'} | Old: ${log.old_value || '-'}`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!currentUser || currentUser.role !== 'admin') {
        return <div className="p-8 text-center text-red-500">Access Denied: Admins Only</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
                    <p className="text-gray-500">Track system activities and security events</p>
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <CardTitle>System Activities</CardTitle>
                            <CardDescription>Recent actions performed by users</CardDescription>
                        </div>

                        {/* Filters */}
                        <select
                            className="h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={filters.action}
                            onChange={e => {
                                setFilters({ ...filters, action: e.target.value });
                                setPage(1);
                            }}
                        >
                            <option value="">All Actions</option>
                            <option value="login">Login</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="verify">Verify</option>
                        </select>

                        <select
                            className="h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={filters.entityType}
                            onChange={e => {
                                setFilters({ ...filters, entityType: e.target.value });
                                setPage(1);
                            }}
                        >
                            <option value="">All Entities</option>
                            <option value="user">User</option>
                            <option value="patient">Patient</option>
                            <option value="sample">Sample</option>
                            <option value="result">Result</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                            No logs found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {log.username || <span className="text-gray-400 italic">System</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    log.action === 'delete' ? 'text-red-600 border-red-200' :
                                                        log.action === 'create' ? 'text-green-600 border-green-200' :
                                                            log.action === 'login' ? 'text-blue-600 border-blue-200' : ''
                                                }>
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{log.entity_type}</span>
                                                    <span className="text-xs text-gray-400">#{log.entity_id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[300px] truncate text-xs text-gray-600 font-mono">
                                                {log.new_value ? (
                                                    <span title={log.new_value}>New: {log.new_value}</span>
                                                ) : log.old_value ? (
                                                    <span title={log.old_value}>Old: {log.old_value}</span>
                                                ) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
