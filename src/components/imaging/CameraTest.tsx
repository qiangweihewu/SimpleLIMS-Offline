import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Video, AlertCircle, CheckCircle } from 'lucide-react';

export function CameraTest() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [backendDevices, setBackendDevices] = useState<any[]>([]);
    const [backendError, setBackendError] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        testBrowserCamera();
        testBackendDevices();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const testBrowserCamera = async () => {
        try {
            // Test browser camera access
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setDevices(videoDevices);
            
            if (videoDevices.length > 0) {
                setSelectedDevice(videoDevices[0].deviceId);
            }
            
            console.log('Browser video devices:', videoDevices);
        } catch (err) {
            console.error('Browser camera test failed:', err);
            setError(`Browser camera error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const testBackendDevices = async () => {
        try {
            if (window.electronAPI?.video?.listDevices) {
                const devices = await window.electronAPI.video.listDevices();
                setBackendDevices(devices);
                console.log('Backend video devices:', devices);
            } else {
                setBackendError('Backend video API not available');
            }
        } catch (err) {
            console.error('Backend device test failed:', err);
            setBackendError(`Backend error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const startBrowserCamera = async () => {
        try {
            setError('');
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Failed to start browser camera:', err);
            setError(`Camera start failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const testBackendCapture = async () => {
        try {
            if (!window.electronAPI?.video?.capture) {
                setBackendError('Backend capture API not available');
                return;
            }

            const result = await window.electronAPI.video.capture({
                devicePath: selectedDevice,
                resolution: '640x480',
                quality: 85
            });
            
            console.log('Backend capture result:', result);
            alert('Backend capture successful! Check console for details.');
        } catch (err) {
            console.error('Backend capture failed:', err);
            setBackendError(`Capture failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const testProtocolHandler = async () => {
        try {
            // First test the backend debug function
            if (window.electronAPI?.debug?.testProtocol) {
                const result = await window.electronAPI.debug.testProtocol();
                console.log('Protocol debug result:', result);
                
                if (result.success) {
                    // Test loading the file through the protocol
                    const testUrl = result.protocolUrl;
                    const response = await fetch(testUrl);
                    
                    if (response.ok) {
                        const text = await response.text();
                        console.log('Protocol handler test: SUCCESS - File loaded:', text);
                        alert('Protocol handler is working correctly!');
                    } else {
                        console.error('Protocol handler test: FAILED - Response not OK:', response.status);
                        alert(`Protocol handler error: ${response.status} ${response.statusText}`);
                    }
                } else {
                    console.error('Protocol debug failed:', result.error);
                    alert(`Protocol debug failed: ${result.error}`);
                }
            } else {
                // Fallback to the old test method
                const testImageUrl = 'app-data:///test-path';
                const img = new Image();
                
                img.onload = () => {
                    console.log('Protocol handler test: SUCCESS - Image loaded');
                    alert('Protocol handler is working correctly!');
                };
                
                img.onerror = (e) => {
                    console.log('Protocol handler test: Expected error for non-existent file', e);
                    alert('Protocol handler is responding (expected error for test path)');
                };
                
                img.src = testImageUrl;
            }
        } catch (err) {
            console.error('Protocol handler test failed:', err);
            setBackendError(`Protocol test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Camera System Test
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Browser Camera Test */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            {devices.length > 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            Browser Camera Access
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                            Found {devices.length} video device(s)
                        </p>
                        {devices.length > 0 && (
                            <select 
                                value={selectedDevice} 
                                onChange={(e) => setSelectedDevice(e.target.value)}
                                className="w-full p-2 border rounded mb-2"
                            >
                                {devices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Camera ${device.deviceId.slice(0, 4)}`}
                                    </option>
                                ))}
                            </select>
                        )}
                        <div className="flex gap-2">
                            <Button onClick={startBrowserCamera} disabled={!selectedDevice}>
                                Start Camera
                            </Button>
                            <Button onClick={stopCamera} variant="outline" disabled={!stream}>
                                Stop Camera
                            </Button>
                        </div>
                        {error && (
                            <p className="text-red-500 text-sm mt-2">{error}</p>
                        )}
                    </div>

                    {/* Backend Device Test */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            {backendDevices.length > 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            Backend Device Detection
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                            Backend found {backendDevices.length} device(s)
                        </p>
                        {backendDevices.length > 0 && (
                            <div className="space-y-1 mb-2">
                                {backendDevices.map((device, index) => (
                                    <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                                        <strong>{device.name}</strong> ({device.type}) - {device.path}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button onClick={testBackendCapture} disabled={backendDevices.length === 0}>
                                Test Backend Capture
                            </Button>
                            <Button onClick={testProtocolHandler} variant="outline">
                                Test Protocol Handler
                            </Button>
                        </div>
                        {backendError && (
                            <p className="text-red-500 text-sm mt-2">{backendError}</p>
                        )}
                    </div>

                    {/* Video Preview */}
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Camera Preview</h3>
                        <div className="aspect-video bg-black rounded overflow-hidden">
                            {stream ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <div className="text-center">
                                        <Video className="h-12 w-12 mx-auto mb-2" />
                                        <p>No camera stream</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}