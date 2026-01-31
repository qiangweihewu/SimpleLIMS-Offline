import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ChevronRight, ChevronLeft, Globe, Building2, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsService } from '@/services/database.service';

export function SetupPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // State
    const [language, setLanguage] = useState(i18n.language.split('-')[0]);
    const [labInfo, setLabInfo] = useState({
        name: 'SimpleLIMS Laboratory',
        address: '',
        phone: '',
        email: ''
    });
    const [adminUser, setAdminUser] = useState({
        username: 'admin',
        fullName: 'Laboratory Administrator',
        password: '',
        confirmPassword: ''
    });

    const steps = [
        { title: 'Language', icon: Globe },
        { title: 'Lab Info', icon: Building2 },
        { title: 'Admin Account', icon: User },
        { title: 'Finish', icon: Check }
    ];

    const handleNext = async () => {
        if (step === 3) {
            if (adminUser.password !== adminUser.confirmPassword) {
                toast.error('Passwords do not match');
                return;
            }
            if (adminUser.password.length < 6) {
                toast.error('Password must be at least 6 characters');
                return;
            }
            return finishSetup();
        }
        setStep(s => s + 1);
    };

    const handleBack = () => setStep(s => s - 1);

    const finishSetup = async () => {
        setLoading(true);
        try {
            // 1. Save Language (Assume persistent)

            // 2. Save Settings
            await settingsService.set('lab_name', labInfo.name);
            await settingsService.set('lab_address', labInfo.address);
            await settingsService.set('lab_phone', labInfo.phone);
            await settingsService.set('lab_email', labInfo.email);

            // 3. Create Admin
            if (window.electronAPI) {
                const result = await window.electronAPI.system.createFirstAdmin({
                    username: adminUser.username,
                    password: adminUser.password,
                    fullName: adminUser.fullName
                });

                if (result.success) {
                    toast.success('Setup completed! Please login.');
                    navigate('/login');
                } else {
                    toast.error(result.error || 'Failed to create admin');
                }
            } else {
                toast.error('Electron API not available. Cannot create admin.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Setup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">SimpleLIMS Setup Wizard</h1>
                    <p className="mt-2 text-lg text-gray-600">Configure your laboratory system</p>
                </div>

                {/* Steps Indicator */}
                <div className="flex justify-between relative">
                    <div className="absolute top-1/2 left-0 right-0 border-t border-gray-200 -z-10" />
                    {steps.map((s, idx) => (
                        <div key={idx} className={`flex flex-col items-center bg-gray-50 px-2 ${step > idx + 1 ? 'text-green-600' : step === idx + 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === idx + 1 ? 'border-blue-600 bg-white' : step > idx + 1 ? 'border-green-600 bg-green-50' : 'border-gray-300 bg-white'}`}>
                                <s.icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs mt-1 font-medium">{s.title}</span>
                        </div>
                    ))}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{steps[step - 1].title}</CardTitle>
                        <CardDescription>Step {step} of {steps.length}</CardDescription>
                    </CardHeader>
                    <CardContent className="min-h-[300px]">
                        {step === 1 && (
                            <div className="space-y-4">
                                <Label>Select System Language</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    {['en', 'zh', 'es', 'fr', 'pt', 'ar'].map(lang => (
                                        <div
                                            key={lang}
                                            className={`p-4 border rounded-lg cursor-pointer flex items-center justify-between ${language === lang ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => {
                                                setLanguage(lang);
                                                i18n.changeLanguage(lang);
                                            }}
                                        >
                                            <span className="uppercase font-medium">{lang}</span>
                                            {language === lang && <Check className="w-4 h-4 text-blue-600" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="space-y-2"><Label>Laboratory Name</Label><Input value={labInfo.name} onChange={e => setLabInfo({ ...labInfo, name: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Address</Label><Input value={labInfo.address} onChange={e => setLabInfo({ ...labInfo, address: e.target.value })} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Phone</Label><Input value={labInfo.phone} onChange={e => setLabInfo({ ...labInfo, phone: e.target.value })} /></div>
                                    <div className="space-y-2"><Label>Email</Label><Input value={labInfo.email} onChange={e => setLabInfo({ ...labInfo, email: e.target.value })} /></div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 mb-4">
                                    Create the initial Administrator account. This account has full access to the system.
                                </div>
                                <div className="space-y-2"><Label>Username</Label><Input value={adminUser.username} onChange={e => setAdminUser({ ...adminUser, username: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Full Name</Label><Input value={adminUser.fullName} onChange={e => setAdminUser({ ...adminUser, fullName: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Password</Label><Input type="password" value={adminUser.password} onChange={e => setAdminUser({ ...adminUser, password: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" value={adminUser.confirmPassword} onChange={e => setAdminUser({ ...adminUser, confirmPassword: e.target.value })} /></div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="flex flex-col items-center justify-center space-y-4 py-8">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                    <Check className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-medium">Ready to Setup</h3>
                                <p className="text-gray-500 text-center max-w-md">
                                    We will now compile your settings and initialize the database. Click 'Finish' to start using SimpleLIMS.
                                </p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={handleBack} disabled={step === 1 || loading}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <Button onClick={handleNext} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                <>
                                    {step === 4 ? 'Finish Setup' : 'Next'}
                                    {step < 4 && <ChevronRight className="w-4 h-4 ml-2" />}
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
