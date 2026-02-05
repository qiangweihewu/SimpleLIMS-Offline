import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTranslation } from 'react-i18next';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw,
    Download, Maximize, Minimize, Loader2
} from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    filePath: string;
    fileName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ filePath, fileName, open, onOpenChange }: PDFViewerProps) {
    const { t } = useTranslation();
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [rotation, setRotation] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
        setLoading(false);
        setError(null);
    }, []);

    const onDocumentLoadError = useCallback((error: Error) => {
        console.error('PDF load error:', error);
        setError(error.message);
        setLoading(false);
    }, []);

    const goToPrevPage = () => {
        setPageNumber(prev => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber(prev => Math.min(prev + 1, numPages));
    };

    const goToPage = (page: number) => {
        const validPage = Math.min(Math.max(page, 1), numPages);
        setPageNumber(validPage);
    };

    const zoomIn = () => {
        setScale(prev => Math.min(prev + 0.25, 3.0));
    };

    const zoomOut = () => {
        setScale(prev => Math.max(prev - 0.25, 0.5));
    };

    const rotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(prev => !prev);
    };

    const downloadFile = async () => {
        try {
            // Use shell.openPath to open the file with default application
            if (window.electronAPI?.shell?.openPath) {
                await window.electronAPI.shell.openPath(filePath);
            } else {
                // Fallback: open in new tab
                window.open(`file://${filePath}`, '_blank');
            }
        } catch (err) {
            console.error('Failed to open file:', err);
        }
    };

    // Convert file path to URL for react-pdf
    const fileUrl = filePath.startsWith('file://')
        ? filePath
        : `file://${filePath}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`${isFullscreen ? 'max-w-[95vw] max-h-[95vh]' : 'max-w-4xl max-h-[85vh]'} p-0 overflow-hidden flex flex-col`}>
                <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
                    <DialogTitle className="text-base flex items-center gap-2">
                        📄 {fileName || filePath.split('/').pop() || 'PDF Document'}
                    </DialogTitle>
                </DialogHeader>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 flex-shrink-0">
                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={pageNumber <= 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                min={1}
                                max={numPages}
                                value={pageNumber}
                                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                                className="w-14 h-8 text-center"
                            />
                            <span className="text-sm text-gray-500">/ {numPages}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={goToNextPage} disabled={pageNumber >= numPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Zoom & Rotation */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.5}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm min-w-[4rem] text-center">{Math.round(scale * 100)}%</span>
                        <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 3.0}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-gray-300 mx-2" />
                        <Button variant="ghost" size="icon" onClick={rotate}>
                            <RotateCw className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={downloadFile}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* PDF Content */}
                <ScrollArea className="flex-1 bg-gray-200">
                    <div className="flex justify-center p-4 min-h-full">
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                                <p className="text-gray-600">{t('pdf.loading')}</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="text-4xl mb-4">❌</div>
                                <p className="text-red-600 font-medium mb-2">{t('pdf.load_error')}</p>
                                <p className="text-sm text-gray-500 max-w-md">{error}</p>
                                <Button variant="outline" className="mt-4" onClick={downloadFile}>
                                    <Download className="h-4 w-4 mr-2" />
                                    {t('pdf.open_external')}
                                </Button>
                            </div>
                        )}

                        {!error && (
                            <Document
                                file={fileUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={null}
                                className="shadow-lg"
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    scale={scale}
                                    rotate={rotation}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    className="bg-white"
                                    loading={
                                        <div className="flex items-center justify-center h-[600px] w-[400px] bg-white">
                                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                        </div>
                                    }
                                />
                            </Document>
                        )}
                    </div>
                </ScrollArea>

                {/* Page Thumbnails (optional mini navigator) */}
                {numPages > 1 && (
                    <div className="flex items-center justify-center gap-1 py-2 px-4 border-t bg-gray-50 flex-shrink-0 overflow-x-auto">
                        {Array.from({ length: Math.min(numPages, 10) }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${page === pageNumber
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white hover:bg-gray-100 text-gray-600 border'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                        {numPages > 10 && (
                            <span className="text-gray-400 px-2">...</span>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Simple inline PDF preview component (no dialog)
interface InlinePDFPreviewProps {
    filePath: string;
    height?: number;
}

export function InlinePDFPreview({ filePath, height = 400 }: InlinePDFPreviewProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [loading, setLoading] = useState(true);

    const fileUrl = filePath.startsWith('file://')
        ? filePath
        : `file://${filePath}`;

    return (
        <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
            <Document
                file={fileUrl}
                onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                    setLoading(false);
                }}
                onLoadError={(error) => {
                    console.error('PDF preview error:', error);
                    setLoading(false);
                }}
                loading={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                }
            >
                <Page
                    pageNumber={pageNumber}
                    height={height - 40}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                />
            </Document>
            {numPages > 1 && !loading && (
                <div className="flex items-center justify-center gap-2 py-1 bg-white border-t">
                    <Button variant="ghost" size="sm" onClick={() => setPageNumber(p => Math.max(p - 1, 1))} disabled={pageNumber <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{pageNumber} / {numPages}</span>
                    <Button variant="ghost" size="sm" onClick={() => setPageNumber(p => Math.min(p + 1, numPages))} disabled={pageNumber >= numPages}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
