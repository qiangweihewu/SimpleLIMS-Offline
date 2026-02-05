import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    Image, Upload, Trash2, Download, ZoomIn, Camera, X, ChevronLeft, ChevronRight
} from 'lucide-react';

interface Attachment {
    id: number;
    equipment_id?: number;
    maintenance_id?: number;
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
    caption?: string;
    created_at: string;
}

interface ImageAttachmentsProps {
    equipmentId?: number;
    maintenanceId?: number;
    readOnly?: boolean;
}

export function ImageAttachments({ equipmentId, maintenanceId, readOnly = false }: ImageAttachmentsProps) {
    const { t } = useTranslation();
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<Attachment | null>(null);
    const [showViewer, setShowViewer] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load attachments
    const loadAttachments = useCallback(async () => {
        try {
            let query = 'SELECT * FROM equipment_attachments WHERE ';
            const params: (number | undefined)[] = [];

            if (equipmentId) {
                query += 'equipment_id = ?';
                params.push(equipmentId);
            } else if (maintenanceId) {
                query += 'maintenance_id = ?';
                params.push(maintenanceId);
            } else {
                setLoading(false);
                return;
            }

            query += ' ORDER BY created_at DESC';

            const result = await window.electronAPI.db.all<Attachment>(query, params);
            setAttachments(result || []);
        } catch (err) {
            console.error('Failed to load attachments:', err);
        } finally {
            setLoading(false);
        }
    }, [equipmentId, maintenanceId]);

    // Initialize
    useState(() => {
        loadAttachments();
    });

    // Handle file selection
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error(t('attachments.invalid_type'));
                continue;
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                toast.error(t('attachments.too_large'));
                continue;
            }

            try {
                // Read file as base64
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target?.result as string;

                    // Save to app data directory
                    const timestamp = Date.now();
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileName = `attachment_${timestamp}.${ext}`;

                    // For Electron, we'd save the file using the API
                    // Here we'll store the base64 data directly for simplicity
                    const filePath = `attachments/${fileName}`;

                    await window.electronAPI.db.run(
                        `INSERT INTO equipment_attachments 
                            (equipment_id, maintenance_id, file_path, file_name, file_type, file_size, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                        [equipmentId || null, maintenanceId || null, base64, file.name, file.type, file.size]
                    );

                    toast.success(t('attachments.upload_success'));
                    loadAttachments();
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.error('Failed to upload file:', err);
                toast.error(t('attachments.upload_failed'));
            }
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Delete attachment
    const handleDelete = async (id: number) => {
        try {
            await window.electronAPI.db.run(
                'DELETE FROM equipment_attachments WHERE id = ?',
                [id]
            );
            toast.success(t('attachments.delete_success'));
            loadAttachments();
        } catch (err) {
            console.error('Failed to delete attachment:', err);
            toast.error(t('attachments.delete_failed'));
        }
    };

    // Download attachment
    const handleDownload = (attachment: Attachment) => {
        const link = document.createElement('a');
        link.href = attachment.file_path;
        link.download = attachment.file_name;
        link.click();
        toast.success(t('attachments.download_success'));
    };

    // View image in fullscreen
    const openViewer = (attachment: Attachment) => {
        setSelectedImage(attachment);
        setShowViewer(true);
    };

    // Navigate between images
    const navigateImage = (direction: 'prev' | 'next') => {
        if (!selectedImage) return;
        const currentIndex = attachments.findIndex(a => a.id === selectedImage.id);
        let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

        if (newIndex < 0) newIndex = attachments.length - 1;
        if (newIndex >= attachments.length) newIndex = 0;

        setSelectedImage(attachments[newIndex]);
    };

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (loading) {
        return <div className="text-center py-4 text-gray-500">{t('common.loading')}</div>;
    }

    return (
        <div className="space-y-4">
            {/* Upload Button */}
            {!readOnly && (
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {t('attachments.upload')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            // Capture from camera
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                                // Here you'd open a camera capture dialog
                                stream.getTracks().forEach(track => track.stop());
                                toast.info(t('attachments.camera_capture'));
                            } catch {
                                toast.error(t('attachments.camera_error'));
                            }
                        }}
                    >
                        <Camera className="h-4 w-4 mr-2" />
                        {t('attachments.capture')}
                    </Button>
                </div>
            )}

            {/* Image Grid */}
            {attachments.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('attachments.no_images')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {attachments.map(attachment => (
                        <Card
                            key={attachment.id}
                            className="group relative overflow-hidden cursor-pointer"
                            onClick={() => openViewer(attachment)}
                        >
                            <CardContent className="p-0">
                                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                                    <img
                                        src={attachment.file_path}
                                        alt={attachment.file_name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                                        }}
                                    />
                                </div>

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openViewer(attachment);
                                        }}
                                    >
                                        <ZoomIn className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(attachment);
                                        }}
                                    >
                                        <Download className="h-5 w-5" />
                                    </Button>
                                    {!readOnly && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-red-500/50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(attachment.id);
                                            }}
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>

                                {/* File info */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                    <p className="text-white text-xs truncate">{attachment.file_name}</p>
                                    <p className="text-white/70 text-xs">{formatSize(attachment.file_size)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Image Viewer Dialog */}
            <Dialog open={showViewer} onOpenChange={setShowViewer}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
                    <div className="relative bg-black">
                        {/* Close button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                            onClick={() => setShowViewer(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>

                        {/* Navigation */}
                        {attachments.length > 1 && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                                    onClick={() => navigateImage('prev')}
                                >
                                    <ChevronLeft className="h-8 w-8" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                                    onClick={() => navigateImage('next')}
                                >
                                    <ChevronRight className="h-8 w-8" />
                                </Button>
                            </>
                        )}

                        {/* Image */}
                        {selectedImage && (
                            <img
                                src={selectedImage.file_path}
                                alt={selectedImage.file_name}
                                className="max-w-full max-h-[80vh] mx-auto"
                            />
                        )}

                        {/* Image info */}
                        {selectedImage && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-white">
                                <p className="font-medium">{selectedImage.file_name}</p>
                                <p className="text-sm text-white/70">
                                    {formatSize(selectedImage.file_size)} • {new Date(selectedImage.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
