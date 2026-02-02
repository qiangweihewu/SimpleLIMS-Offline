
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, Video, StopCircle, RefreshCw, Upload } from 'lucide-react';

interface Device {
    id: string;
    name: string;
    type: 'camera' | 'capture_card' | 'virtual';
    path: string;
}

interface CapturedMedia {
    id: string;
    path: string;
    capturedAt: string;
    metadata?: any;
}

interface ImageCaptureProps {
    patientId?: string;
}

export function ImageCapture({ patientId }: ImageCaptureProps) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [captures, setCaptures] = useState<CapturedMedia[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    // recordingId removed
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loading, setLoading] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        console.log('ImageCapture component mounted, patientId:', patientId);
        loadDevices();
        if (patientId) {
            loadCaptures();
        }
        return () => {
            console.log('ImageCapture component unmounting, stopping stream');
            stopStream();
        };
    }, [patientId]);

    const loadDevices = async () => {
        try {
            // Get devices from backend
            const backendDevices = await window.electronAPI.video.listDevices();
            console.log('Backend devices:', backendDevices);

            if (backendDevices && backendDevices.length > 0) {
                setDevices(backendDevices);
                if (!selectedDevice && backendDevices.length > 0) {
                    setSelectedDevice(backendDevices[0].path);
                }
            } else {
                // Fallback to browser devices if backend returns empty
                try {
                    const browserDevices = await navigator.mediaDevices.enumerateDevices();
                    const videoInputs = browserDevices.filter(d => d.kind === 'videoinput');

                    const fallbackDevices = videoInputs.map(d => ({
                        id: d.deviceId,
                        name: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
                        type: 'camera' as const,
                        path: d.deviceId
                    }));

                    setDevices(fallbackDevices);
                    if (!selectedDevice && fallbackDevices.length > 0) {
                        setSelectedDevice(fallbackDevices[0].path);
                    }
                } catch (browserErr) {
                    console.error('Failed to get browser devices:', browserErr);
                }
            }
        } catch (err) {
            console.error('Failed to load devices:', err);
            // Try browser fallback
            try {
                const browserDevices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = browserDevices.filter(d => d.kind === 'videoinput');

                const fallbackDevices = videoInputs.map(d => ({
                    id: d.deviceId,
                    name: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
                    type: 'camera' as const,
                    path: d.deviceId
                }));

                setDevices(fallbackDevices);
                if (!selectedDevice && fallbackDevices.length > 0) {
                    setSelectedDevice(fallbackDevices[0].path);
                }
            } catch (browserErr) {
                console.error('All device detection methods failed:', browserErr);
            }
        }
    };

    const loadCaptures = async () => {
        if (!patientId) return;
        try {
            const result = await window.electronAPI.video.getCaptures(patientId);
            setCaptures(result);
        } catch (err) {
            console.error('Failed to load captures', err);
        }
    };

    const startStream = async () => {
        stopStream();
        if (!selectedDevice) {
            console.warn('No device selected for stream');
            return;
        }

        try {
            console.log('Starting camera stream for device:', selectedDevice);

            // Try to get user media with the selected device
            let streamConstraints: MediaStreamConstraints;

            // Check if selectedDevice looks like a browser deviceId
            const browserDevices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = browserDevices.filter(d => d.kind === 'videoinput');
            const matchedDevice = videoInputs.find(d => d.deviceId === selectedDevice);

            if (matchedDevice) {
                // Use exact device constraint
                streamConstraints = {
                    video: {
                        deviceId: { exact: matchedDevice.deviceId },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
            } else {
                // Fallback to any available camera
                streamConstraints = {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
            setStream(mediaStream);
            // srcObject assignment moved to useEffect
        } catch (err) {
            console.error('Failed to start camera stream:', err);
            // Show user-friendly error message
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    alert('Camera access denied. Please allow camera permissions and try again.');
                } else if (err.name === 'NotFoundError') {
                    alert('No camera found. Please connect a camera and try again.');
                } else if (err.name === 'NotReadableError') {
                    alert('Camera is already in use by another application.');
                } else {
                    alert(`Camera error: ${err.message}`);
                }
            }
        }
    };

    // Fix: properly assign stream to video element when it becomes available
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            console.log('Video element source assigned');
        }
    }, [stream, videoRef.current]);

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const handleCapture = async () => {
        setLoading(true);
        try {
            // Stop browser stream to avoid device conflicts
            stopStream();

            // Use backend capture via IPC
            const result = await window.electronAPI.video.capture({
                devicePath: selectedDevice,
                resolution: '1920x1080',
                quality: 95
            }, patientId);

            console.log('Capture result:', result);

            // Reload captures
            await loadCaptures();

            // Restart stream
            await startStream();

        } catch (err) {
            console.error('Capture failed', err);
            // Try to restart stream anyway
            await startStream();
        } finally {
            setLoading(false);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            // Start recording
            if (!stream) {
                alert('No camera stream available');
                return;
            }

            try {
                recordedChunksRef.current = [];
                // Check supported mime types
                const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
                    ? "video/webm;codecs=vp9"
                    : MediaRecorder.isTypeSupported("video/webm")
                        ? "video/webm"
                        : "";

                if (!mimeType) {
                    throw new Error("No supported video mime type found");
                }

                const recorder = new MediaRecorder(stream, { mimeType });

                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunksRef.current.push(event.data);
                    }
                };

                recorder.onstop = async () => {
                    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                    const arrayBuffer = await blob.arrayBuffer();

                    // Determine extension based on mimeType
                    let format = 'webm';
                    if (mimeType.includes('mp4')) format = 'mp4';

                    try {
                        setLoading(true);
                        await window.electronAPI.video.saveWebRecording(arrayBuffer, patientId || 'unknown', format);
                        console.log('Recording saved successfully');
                        await loadCaptures();
                    } catch (err) {
                        console.error('Failed to save recording:', err);
                        alert('Failed to save recording.');
                    } finally {
                        setLoading(false);
                    }
                };

                recorder.start();
                mediaRecorderRef.current = recorder;
                setIsRecording(true);
            } catch (err) {
                console.error("Recording failed:", err);
                alert(`录像失败: ${err instanceof Error ? err.message : '未知错误'}`);
            }
        }
    };

    const convertToDicom = async (media: CapturedMedia) => {
        try {
            await window.electronAPI.dicom.wrap(
                media.path,
                {
                    patientId: patientId || 'UNKNOWN',
                    name: 'Unknown Patient'
                },
                {
                    modality: 'US',
                    studyDescription: 'Legacy Device Capture'
                }
            );
            alert("Successfully converted to DICOM format!");
        } catch (err) {
            console.error('DICOM conversion failed:', err);
            alert("DICOM conversion failed. Please check the logs.");
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="md:col-span-2 flex flex-col gap-4">
                <Card className="flex-1 flex flex-col overflow-hidden bg-black relative">
                    {isRecording && (
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                            <span className="text-white font-mono">REC</span>
                        </div>
                    )}

                    {(!stream && !isRecording) && (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                            <Camera className="w-16 h-16 mb-4" />
                            <p className="text-lg font-medium">Camera Inactive</p>
                            <p className="text-sm text-gray-400 mt-2">
                                {devices.length === 0
                                    ? 'No cameras detected'
                                    : selectedDevice
                                        ? 'Click "Start Camera" to begin preview'
                                        : 'Select a camera device'
                                }
                            </p>
                        </div>
                    )}

                    {stream && (
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                        />
                    )}
                </Card>

                <div className="flex gap-4 items-center justify-between p-4 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2">
                        <select
                            className="p-2 rounded border"
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                        >
                            <option value="">Select Device</option>
                            {devices.map(d => (
                                <option key={d.path} value={d.path}>{d.name}</option>
                            ))}
                        </select>
                        <Button variant="outline" size="icon" onClick={() => { loadDevices(); startStream(); }}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        {!stream && !isRecording ? (
                            <Button onClick={startStream}>Start Camera</Button>
                        ) : (
                            <Button variant="destructive" onClick={stopStream} disabled={isRecording}>Stop</Button>
                        )}

                        <Button
                            variant="secondary"
                            disabled={!selectedDevice || isRecording || loading} // Capture might stop stream internally, so we allow it if device selected
                            onClick={handleCapture}
                        >
                            <Camera className="h-4 w-4 mr-2" />
                            {loading ? 'Capturing...' : 'Capture'}
                        </Button>

                        <Button
                            variant={isRecording ? "destructive" : "default"}
                            disabled={!selectedDevice || loading || (!isRecording && !stream)}
                            onClick={toggleRecording}
                        >
                            {isRecording ? <StopCircle className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                            {isRecording ? 'Stop Rec' : 'Record'}
                        </Button>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Gallery</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px] w-full pr-4">
                        <div className="flex flex-col gap-4">
                            {captures.length === 0 && <p className="text-gray-500 text-center">No captures yet</p>}
                            {captures.map(media => (
                                <div key={media.id} className="border rounded bg-muted/10 p-2">
                                    <div className="aspect-video bg-black rounded mb-2 overflow-hidden relative group">
                                        {media.path.endsWith('.mp4') || media.path.endsWith('.avi') || media.path.endsWith('.mov') || media.path.endsWith('.webm') ? (
                                            <video
                                                src={`app-data://${media.path}`}
                                                className="w-full h-full object-cover"
                                                controls
                                                preload="metadata"
                                                onError={(e) => {
                                                    console.error('Failed to load video:', media.path);
                                                    console.error('Video load error details:', e);
                                                    const target = e.currentTarget as HTMLVideoElement;
                                                    const error = target.error;
                                                    if (error) {
                                                        console.error('Video error code:', error.code);
                                                        console.error('Video error message:', error.message);
                                                        // Error codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
                                                    }
                                                }}
                                                onLoadStart={() => {
                                                    console.log('Video loading started:', media.path);
                                                }}
                                                onCanPlay={() => {
                                                    console.log('Video can play:', media.path);
                                                }}
                                                onLoadedMetadata={(e) => {
                                                    const target = e.currentTarget as HTMLVideoElement;
                                                    console.log('Video metadata loaded:', {
                                                        path: media.path,
                                                        duration: target.duration,
                                                        videoWidth: target.videoWidth,
                                                        videoHeight: target.videoHeight
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <img
                                                src={`app-data://${media.path}`}
                                                className="w-full h-full object-cover"
                                                alt="Captured image"
                                                onError={(e) => {
                                                    console.error('Failed to load image:', media.path);
                                                    console.error('Image load error details:', e);
                                                    const target = e.currentTarget as HTMLImageElement;
                                                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NDQgMjEgMyAxNi45NzA2IDMgMTJDMyA3LjAyOTQ0IDcuMDI5NDQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQ0IDIxIDEyWiIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K';
                                                    target.title = `Failed to load: ${media.path}`;
                                                }}
                                            />
                                        )}

                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="text-white hover:bg-white/20"
                                                onClick={() => convertToDicom(media)}
                                                title="Convert to DICOM"
                                            >
                                                <Upload className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span>{new Date(media.capturedAt).toLocaleTimeString()}</span>
                                        <span className="uppercase">{media.path.split('.').pop()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
