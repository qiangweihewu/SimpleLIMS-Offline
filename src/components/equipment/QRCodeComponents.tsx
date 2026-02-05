import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    QrCode, Download, Printer, Camera, Server, CheckCircle
} from 'lucide-react';

interface Equipment {
    id: number;
    name: string;
    model: string;
    manufacturer: string;
    serial_number: string;
    location: string;
    status: 'operational' | 'maintenance' | 'faulty' | 'retired';
}

interface QRCodeGeneratorProps {
    equipment: Equipment;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Simple QR Code generator using canvas and a library-free approach
// In production, you might want to use qrcode library
function generateQRMatrix(data: string, size: number = 21): boolean[][] {
    // This is a simplified QR code representation
    // For actual QR codes, use a proper library like 'qrcode'
    const matrix: boolean[][] = [];
    const dataHash = Array.from(data).reduce((acc, char) => acc + char.charCodeAt(0), 0);

    for (let y = 0; y < size; y++) {
        matrix[y] = [];
        for (let x = 0; x < size; x++) {
            // Fixed patterns for QR code corners
            const isCorner = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
            const isCornerBorder = isCorner && (x === 0 || x === 6 || y === 0 || y === 6 || x === size - 7 || x === size - 1 || y === size - 7 || y === size - 1);
            const isCornerInner = isCorner && (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
                (x >= size - 5 && x <= size - 3 && y >= 2 && y <= 4) ||
                (x >= 2 && x <= 4 && y >= size - 5 && y <= size - 3);

            if (isCornerBorder || isCornerInner) {
                matrix[y][x] = true;
            } else if (isCorner) {
                matrix[y][x] = false;
            } else {
                // Data pattern based on hash
                matrix[y][x] = ((dataHash * (x + 1) * (y + 1)) % 7) > 3;
            }
        }
    }
    return matrix;
}

export function QRCodeGenerator({ equipment, open, onOpenChange }: QRCodeGeneratorProps) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    useEffect(() => {
        if (open && equipment && canvasRef.current) {
            generateQRCode();
        }
    }, [open, equipment]);

    const generateQRCode = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const qrData = JSON.stringify({
            id: equipment.id,
            name: equipment.name,
            model: equipment.model,
            manufacturer: equipment.manufacturer,
            serial_number: equipment.serial_number,
            app: 'SimpleLIMS'
        });

        const size = 256;
        const moduleSize = 8;
        const qrSize = 25; // QR code modules

        canvas.width = size;
        canvas.height = size;

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Generate QR matrix
        const matrix = generateQRMatrix(qrData, qrSize);
        const offset = (size - qrSize * moduleSize) / 2;

        // Draw QR code
        ctx.fillStyle = '#000000';
        for (let y = 0; y < qrSize; y++) {
            for (let x = 0; x < qrSize; x++) {
                if (matrix[y][x]) {
                    ctx.fillRect(
                        offset + x * moduleSize,
                        offset + y * moduleSize,
                        moduleSize,
                        moduleSize
                    );
                }
            }
        }

        // Add logo in center
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(size / 2 - 20, size / 2 - 20, 40, 40);
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 15, 0, Math.PI * 2);
        ctx.fill();

        // S letter
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', size / 2, size / 2);

        setQrDataUrl(canvas.toDataURL('image/png'));
    };

    const downloadQRCode = () => {
        if (!qrDataUrl) return;

        const link = document.createElement('a');
        link.download = `qr_${equipment.serial_number || equipment.id}_${equipment.name}.png`;
        link.href = qrDataUrl;
        link.click();
        toast.success(t('qr.download_success'));
    };

    const printQRCode = () => {
        if (!qrDataUrl) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error(t('qr.print_blocked'));
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${equipment.name} - QR Code</title>
                <style>
                    body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        font-family: system-ui, sans-serif;
                    }
                    .label {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .name { font-size: 18px; font-weight: bold; }
                    .details { font-size: 12px; color: #666; margin-top: 5px; }
                    img { width: 200px; height: 200px; }
                    .serial { font-size: 10px; margin-top: 10px; font-family: monospace; }
                    @media print {
                        body { padding: 20mm; }
                    }
                </style>
            </head>
            <body>
                <div class="label">
                    <div class="name">${equipment.name}</div>
                    <div class="details">${equipment.manufacturer} ${equipment.model}</div>
                </div>
                <img src="${qrDataUrl}" />
                <div class="serial">SN: ${equipment.serial_number || 'N/A'}</div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 200);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-blue-600" />
                        {t('qr.generate_title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center py-4 space-y-4">
                    {/* Equipment Info */}
                    <div className="text-center">
                        <h3 className="font-semibold text-lg">{equipment.name}</h3>
                        <p className="text-sm text-gray-500">
                            {equipment.manufacturer} {equipment.model}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-1">
                            SN: {equipment.serial_number || 'N/A'}
                        </p>
                    </div>

                    {/* QR Code Canvas */}
                    <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <canvas ref={canvasRef} className="w-48 h-48" />
                    </div>

                    {/* Instructions */}
                    <p className="text-xs text-gray-500 text-center max-w-xs">
                        {t('qr.scan_instructions')}
                    </p>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={downloadQRCode}>
                        <Download className="h-4 w-4 mr-2" />
                        {t('qr.download')}
                    </Button>
                    <Button onClick={printQRCode}>
                        <Printer className="h-4 w-4 mr-2" />
                        {t('qr.print')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// QR Code Scanner Component
interface QRCodeScannerProps {
    onScanned: (data: any) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function QRCodeScanner({ onScanned, open, onOpenChange }: QRCodeScannerProps) {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scannedEquipment, setScannedEquipment] = useState<Equipment | null>(null);

    useEffect(() => {
        if (open) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [open]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setScanning(true);
        } catch (err) {
            console.error('Camera access failed:', err);
            toast.error(t('qr.camera_error'));
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setScanning(false);
    };

    // Simulate QR code scanning (in production, use a proper QR scanning library)
    const simulateScan = async () => {
        // For demo purposes, we'll look up a random equipment
        try {
            const result = await window.electronAPI.db.get<Equipment>(
                'SELECT * FROM equipment LIMIT 1'
            );
            if (result) {
                setScannedEquipment(result);
                toast.success(t('qr.scan_success'));
                onScanned(result);
            } else {
                toast.warning(t('qr.no_equipment_found'));
            }
        } catch (err) {
            console.error('Scan failed:', err);
            toast.error(t('qr.scan_failed'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setScannedEquipment(null);
            }
            onOpenChange(isOpen);
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-blue-600" />
                        {t('qr.scan_title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Camera View */}
                    <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanning overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-white/50 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500" />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500" />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500" />
                                {scanning && (
                                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                                )}
                            </div>
                        </div>

                        {!stream && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                <Camera className="h-12 w-12" />
                            </div>
                        )}
                    </div>

                    {/* Scanned Equipment */}
                    {scannedEquipment && (
                        <Card className="border-green-200 bg-green-50">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{scannedEquipment.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {scannedEquipment.manufacturer} {scannedEquipment.model}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <p className="text-xs text-gray-500 text-center">
                        {t('qr.point_camera')}
                    </p>

                    {/* Demo scan button */}
                    <Button onClick={simulateScan} className="w-full" disabled={!stream}>
                        <QrCode className="h-4 w-4 mr-2" />
                        {t('qr.manual_scan')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Bulk QR Code Generator
interface BulkQRGeneratorProps {
    equipment: Equipment[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BulkQRGenerator({ equipment, open, onOpenChange }: BulkQRGeneratorProps) {
    const { t } = useTranslation();
    const [generating, setGenerating] = useState(false);

    const generateAll = async () => {
        setGenerating(true);

        // Create a printable page with all QR codes
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error(t('qr.print_blocked'));
            setGenerating(false);
            return;
        }

        const qrHtml = equipment.map(eq => `
            <div class="qr-item">
                <div class="name">${eq.name}</div>
                <div class="details">${eq.manufacturer} ${eq.model}</div>
                <div class="qr-placeholder" data-id="${eq.id}">
                    <div class="qr-box">${eq.serial_number || eq.id}</div>
                </div>
                <div class="serial">SN: ${eq.serial_number || 'N/A'}</div>
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Equipment QR Labels</title>
                <style>
                    body {
                        font-family: system-ui, sans-serif;
                        padding: 20px;
                    }
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                    }
                    .qr-item {
                        text-align: center;
                        padding: 15px;
                        border: 1px dashed #ccc;
                        break-inside: avoid;
                    }
                    .name { font-size: 12px; font-weight: bold; }
                    .details { font-size: 10px; color: #666; }
                    .qr-box {
                        width: 100px;
                        height: 100px;
                        margin: 10px auto;
                        background: linear-gradient(45deg, #000 25%, transparent 25%),
                                    linear-gradient(-45deg, #000 25%, transparent 25%),
                                    linear-gradient(45deg, transparent 75%, #000 75%),
                                    linear-gradient(-45deg, transparent 75%, #000 75%);
                        background-size: 10px 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 8px;
                        color: white;
                        text-shadow: 0 0 3px black;
                    }
                    .serial { font-size: 8px; font-family: monospace; }
                    @media print {
                        .qr-item { border: 1px solid #ddd; }
                    }
                </style>
            </head>
            <body>
                <h1 style="text-align: center; font-size: 16px; margin-bottom: 20px;">
                    Equipment QR Labels - ${new Date().toLocaleDateString()}
                </h1>
                <div class="grid">${qrHtml}</div>
            </body>
            </html>
        `);
        printWindow.document.close();

        setGenerating(false);
        toast.success(t('qr.bulk_generated', { count: equipment.length }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-blue-600" />
                        {t('qr.bulk_title')}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-gray-500 mb-4">
                        {t('qr.bulk_description', { count: equipment.length })}
                    </p>

                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                        {equipment.map(eq => (
                            <div key={eq.id} className="flex items-center gap-3 p-2 border-b last:border-b-0">
                                <Server className="h-4 w-4 text-gray-400" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{eq.name}</p>
                                    <p className="text-xs text-gray-500">{eq.manufacturer} {eq.model}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {eq.serial_number || `#${eq.id}`}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={generateAll} disabled={generating}>
                        <Printer className="h-4 w-4 mr-2" />
                        {generating ? t('common.loading') : t('qr.generate_all')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
