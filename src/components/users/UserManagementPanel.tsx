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
        if (!window.electronAPI) return;
        setLoading(true);
        try {
            const data = await window.electronAPI.user.getAll();
            setUsers(data);
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

        try {
            if (editingUser) {
                const res = await window.electronAPI.user.update({ ...formData, id: editingUser.id });
                if (res.success) {
                    toast.success(t('admin.messages.update_success'));
                    loadUsers();
                    setIsDialogOpen(false);
                } else {
                    toast.error(res.error || t('admin.messages.update_failed'));
                }
            } else {
                const res = await window.electronAPI.user.create(formData);
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
        try {
            const res = await window.electronAPI.user.toggleActive(u.id, !u.is_active);
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
        try {
            const res = await window.electronAPI.user.delete(id);
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
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <div>
                            <CardTitle>{t('admin.user_management')}</CardTitle>
                            <CardDescription>{t('admin.user_management_subtitle')}</CardDescription>
                        </div>
                    </div>
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('admin.add_user_btn')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40%] px-2 h-9 text-xs">{t('admin.users.username', 'User')}</TableHead>
                                    <TableHead className="w-[30%] px-2 h-9 text-xs">{t('admin.users.role', 'Role')}</TableHead>
                                    <TableHead className="w-[30%] px-2 h-9 text-right text-xs">{t('admin.actions.title', 'Actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u: any) => (
                                    <TableRow key={u.id} className="h-10">
                                        <TableCell className="px-2 py-1 font-medium text-xs">
                                            <div className="flex flex-col">
                                                <span className="truncate max-w-[120px]" title={u.username}>{u.username}</span>
                                                {u.id === currentUser?.id && <span className="text-[10px] text-blue-600 font-normal">{t('admin.users.you')}</span>}
                                                {!u.is_active && <span className="text-[10px] text-red-500 font-normal">{t('admin.users.disabled')}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-2 py-1">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-normal capitalize cursor-default">
                                                {u.role === 'admin' ? 'Admin' : (u.role === 'technician' ? 'Tech' : 'View')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-2 py-1 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(u)} title={t('admin.actions.edit')}>
                                                    <Edit2 className="h-3 w-3 text-gray-500" />
                                                </Button>
                                                {u.id !== 1 && (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleToggleActive(u)} title={u.is_active ? t('admin.actions.disable') : t('admin.actions.enable')}>
                                                            {u.is_active ? <Ban className="h-3 w-3 text-orange-500" /> : <CheckCircle className="h-3 w-3 text-green-600" />}
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(u.id)} title={t('admin.actions.delete')}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="p-0 overflow-hidden border border-gray-200 bg-white shadow-lg sm:max-w-[500px]">
                    <div className="bg-primary px-6 py-4">
                        <DialogTitle className="text-xl font-bold text-white">
                            {t(editingUser ? 'admin.dialog.edit_title' : 'admin.dialog.create_title')}
                        </DialogTitle>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-700">{t('admin.form.username')}</Label>
                            <Input
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                disabled={!!editingUser}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-700">{t('admin.form.full_name')}</Label>
                            <Input
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-700">{t('admin.form.role')}</Label>
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="admin">{t('admin.roles.admin')}</option>
                                <option value="technician">{t('admin.roles.technician')}</option>
                                <option value="viewer">{t('admin.roles.viewer')}</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-700">{t(editingUser ? 'admin.form.new_password' : 'admin.form.password')}</Label>
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-gray-100 flex gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleSave}>{t('common.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
