import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    History, GitCompare, RotateCcw, Eye, Clock, User, FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DocumentVersion {
    id: number;
    document_id: number;
    version_number: number;
    title: string;
    content: string;
    changed_by: string;
    change_summary: string;
    created_at: string;
}

interface KnowledgeEntry {
    id: number;
    title: string;
    content: string;
    category: string;
    updated_at: string;
}

interface DocumentVersionHistoryProps {
    documentId: number;
    currentDocument: KnowledgeEntry;
    onRestore?: (version: DocumentVersion) => void;
}

export function DocumentVersionHistory({ documentId, currentDocument, onRestore }: DocumentVersionHistoryProps) {
    const { t } = useTranslation();
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
    const [compareVersion, setCompareVersion] = useState<DocumentVersion | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showCompare, setShowCompare] = useState(false);

    // Load version history
    const loadVersions = useCallback(async () => {
        try {
            const result = await window.electronAPI.db.all<DocumentVersion>(
                `SELECT * FROM document_versions 
                 WHERE document_id = ? 
                 ORDER BY version_number DESC`,
                [documentId]
            );
            setVersions(result || []);
        } catch (err) {
            console.error('Failed to load versions:', err);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    // Create new version (should be called before saving document changes)
    const createVersion = async (changeSummary: string, changedBy: string) => {
        try {
            const lastVersion = versions[0]?.version_number || 0;

            await window.electronAPI.db.run(
                `INSERT INTO document_versions 
                    (document_id, version_number, title, content, changed_by, change_summary, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    documentId,
                    lastVersion + 1,
                    currentDocument.title,
                    currentDocument.content,
                    changedBy,
                    changeSummary
                ]
            );

            toast.success(t('versions.created'));
            loadVersions();
        } catch (err) {
            console.error('Failed to create version:', err);
            toast.error(t('versions.create_failed'));
        }
    };

    // Restore a previous version
    const handleRestore = async (version: DocumentVersion) => {
        try {
            // First save current as a new version
            await createVersion(t('versions.before_restore'), 'System');

            // Update the document with the old version's content
            await window.electronAPI.db.run(
                `UPDATE knowledge_base 
                 SET title = ?, content = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [version.title, version.content, documentId]
            );

            toast.success(t('versions.restored', { version: version.version_number }));

            if (onRestore) {
                onRestore(version);
            }
        } catch (err) {
            console.error('Failed to restore version:', err);
            toast.error(t('versions.restore_failed'));
        }
    };

    // Preview a version
    const handlePreview = (version: DocumentVersion) => {
        setSelectedVersion(version);
        setShowPreview(true);
    };

    // Compare two versions
    const handleCompare = (version: DocumentVersion) => {
        if (!compareVersion) {
            setCompareVersion(version);
            toast.info(t('versions.select_second'));
        } else {
            setSelectedVersion(version);
            setShowCompare(true);
        }
    };

    // Simple diff display
    const renderDiff = (oldText: string, newText: string) => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const maxLines = Math.max(oldLines.length, newLines.length);

        const result: JSX.Element[] = [];

        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';

            if (oldLine !== newLine) {
                if (oldLine) {
                    result.push(
                        <div key={`old-${i}`} className="bg-red-50 border-l-4 border-red-400 pl-2 py-1">
                            <span className="text-red-600">- {oldLine}</span>
                        </div>
                    );
                }
                if (newLine) {
                    result.push(
                        <div key={`new-${i}`} className="bg-green-50 border-l-4 border-green-400 pl-2 py-1">
                            <span className="text-green-600">+ {newLine}</span>
                        </div>
                    );
                }
            } else {
                result.push(
                    <div key={`same-${i}`} className="text-gray-500 pl-2 py-1">
                        {oldLine}
                    </div>
                );
            }
        }

        return result;
    };

    if (loading) {
        return <div className="text-center py-4 text-gray-500">{t('common.loading')}</div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t('versions.title')}
                </h3>
                <Badge variant="outline">{versions.length} {t('versions.count')}</Badge>
            </div>

            {/* Version List */}
            {versions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t('versions.no_history')}</p>
                </div>
            ) : (
                <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                        {versions.map((version, index) => (
                            <Card key={version.id} className="border">
                                <CardContent className="p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">v{version.version_number}</Badge>
                                                <span className="text-sm font-medium">{version.title}</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">{version.change_summary}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {version.changed_by}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {format(parseISO(version.created_at), 'PPp')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handlePreview(version)}
                                                title={t('versions.preview')}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleCompare(version)}
                                                title={t('versions.compare')}
                                                className={compareVersion?.id === version.id ? 'bg-blue-100' : ''}
                                            >
                                                <GitCompare className="h-4 w-4" />
                                            </Button>
                                            {index > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRestore(version)}
                                                    title={t('versions.restore')}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* Cancel compare mode */}
            {compareVersion && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                    <GitCompare className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                        {t('versions.comparing_with', { version: compareVersion.version_number })}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCompareVersion(null)}
                    >
                        {t('common.cancel')}
                    </Button>
                </div>
            )}

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            {t('versions.preview')} - v{selectedVersion?.version_number}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedVersion && (
                        <ScrollArea className="flex-1 max-h-[60vh]">
                            <div className="space-y-4 p-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">{t('versions.title_label')}</label>
                                    <p className="mt-1 font-medium">{selectedVersion.title}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">{t('versions.content_label')}</label>
                                    <div className="mt-1 p-3 bg-gray-50 rounded-lg whitespace-pre-wrap font-mono text-sm">
                                        {selectedVersion.content}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter>
                        {selectedVersion && (
                            <Button variant="outline" onClick={() => handleRestore(selectedVersion)}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                {t('versions.restore_this')}
                            </Button>
                        )}
                        <Button onClick={() => setShowPreview(false)}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Compare Dialog */}
            <Dialog open={showCompare} onOpenChange={(open) => {
                setShowCompare(open);
                if (!open) {
                    setCompareVersion(null);
                }
            }}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitCompare className="h-5 w-5 text-blue-600" />
                            {t('versions.comparing')} v{compareVersion?.version_number} → v{selectedVersion?.version_number}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 max-h-[60vh]">
                        {compareVersion && selectedVersion && (
                            <div className="p-4 font-mono text-sm">
                                {renderDiff(compareVersion.content || '', selectedVersion.content || '')}
                            </div>
                        )}
                    </ScrollArea>

                    <DialogFooter>
                        <Button onClick={() => setShowCompare(false)}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Hook to create version before saving
export function useDocumentVersioning(documentId: number) {
    const createVersionBeforeSave = async (
        currentTitle: string,
        currentContent: string,
        changeSummary: string,
        changedBy: string = 'User'
    ) => {
        try {
            // Get last version number
            const lastVersion = await window.electronAPI.db.get<{ max_version: number }>(
                'SELECT MAX(version_number) as max_version FROM document_versions WHERE document_id = ?',
                [documentId]
            );

            const newVersionNumber = (lastVersion?.max_version || 0) + 1;

            await window.electronAPI.db.run(
                `INSERT INTO document_versions 
                    (document_id, version_number, title, content, changed_by, change_summary, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [documentId, newVersionNumber, currentTitle, currentContent, changedBy, changeSummary]
            );

            return newVersionNumber;
        } catch (err) {
            console.error('Failed to create version:', err);
            throw err;
        }
    };

    return { createVersionBeforeSave };
}
