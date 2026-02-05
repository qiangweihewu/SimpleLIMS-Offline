import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createWorker, Worker } from 'tesseract.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
    Camera, ScanText, Copy, Download, Loader2,
    Languages, ZoomIn, History, BookOpen, Save, Search, AlertTriangle
} from 'lucide-react';

interface OCRResult {
    id: string;
    text: string;
    confidence: number;
    timestamp: Date;
    imagePath?: string;
}

interface KnowledgeEntry {
    id: number;
    title: string;
    category: string;
    content?: string;
    equipment_model?: string;
}

interface OCRCaptureProps {
    onTextRecognized?: (text: string) => void;
}

export function OCRCapture({ onTextRecognized }: OCRCaptureProps) {
    const { t } = useTranslation();
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
    const [currentText, setCurrentText] = useState('');
    const [confidence, setConfidence] = useState(0);
    const [language, setLanguage] = useState<'eng' | 'chi_sim' | 'chi_tra'>('eng');
    const [progress, setProgress] = useState(0);

    // Knowledge base matching
    const [matchedEntries, setMatchedEntries] = useState<KnowledgeEntry[]>([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveFormData, setSaveFormData] = useState({
        title: '',
        category: 'error_codes',
        content: ''
    });

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);

    // Common error code patterns
    const errorPatterns = [
        /E[\-_]?\d{2,4}/gi,       // E-01, E_01, E01
        /ERR[\-_]?\d{2,4}/gi,     // ERR-01, ERR01
        /ERROR[\s:]?\d{2,4}/gi,   // ERROR 01
        /FAULT[\s:]?\d{2,4}/gi,   // FAULT 01
        /[A-Z]{2,3}[\-_]?\d{3,5}/gi, // BC-3000, HM-123
        /\d{1,2}[\-\.]\d{1,2}[\-\.]\d{1,2}/g, // Error codes like 1.2.3
    ];

    // Search knowledge base for matching entries
    const searchKnowledgeBase = useCallback(async (text: string) => {
        if (!text || text.length < 3) {
            setMatchedEntries([]);
            return;
        }

        try {
            // Extract potential error codes
            const errorCodes: string[] = [];
            for (const pattern of errorPatterns) {
                const matches = text.match(pattern);
                if (matches) {
                    errorCodes.push(...matches);
                }
            }

            // Search knowledge base
            let searchTerms = [...errorCodes];
            // Also search for any significant words (4+ chars)
            const words = text.split(/\s+/).filter(w => w.length >= 4);
            searchTerms = [...searchTerms, ...words.slice(0, 5)];

            if (searchTerms.length === 0) {
                setMatchedEntries([]);
                return;
            }

            // Build search query
            const searchQuery = searchTerms.map(term => `title LIKE '%${term}%' OR content LIKE '%${term}%'`).join(' OR ');

            const results = await window.electronAPI.db.all<KnowledgeEntry>(
                `SELECT id, title, category, content, equipment_model 
                 FROM knowledge_base 
                 WHERE ${searchQuery}
                 LIMIT 5`
            );

            setMatchedEntries(results || []);

            if (results && results.length > 0) {
                toast.info(t('ocr.kb_matches_found', { count: results.length }));
            }
        } catch (err) {
            console.error('Knowledge base search failed:', err);
        }
    }, [t]);

    // Initialize Tesseract worker
    const initWorker = async () => {
        if (workerRef.current) {
            await workerRef.current.terminate();
        }
        const worker = await createWorker(language, 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    setProgress(Math.round(m.progress * 100));
                }
            }
        });
        workerRef.current = worker;
    };

    // Load camera devices
    const loadDevices = async () => {
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
            setDevices(videoInputs);
            if (videoInputs.length > 0 && !selectedDevice) {
                setSelectedDevice(videoInputs[0].deviceId);
            }
        } catch (err) {
            console.error('Failed to load devices:', err);
            toast.error(t('ocr.device_error'));
        }
    };

    // Start camera stream
    const startStream = async () => {
        await loadDevices();
        if (!selectedDevice && devices.length === 0) return;

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            // Initialize OCR worker
            await initWorker();
        } catch (err) {
            console.error('Failed to start camera:', err);
            toast.error(t('ocr.camera_error'));
        }
    };

    // Stop camera stream
    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // Capture frame and run OCR
    const captureAndRecognize = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !workerRef.current) {
            toast.error(t('ocr.not_ready'));
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setMatchedEntries([]);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('Canvas context not available');

            // Set canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0);

            // Get image data
            const imageData = canvas.toDataURL('image/png');

            // Run OCR
            const result = await workerRef.current.recognize(imageData);

            const recognizedText = result.data.text.trim();
            const avgConfidence = result.data.confidence;

            setCurrentText(recognizedText);
            setConfidence(avgConfidence);

            // Store result
            const newResult: OCRResult = {
                id: `ocr_${Date.now()}`,
                text: recognizedText,
                confidence: avgConfidence,
                timestamp: new Date()
            };
            setOcrResults(prev => [newResult, ...prev.slice(0, 19)]);

            // Search knowledge base for matches
            if (recognizedText) {
                await searchKnowledgeBase(recognizedText);
            }

            // Callback
            if (onTextRecognized && recognizedText) {
                onTextRecognized(recognizedText);
            }

            if (recognizedText) {
                toast.success(t('ocr.recognition_success'));
            } else {
                toast.warning(t('ocr.no_text_found'));
            }
        } catch (err) {
            console.error('OCR failed:', err);
            toast.error(t('ocr.recognition_failed'));
        } finally {
            setIsProcessing(false);
            setProgress(100);
        }
    }, [onTextRecognized, searchKnowledgeBase, t]);

    // Copy text to clipboard
    const copyToClipboard = () => {
        if (currentText) {
            navigator.clipboard.writeText(currentText);
            toast.success(t('ocr.copied'));
        }
    };

    // Export results
    const exportResults = () => {
        const content = ocrResults.map(r =>
            `[${r.timestamp.toISOString()}] (${r.confidence.toFixed(1)}%)\n${r.text}\n`
        ).join('\n---\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ocr_results_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('ocr.export_success'));
    };

    // Change language and reinitialize worker
    const changeLanguage = async (lang: 'eng' | 'chi_sim' | 'chi_tra') => {
        setLanguage(lang);
        if (stream) {
            await initWorker();
        }
    };

    // Save to knowledge base
    const handleSaveToKnowledgeBase = async () => {
        if (!saveFormData.title) {
            toast.error(t('common.required_fields'));
            return;
        }

        try {
            await window.electronAPI.db.run(
                `INSERT INTO knowledge_base (title, category, content, created_at, updated_at)
                 VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
                [saveFormData.title, saveFormData.category, saveFormData.content]
            );
            toast.success(t('ocr.saved_to_kb'));
            setShowSaveDialog(false);
            setSaveFormData({ title: '', category: 'error_codes', content: '' });
        } catch (err) {
            console.error('Failed to save to knowledge base:', err);
            toast.error(t('ocr.save_failed'));
        }
    };

    // Open save dialog with pre-filled content
    const openSaveDialog = () => {
        setSaveFormData({
            title: t('ocr.ocr_result_title', { date: new Date().toLocaleDateString() }),
            category: 'error_codes',
            content: currentText
        });
        setShowSaveDialog(true);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Camera View */}
            <Card className="flex flex-col lg:col-span-2">
                <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ScanText className="h-5 w-5 text-blue-600" />
                            {t('ocr.title')}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <select
                                value={language}
                                onChange={(e) => changeLanguage(e.target.value as any)}
                                className="text-sm border rounded px-2 py-1"
                                disabled={isProcessing}
                            >
                                <option value="eng">English</option>
                                <option value="chi_sim">简体中文</option>
                                <option value="chi_tra">繁體中文</option>
                            </select>
                            <Languages className="h-4 w-4 text-gray-400" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                    {/* Video Preview */}
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {!stream && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                <Camera className="h-12 w-12 mb-2" />
                                <p>{t('ocr.camera_inactive')}</p>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                <p>{t('ocr.processing')} {progress}%</p>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap gap-2">
                        <select
                            className="flex-1 p-2 border rounded-md text-sm"
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            disabled={!!stream}
                        >
                            <option value="">{t('ocr.select_camera')}</option>
                            {devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                        </select>

                        {!stream ? (
                            <Button onClick={startStream}>
                                <Camera className="h-4 w-4 mr-2" />
                                {t('ocr.start')}
                            </Button>
                        ) : (
                            <>
                                <Button variant="destructive" onClick={stopStream}>
                                    {t('ocr.stop')}
                                </Button>
                                <Button
                                    onClick={captureAndRecognize}
                                    disabled={isProcessing}
                                    className="flex-1"
                                >
                                    <ScanText className="h-4 w-4 mr-2" />
                                    {isProcessing ? t('ocr.processing') : t('ocr.recognize')}
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Current Result */}
                    {currentText && (
                        <div className="p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{t('ocr.result')}</span>
                                <div className="flex items-center gap-2">
                                    <Badge variant={confidence > 80 ? 'default' : confidence > 50 ? 'secondary' : 'destructive'}>
                                        {confidence.toFixed(1)}%
                                    </Badge>
                                    <Button variant="ghost" size="icon" onClick={copyToClipboard} title={t('common.copy')}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={openSaveDialog} title={t('ocr.save_to_kb')}>
                                        <Save className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <pre className="text-sm whitespace-pre-wrap font-mono bg-white p-2 rounded border max-h-32 overflow-y-auto">
                                {currentText}
                            </pre>
                        </div>
                    )}

                    {/* Matched Knowledge Base Entries */}
                    {matchedEntries.length > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Search className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">
                                    {t('ocr.kb_matches')} ({matchedEntries.length})
                                </span>
                            </div>
                            <div className="space-y-2">
                                {matchedEntries.map(entry => (
                                    <div key={entry.id} className="p-2 bg-white rounded border flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-sm">{entry.title}</p>
                                            <p className="text-xs text-gray-500">
                                                {t(`equipment.knowledge.categories.${entry.category}`)}
                                                {entry.equipment_model && ` • ${entry.equipment_model}`}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                // Open knowledge base entry
                                                toast.info(t('ocr.view_kb_entry', { title: entry.title }));
                                            }}
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* History */}
            <Card>
                <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <History className="h-5 w-5" />
                            {t('ocr.history')}
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={exportResults} disabled={ocrResults.length === 0}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('ocr.export')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px]">
                        {ocrResults.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <ScanText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>{t('ocr.no_history')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {ocrResults.map(result => (
                                    <div key={result.id} className="p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500">
                                                {result.timestamp.toLocaleTimeString()}
                                            </span>
                                            <Badge variant={result.confidence > 80 ? 'default' : 'secondary'}>
                                                {result.confidence.toFixed(0)}%
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-mono whitespace-pre-wrap line-clamp-3">
                                            {result.text || <span className="text-gray-400 italic">{t('ocr.no_text')}</span>}
                                        </p>
                                        <div className="flex gap-1 mt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setCurrentText(result.text);
                                                    setConfidence(result.confidence);
                                                    searchKnowledgeBase(result.text);
                                                }}
                                            >
                                                <ZoomIn className="h-3 w-3 mr-1" />
                                                {t('ocr.view_detail')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSaveFormData({
                                                        title: t('ocr.ocr_result_title', { date: result.timestamp.toLocaleDateString() }),
                                                        category: 'error_codes',
                                                        content: result.text
                                                    });
                                                    setShowSaveDialog(true);
                                                }}
                                            >
                                                <Save className="h-3 w-3 mr-1" />
                                                {t('ocr.save_to_kb')}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Save to Knowledge Base Dialog */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            {t('ocr.save_to_kb')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.title')} *</Label>
                            <Input
                                value={saveFormData.title}
                                onChange={(e) => setSaveFormData({ ...saveFormData, title: e.target.value })}
                                placeholder={t('equipment.knowledge.form.title_placeholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.category')}</Label>
                            <select
                                className="w-full p-2 border rounded-md"
                                value={saveFormData.category}
                                onChange={(e) => setSaveFormData({ ...saveFormData, category: e.target.value })}
                            >
                                <option value="error_codes">{t('equipment.knowledge.categories.error_codes')}</option>
                                <option value="troubleshooting">{t('equipment.knowledge.categories.troubleshooting')}</option>
                                <option value="maintenance">{t('equipment.knowledge.categories.maintenance')}</option>
                                <option value="other">{t('equipment.knowledge.categories.other')}</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.content')}</Label>
                            <textarea
                                className="w-full p-2 border rounded-md h-32 font-mono text-sm"
                                value={saveFormData.content}
                                onChange={(e) => setSaveFormData({ ...saveFormData, content: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSaveToKnowledgeBase}>
                            <Save className="h-4 w-4 mr-2" />
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
