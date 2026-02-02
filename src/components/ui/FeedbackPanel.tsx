import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { MessageSquare, Send, FileDown, Wifi, WifiOff, CheckCircle2, Image as ImageIcon, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface SelectedImage {
    file: File;
    preview: string;
}

export function FeedbackPanel() {
    const { t } = useTranslation();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        type: 'bug',
        content: '',
        email: ''
    });

    const [images, setImages] = useState<SelectedImage[]>([]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            // Cleanup previews
            images.forEach(img => URL.revokeObjectURL(img.preview));
        };
    }, [images]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        const validFiles: SelectedImage[] = [];
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`${file.name}: ${t('feedback.images.limit_error')}`);
                continue;
            }
            validFiles.push({
                file,
                preview: URL.createObjectURL(file)
            });
        }

        setImages(prev => [...prev, ...validFiles]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        setImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[index].preview);
            newImages.splice(index, 1);
            return newImages;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.content) {
            toast.error(t('common.required_fields'));
            return;
        }

        setLoading(true);

        if (isOnline) {
            // Simulate API call with FormData
            try {
                // In a real app, you'd use FormData to send files
                // const formData = new FormData();
                // formData.append('content', form.content);
                // images.forEach(img => formData.append('images', img.file));

                await new Promise(resolve => setTimeout(resolve, 2000));
                toast.success(t('feedback.success'));
                setSubmitted(true);
            } catch (error) {
                toast.error(t('common.error_occurred'));
            } finally {
                setLoading(false);
            }
        } else {
            handleExportPDF();
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const margin = 20;
        let y = 20;

        doc.setFontSize(22);
        doc.text('SimpleLIMS Feedback Report', margin, y);
        y += 15;

        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleString()}`, margin, y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Feedback Type:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(t(`feedback.type.${form.type}`), margin + 40, y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Contact Email:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(form.email || 'N/A', margin + 40, y);
        y += 15;

        doc.setFont('helvetica', 'bold');
        doc.text('Description:', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');

        const lines = doc.splitTextToSize(form.content, 170);
        doc.text(lines, margin, y);
        y += lines.length * 7 + 10;

        // Add attachment reminder if images selected
        if (images.length > 0) {
            doc.setDrawColor(255, 0, 0);
            doc.setLineWidth(0.5);
            doc.setTextColor(255, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.rect(margin - 2, y - 5, 174, 15);
            doc.text('IMPORTANT ATTACHMENT REMINDER:', margin, y + 2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`User selected ${images.length} image(s). Please remember to attach them to the email manually.`, margin, y + 8);
            y += 25;
            doc.setTextColor(0, 0, 0);
        }

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Please send this PDF to support@simplelabos.com', margin, y);

        doc.save(`SimpleLIMS_Feedback_${new Date().getTime()}.pdf`);
        toast.success(t('feedback.export_success'));
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <Card className="w-full max-w-lg mx-auto border-green-100 bg-green-50/30">
                <CardContent className="pt-10 pb-10 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-green-900">{t('feedback.success')}</h3>
                    <p className="text-green-700">
                        {isOnline ? t('feedback.success') : t('feedback.export_success')}
                    </p>
                    <Button variant="outline" onClick={() => {
                        setSubmitted(false);
                        setForm({ type: 'bug', content: '', email: '' });
                        setImages([]);
                    }}>
                        {t('common.back')}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-lg mx-auto shadow-lg border-primary/10">
            <CardHeader className="bg-primary/5 border-b mb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                    <MessageSquare className="h-5 w-5" />
                    {t('feedback.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
                <div className={`p-3 rounded-lg flex items-center gap-3 text-sm ${isOnline ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                    }`}>
                    {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                    <span>{isOnline ? t('feedback.status.online') : t('feedback.status.offline')}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>{t('feedback.type.label')}</Label>
                        <Select
                            value={form.type}
                            onValueChange={(v) => setForm({ ...form, type: v })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bug">{t('feedback.type.bug')}</SelectItem>
                                <SelectItem value="feature">{t('feedback.type.feature')}</SelectItem>
                                <SelectItem value="other">{t('feedback.type.other')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('feedback.contact.label')}</Label>
                        <Input
                            type="email"
                            placeholder={t('feedback.contact.placeholder')}
                            value={form.email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('feedback.content.label')}</Label>
                        <Textarea
                            className="min-h-[120px] resize-none"
                            placeholder={t('feedback.content.placeholder')}
                            value={form.content}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, content: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('feedback.images.label')}</Label>
                        <div
                            className="border-2 border-dashed border-gray-200 rounded-lg p-4 transition-colors hover:border-primary/50 cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handleImageChange}
                            />
                            <div className="flex flex-col items-center justify-center gap-2 text-gray-500 group-hover:text-primary">
                                <ImageIcon className="h-8 w-8" />
                                <span className="text-sm">{t('feedback.images.placeholder')}</span>
                                <span className="text-xs text-gray-400">Max 10MB per image</span>
                            </div>
                        </div>

                        {images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                {images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                                        <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isOnline && images.length > 0 && (
                            <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-100 flex gap-2 items-start">
                                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-red-700 leading-tight">
                                    {t('feedback.images.offline_reminder')}
                                </p>
                            </div>
                        )}
                    </div>

                    <Button
                        type="submit"
                        className="w-full gap-2 transition-all hover:scale-[1.02]"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('common.loading')}
                            </div>
                        ) : isOnline ? (
                            <>
                                <Send className="h-4 w-4" />
                                {t('feedback.submit')}
                            </>
                        ) : (
                            <>
                                <FileDown className="h-4 w-4" />
                                {t('feedback.export')}
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
