import { useTranslation } from 'react-i18next';
import { FeedbackPanel } from '@/components/ui/FeedbackPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function FeedbackPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">{t('feedback.title')}</h1>
            </div>

            <div className="max-w-4xl">
                <FeedbackPanel />
            </div>
        </div>
    );
}
