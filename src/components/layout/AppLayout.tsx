import { useState, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, TestTubes, ClipboardList, FileText, Settings, Microscope, AlertCircle, Menu, X, FlaskConical, ListChecks, LogOut, PlusCircle, MessageSquare, Power, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const navigation = [
  { key: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.new_order', href: '/orders/new', icon: PlusCircle },
  { key: 'nav.patients', href: '/patients', icon: Users },
  { key: 'nav.samples', href: '/samples', icon: TestTubes },
  { key: 'nav.worklist', href: '/worklist', icon: ListChecks },
  { key: 'nav.results', href: '/results', icon: ClipboardList },
  { key: 'nav.catalog', href: '/test-catalog', icon: FlaskConical },
  { key: 'nav.instruments', href: '/instruments', icon: Microscope },
  { key: 'nav.unmatched', href: '/unmatched', icon: AlertCircle },
  { key: 'nav.reports', href: '/reports', icon: FileText },
  { key: 'nav.settings', href: '/settings', icon: Settings },
];

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'restart' | 'quit' | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleConfirm = () => {
    if (confirmAction === 'restart') {
      (window as any).electronAPI.relaunch();
    } else if (confirmAction === 'quit') {
      (window as any).electronAPI.quit();
    }
    setConfirmAction(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn('fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <div className="flex items-center gap-2">
            <TestTubes className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">SimpleLIMS</span>
          </div>
          <button className="lg:hidden p-2 rounded-md hover:bg-gray-100" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isDashboard = item.href === '/dashboard';
            const isActive = isDashboard
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.href);

            return (
              <NavLink key={item.key} to={item.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors', isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100')} onClick={() => setSidebarOpen(false)}>
                <item.icon className="h-5 w-5" />
                {t(item.key)}
              </NavLink>
            );
          })}

          {/* Admin-only: Users Management */}

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-1">
            <NavLink to="/feedback" className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors', location.pathname === '/feedback' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100')} onClick={() => setSidebarOpen(false)}>
              <MessageSquare className="h-5 w-5" />
              {t('feedback.title')}
            </NavLink>

            <button
              onClick={() => setConfirmAction('restart')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
            >
              <RotateCcw className="h-5 w-5" />
              {t('common.restart')}
            </button>

            <button
              onClick={() => setConfirmAction('quit')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <Power className="h-5 w-5" />
              {t('common.quit')}
            </button>
          </div>
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span>{t('sidebar.instrument_connected')}</span></div>
            <div className="mt-1 text-gray-400">SimpleLIMS v0.1.0 | {t('sidebar.offline_mode')}</div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-white border-b flex items-center px-4 gap-4">
          <button className="lg:hidden p-2 rounded-md hover:bg-gray-100" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">{new Date().toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>

            {/* User Menu Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"
                title={user?.full_name}
              >
                <Users className="h-5 w-5" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b text-sm">
                    <p className="font-medium text-gray-900">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role ? t(`admin.roles.${user.role}`) : ''}</p>
                  </div>



                  <button
                    onClick={() => { logout(); navigate('/login'); setUserMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('common.logout', 'Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="p-6"><Outlet /></main>
      </div>

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'restart' ? t('common.restart') : t('common.quit')}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'restart' ? t('common.confirm_restart_msg') : t('common.confirm_quit_msg')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={confirmAction === 'quit' ? 'destructive' : 'default'}
              className={cn(confirmAction === 'restart' && 'bg-orange-600 hover:bg-orange-700')}
              onClick={handleConfirm}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
