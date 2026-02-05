import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    BookOpen, Search, Plus, Upload, FileText, Folder, ExternalLink,
    Tag, Calendar, Trash2, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { PDFViewer } from './PDFViewer';

interface KnowledgeEntry {
    id: number;
    title: string;
    category: string;
    equipment_model?: string;
    content?: string;
    file_path?: string;
    tags?: string;
    created_at: string;
    updated_at: string;
}

const CATEGORIES = [
    'service_manual',
    'troubleshooting',
    'error_codes',
    'maintenance',
    'safety',
    'spare_parts',
    'other'
];

export function KnowledgeBase() {
    const { t } = useTranslation();
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
    const [showViewer, setShowViewer] = useState(false);
    const [showPdfViewer, setShowPdfViewer] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        category: 'troubleshooting',
        equipment_model: '',
        content: '',
        file_path: '',
        tags: ''
    });

    useEffect(() => {
        loadEntries();
    }, []);

    const loadEntries = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.db.all<KnowledgeEntry>(
                'SELECT * FROM knowledge_base ORDER BY updated_at DESC'
            );
            setEntries(result || []);
        } catch (err) {
            console.error('Failed to load knowledge base:', err);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddEntry = async () => {
        if (!formData.title) {
            toast.error(t('common.required_fields'));
            return;
        }

        try {
            await window.electronAPI.db.run(
                `INSERT INTO knowledge_base (title, category, equipment_model, content, file_path, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [formData.title, formData.category, formData.equipment_model, formData.content, formData.file_path, formData.tags]
            );
            toast.success(t('equipment.knowledge.add_success'));
            setShowAddDialog(false);
            resetForm();
            loadEntries();
        } catch (err) {
            console.error('Failed to add entry:', err);
            toast.error(t('equipment.knowledge.add_failed'));
        }
    };

    const handleDeleteEntry = async (id: number) => {
        if (!confirm(t('common.confirm_delete'))) return;
        try {
            await window.electronAPI.db.run('DELETE FROM knowledge_base WHERE id = ?', [id]);
            toast.success(t('common.deleted_success'));
            loadEntries();
        } catch (err) {
            console.error('Failed to delete entry:', err);
            toast.error(t('common.error_occurred'));
        }
    };

    const handleSelectFile = async () => {
        const path = await window.electronAPI.file.selectFile([
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] }
        ]);
        if (path) {
            setFormData({ ...formData, file_path: path });
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            category: 'troubleshooting',
            equipment_model: '',
            content: '',
            file_path: '',
            tags: ''
        });
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            service_manual: 'bg-blue-100 text-blue-700',
            troubleshooting: 'bg-red-100 text-red-700',
            error_codes: 'bg-orange-100 text-orange-700',
            maintenance: 'bg-green-100 text-green-700',
            safety: 'bg-purple-100 text-purple-700',
            spare_parts: 'bg-yellow-100 text-yellow-700',
            other: 'bg-gray-100 text-gray-700'
        };
        return colors[category] || colors.other;
    };

    const filteredEntries = entries.filter(entry => {
        const matchesSearch = !searchTerm ||
            entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.equipment_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.tags?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = !selectedCategory || entry.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    // Group by category for display
    const groupedEntries = filteredEntries.reduce((acc, entry) => {
        const cat = entry.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(entry);
        return acc;
    }, {} as Record<string, KnowledgeEntry[]>);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        {t('equipment.knowledge.title')}
                    </h3>
                    <p className="text-sm text-gray-500">{t('equipment.knowledge.subtitle')}</p>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('equipment.knowledge.add_entry')}
                </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[250px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder={t('equipment.knowledge.search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={!selectedCategory ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory('')}
                    >
                        {t('equipment.knowledge.all')}
                    </Button>
                    {CATEGORIES.map(cat => (
                        <Button
                            key={cat}
                            variant={selectedCategory === cat ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {t(`equipment.knowledge.categories.${cat}`)}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm text-gray-500">
                <span>{t('equipment.knowledge.total_entries', { count: entries.length })}</span>
                <span>·</span>
                <span>{t('equipment.knowledge.showing', { count: filteredEntries.length })}</span>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
            ) : filteredEntries.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>{t('equipment.knowledge.no_entries')}</p>
                        <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('equipment.knowledge.add_first')}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <ScrollArea className="h-[500px]">
                    <div className="space-y-6">
                        {Object.entries(groupedEntries).map(([category, items]) => (
                            <div key={category}>
                                <h4 className="font-medium text-sm text-gray-500 mb-3 uppercase tracking-wide">
                                    {t(`equipment.knowledge.categories.${category}`)} ({items.length})
                                </h4>
                                <div className="grid gap-3">
                                    {items.map(entry => (
                                        <Card key={entry.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${getCategoryColor(entry.category)}`}>
                                                            {entry.file_path ? <FileText className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="font-medium truncate">{entry.title}</h5>
                                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                                {entry.equipment_model && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Folder className="h-3 w-3" />
                                                                        {entry.equipment_model}
                                                                    </span>
                                                                )}
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {format(new Date(entry.updated_at), 'yyyy-MM-dd')}
                                                                </span>
                                                            </div>
                                                            {entry.content && (
                                                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{entry.content}</p>
                                                            )}
                                                            {entry.tags && (
                                                                <div className="flex gap-1 mt-2">
                                                                    {entry.tags.split(',').map((tag, i) => (
                                                                        <Badge key={i} variant="outline" className="text-xs">
                                                                            <Tag className="h-2 w-2 mr-1" />
                                                                            {tag.trim()}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setSelectedEntry(entry);
                                                                if (entry.file_path?.toLowerCase().endsWith('.pdf')) {
                                                                    setShowPdfViewer(true);
                                                                } else {
                                                                    setShowViewer(true);
                                                                }
                                                            }}
                                                            title={t('equipment.knowledge.view')}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {entry.file_path && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    // Open file externally
                                                                    window.open(`file://${entry.file_path}`, '_blank');
                                                                }}
                                                                title={t('equipment.knowledge.open_file')}
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-700"
                                                            onClick={() => handleDeleteEntry(entry.id)}
                                                            title={t('common.delete')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* Add Entry Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('equipment.knowledge.add_entry')}</DialogTitle>
                        <DialogDescription>{t('equipment.knowledge.add_desc')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.title')} *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={t('equipment.knowledge.form.title_placeholder')}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t('equipment.knowledge.form.category')}</Label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>
                                            {t(`equipment.knowledge.categories.${cat}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('equipment.knowledge.form.equipment_model')}</Label>
                                <Input
                                    value={formData.equipment_model}
                                    onChange={(e) => setFormData({ ...formData, equipment_model: e.target.value })}
                                    placeholder="e.g., Mindray BC-3000"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.content')}</Label>
                            <textarea
                                className="w-full p-2 border rounded-md h-24 resize-none"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder={t('equipment.knowledge.form.content_placeholder')}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.file')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.file_path}
                                    onChange={(e) => setFormData({ ...formData, file_path: e.target.value })}
                                    placeholder={t('equipment.knowledge.form.file_placeholder')}
                                    className="flex-1"
                                />
                                <Button variant="outline" onClick={handleSelectFile}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    {t('common.browse')}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('equipment.knowledge.form.tags')}</Label>
                            <Input
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                placeholder={t('equipment.knowledge.form.tags_placeholder')}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleAddEntry}>
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Entry Viewer Dialog */}
            <Dialog open={showViewer} onOpenChange={setShowViewer}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedEntry?.title}</DialogTitle>
                        <DialogDescription className="flex items-center gap-2">
                            <Badge className={getCategoryColor(selectedEntry?.category || '')}>
                                {t(`equipment.knowledge.categories.${selectedEntry?.category}`)}
                            </Badge>
                            {selectedEntry?.equipment_model && (
                                <span className="text-gray-500">{selectedEntry.equipment_model}</span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {selectedEntry?.content ? (
                            <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap">{selectedEntry.content}</p>
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">{t('equipment.knowledge.no_content')}</p>
                        )}

                        {selectedEntry?.file_path && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-gray-500" />
                                    <span className="text-sm truncate max-w-[300px]">{selectedEntry.file_path}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`file://${selectedEntry.file_path}`, '_blank')}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {t('equipment.knowledge.open_file')}
                                </Button>
                            </div>
                        )}

                        {selectedEntry?.tags && (
                            <div className="mt-4">
                                <Label className="text-xs text-gray-500">{t('equipment.knowledge.form.tags')}</Label>
                                <div className="flex gap-1 mt-1">
                                    {selectedEntry.tags.split(',').map((tag, i) => (
                                        <Badge key={i} variant="outline">
                                            <Tag className="h-2 w-2 mr-1" />
                                            {tag.trim()}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* PDF Viewer Dialog */}
            {selectedEntry?.file_path && (
                <PDFViewer
                    filePath={selectedEntry.file_path}
                    fileName={selectedEntry.title}
                    open={showPdfViewer}
                    onOpenChange={setShowPdfViewer}
                />
            )}
        </div>
    );
}
