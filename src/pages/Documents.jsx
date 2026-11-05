import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    FileText, Upload, Search, FolderOpen, Archive,
    MoreHorizontal, AlertTriangle, Clock, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, isBefore, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import DocumentUploader from '@/components/documents/DocumentUploader';
import DocumentCard from '@/components/documents/DocumentCard';
import DocumentViewerModal from '@/components/documents/DocumentViewerModal';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';

export default function DocumentsPage() {
    const [showUploader, setShowUploader] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [entityFilter, setEntityFilter] = useState('all');
    const [showArchived, setShowArchived] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const permissions = usePermissions();
    const queryClient = useQueryClient();

    const { data: rawDocuments = [], isLoading } = useQuery({
        queryKey: ['documents'],
        queryFn: () => base44.entities.Document.list('-created_date'),
    });

    const documents = rawDocuments.map(doc => ({
        id: doc.id,
        created_date: doc.created_date,
        ...(doc.data ? doc.data : doc),
    }));

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Document.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setDeleteTarget(null);
            toast.success('Dokument gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen'),
    });

    const archiveMutation = useMutation({
        mutationFn: ({ id, isArchived }) => base44.entities.Document.update(id, { is_archived: isArchived }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            toast.success('Status aktualisiert');
        },
    });

    // Ablauf-Warnungen berechnen
    const today = new Date();
    const expiringDocs = useMemo(() =>
        documents.filter(d => {
            if (!d.expiry_date || d.is_archived) return false;
            const exp = new Date(d.expiry_date);
            return isBefore(exp, addDays(today, 31)); // <= 30 Tage
        }),
        [documents]
    );

    const expiredDocs  = expiringDocs.filter(d => isBefore(new Date(d.expiry_date), today));
    const soonDocs     = expiringDocs.filter(d => !isBefore(new Date(d.expiry_date), today));

    const filteredDocuments = useMemo(() => documents.filter(doc => {
        if (!showArchived && doc.is_archived) return false;
        if (showArchived && !doc.is_archived) return false;
        if (searchTerm && !doc.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !doc.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
        if (entityFilter !== 'all' && doc.linked_entity_type !== entityFilter) return false;
        return true;
    }), [documents, showArchived, searchTerm, categoryFilter, entityFilter]);

    const groupedDocuments = useMemo(() =>
        filteredDocuments.reduce((acc, doc) => {
            const cat = doc.category || 'Sonstiges';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(doc);
            return acc;
        }, {}),
        [filteredDocuments]
    );

    const activeCount   = documents.filter(d => !d.is_archived).length;
    const archivedCount = documents.filter(d => d.is_archived).length;
    const hasActiveFilters = searchTerm || categoryFilter !== 'all' || entityFilter !== 'all';

    if (!permissions.isManager) return <PermissionDenied />;

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">

            {/* ── HEADER ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                    <h1 className="page-title">Dokumente</h1>
                    <Badge className="bg-secondary text-muted-foreground text-xs hidden sm:flex">
                        {activeCount} aktiv
                    </Badge>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {permissions.isManager && (
                        <Button
                            size="sm"
                            onClick={() => setShowUploader(true)}
                            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white min-h-[36px]"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Hochladen</span>
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="w-9 h-9 min-h-[36px]">
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => setShowArchived(v => !v)}>
                                <Archive className="w-4 h-4 mr-2" />
                                {showArchived ? `Aktive anzeigen (${activeCount})` : `Archiv anzeigen (${archivedCount})`}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ── ABLAUF-WARNUNGEN ──────────────────────────────────────────── */}
            {(expiredDocs.length > 0 || soonDocs.length > 0) && !showArchived && (
                <div className="flex flex-wrap gap-2">
                    {expiredDocs.length > 0 && (
                        <button
                            onClick={() => setCategoryFilter('all')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 transition-all"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {expiredDocs.length} Dokument{expiredDocs.length > 1 ? 'e' : ''} abgelaufen
                        </button>
                    )}
                    {soonDocs.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border bg-amber-500/10 border-amber-500/20 text-amber-400">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            {soonDocs.length} läuft in &lt;30 Tagen ab
                        </div>
                    )}
                </div>
            )}

            {/* ── FILTER-LEISTE ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Suchen…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-8 h-9 bg-card text-sm min-h-[44px]"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-auto min-w-[140px] bg-card text-sm min-h-[44px]">
                        <SelectValue placeholder="Kategorie" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Kategorien</SelectItem>
                        <SelectItem value="Vertrag">Vertrag</SelectItem>
                        <SelectItem value="Rechnung">Rechnung</SelectItem>
                        <SelectItem value="Bericht">Bericht</SelectItem>
                        <SelectItem value="Handbuch">Handbuch</SelectItem>
                        <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="h-9 w-auto min-w-[150px] bg-card text-sm min-h-[44px]">
                        <SelectValue placeholder="Verknüpfung" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Verknüpfungen</SelectItem>
                        <SelectItem value="Employee">Mitarbeiter</SelectItem>
                        <SelectItem value="Event">Event</SelectItem>
                        <SelectItem value="Supplier">Lieferant</SelectItem>
                        <SelectItem value="Keine">Keine</SelectItem>
                    </SelectContent>
                </Select>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-9 min-h-[44px]"
                        onClick={() => { setSearchTerm(''); setCategoryFilter('all'); setEntityFilter('all'); }}
                    >
                        <X className="w-3.5 h-3.5 mr-1" /> Filter löschen
                    </Button>
                )}
            </div>

            {/* ── ARCHIV-BANNER ─────────────────────────────────────────────── */}
            {showArchived && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
                    <Archive className="w-4 h-4 shrink-0" />
                    Archiv-Ansicht — {archivedCount} archivierte Dokumente
                    <button onClick={() => setShowArchived(false)} className="ml-auto text-xs hover:text-foreground flex items-center gap-1">
                        <X className="w-3 h-3" /> Schließen
                    </button>
                </div>
            )}

            {/* ── UPLOADING MODAL ───────────────────────────────────────────── */}
            {showUploader && (
                <DocumentUploader
                    onClose={() => setShowUploader(false)}
                    onSuccess={() => {
                        setShowUploader(false);
                        queryClient.invalidateQueries({ queryKey: ['documents'] });
                    }}
                />
            )}

            {/* ── VIEWER MODAL ──────────────────────────────────────────────── */}
            <DocumentViewerModal
                document={selectedDocument}
                open={viewerOpen}
                onClose={() => { setViewerOpen(false); setSelectedDocument(null); }}
            />

            {/* ── DELETE CONFIRM ────────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>„{deleteTarget?.name}"</strong> wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate(deleteTarget?.id)}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Löschen'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── CONTENT ───────────────────────────────────────────────────── */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Dokumente werden geladen…</span>
                </div>
            ) : filteredDocuments.length === 0 ? (
                <Card className="border-border bg-card">
                    <CardContent className="py-16 text-center">
                        <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground text-sm">
                            {documents.length === 0 ? 'Noch keine Dokumente hochgeladen' : 'Keine Dokumente gefunden'}
                        </p>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground"
                                onClick={() => { setSearchTerm(''); setCategoryFilter('all'); setEntityFilter('all'); }}
                            >
                                Filter zurücksetzen
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedDocuments).map(([category, docs]) => (
                        <div key={category}>
                            <div className="flex items-center gap-2 mb-3">
                                <FolderOpen className="w-4 h-4 text-amber-400" />
                                <h2 className="text-sm font-semibold text-foreground">{category}</h2>
                                <Badge className="bg-secondary text-muted-foreground text-xs">{docs.length}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {docs.map(doc => (
                                    <DocumentCard
                                        key={doc.id}
                                        document={doc}
                                        onDelete={() => setDeleteTarget(doc)}
                                        onArchive={(isArchived) => archiveMutation.mutate({ id: doc.id, isArchived })}
                                        canEdit={permissions.isManager}
                                        onView={(d) => { setSelectedDocument(d); setViewerOpen(true); }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}