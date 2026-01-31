import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { TestTubes, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkInit = async () => {
      if (window.electronAPI) {
        try {
          const { initialized } = await window.electronAPI.system.checkInit();
          if (!initialized) {
            navigate('/setup', { replace: true });
          }
        } catch (err) {
          console.error('Failed to check initialization status', err);
        }
      }
    };
    checkInit();
  }, [navigate]);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    const success = await login(username, password);
    setLoading(false);

    if (success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><div className="p-3 bg-primary rounded-xl"><TestTubes className="h-8 w-8 text-white" /></div></div>
          <CardTitle className="text-2xl">{t('app.name')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2"><Label>{t('auth.username')}</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('auth.placeholder.username')} required /></div>
            <div className="space-y-2">
              <Label>{t('auth.password')}</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.placeholder.password')} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" loading={loading}>{t('auth.login')}</Button>
          </form>
          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500"><p>{t('auth.footer.version')}</p><p className="mt-1">{t('auth.footer.slogan')}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
