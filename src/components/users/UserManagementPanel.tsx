import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, User } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Edit2, Ban, CheckCircle, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

export function UserManagementPanel() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'technician'
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        if (!window.electronAPI || !currentUser) return;
        setLoading(true);
        try {
            const data = await window.electronAPI.user.getAll(currentUser.role);
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(t('common.error_occurred'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingUser(null);
        setFormData({ username: '', password: '', full_name: '', role: 'technician' });
        setIsDialogOpen(true);
    };

    const handleEdit = (u: User) => {
        setEditingUser(u);
        setFormData({ username: u.username, password: '', full_name: u.full_name, role: u.role });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.username || !formData.full_name) {
            toast.error(t('admin.messages.fill_required'));
            return;
        }
        if (!editingUser && !formData.password) {
            toast.error(t('admin.messages.password_required'));
            return;
        }
        if (!currentUser) return;

        try {
            if (editingUser) {
                const res = await window.electronAPI.user.update(currentUser.role, { ...formData, id: editingUser.id });
                if (res.success) {
                    toast.success(t('admin.messages.update_success'));
                    loadUsers();
                    setIsDialogOpen(false);
                } else {
                    toast.error(res.error || t('admin.messages.update_failed'));
                }
            } else {
                const res = await window.electronAPI.user.create(currentUser.role, formData);
                if (res.success) {
                    toast.success(t('admin.messages.create_success'));
                    loadUsers();
                    setIsDialogOpen(false);
                } else {
                    toast.error(res.error || t('admin.messages.create_failed'));
                }
            }
        } catch (err) {
            console.error(err);
            toast.error(t('common.error_occurred'));
        }
    };

    const handleToggleActive = async (u: any) => {
        if (!currentUser) return;
        try {
            const res = await window.electronAPI.user.toggleActive(currentUser.role, u.id, !u.is_active);
            if (res.success) {
                loadUsers();
                toast.success(t(u.is_active ? 'admin.messages.status_disabled' : 'admin.messages.status_enabled'));
            } else {
                toast.error(res.error);
            }
        } catch (err) {
            toast.error(t('admin.messages.toggle_failed'));
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('admin.messages.delete_confirm'))) return;
        if (!currentUser) return;
        try {
            const res = await window.electronAPI.user.delete(currentUser.role, id);
            if (res.success) {
                loadUsers();
                toast.success(t('admin.messages.delete_success'));
            } else {
                toast.error(res.error);
            }
        } catch (err) {
            toast.error(t('admin.messages.delete_failed'));
        }
    };

    if (currentUser?.role !== 'admin') {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="h-6 w-6" />
                        <div>
                            <CardTitle>{t('admin.users.title')}</CardTitle>
                            <CardDescription>{t('admin.users.description')}</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('admin.users.add_user')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('admin.users.username')}</TableHead>
                                <TableHead>{t('admin.users.full_name')}</TableHead>
                                <TableHead>{t('admin.users.role')}</TableHead>
                                <TableHead>{t('admin.users.status')}</TableHead>
                                <TableHead className="text-right">{t('admin.actions.title')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u: any) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.username}</TableCell>
                                    <TableCell>{u.full_name}</TableCell>
                                    <TableCell>
                                        <Badge variant={u.role === 'admin' ? 'default' : u.role === 'technician' ? 'secondary' : 'outline'}>
                                            {t(`admin.roles.${u.role}`)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={u.is_active ? 'default' : 'destructive'}>
                                            {u.is_active ? t('admin.status.active') : t('admin.status.inactive')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(u)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            {u.id !== 1 && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleToggleActive(u)}
                                                    >
                                                        {u.is_active ? <Ban className="h-4 w-4 text-orange-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(u.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                {/* User Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogTitle>
                            {editingUser ? t('admin.users.edit_user') : t('admin.users.add_user')}
                        </DialogTitle>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>{t('admin.users.username')}</Label>
                                <Input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    disabled={!!editingUser}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.users.password')} {editingUser && `(${t('admin.users.leave_blank')})`}</Label>
                                <Input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.users.full_name')}</Label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('admin.users.role')}</Label>
                                <select
                                    className="w-full border rounded-md p-2"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    disabled={editingUser?.id === 1}
                                >
                                    <option value="admin">{t('admin.roles.admin')}</option>
                                    <option value="technician">{t('admin.roles.technician')}</option>
                                    <option value="viewer">{t('admin.roles.viewer')}</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSave}>
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
