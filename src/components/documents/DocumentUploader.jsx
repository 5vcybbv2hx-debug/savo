import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentUploader({ onClose, onSuccess }) {
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'Sonstiges',
        linked_entity_type: 'Keine',
        linked_entity_id: '',
        linked_entity_name: '',
        tags: '',
        expiry_date: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        placeholderData: []
    });

    const { data: events = [] } = useQuery({
        queryKey: ['events'],
        queryFn: () => base44.entities.Event.list(),
        placeholderData: []
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.list(),
        placeholderData: []
    });

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (!formData.name) {
                setFormData(prev => ({ ...prev, name: file.name }));
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Bitte Datei auswählen');
            return;
        }

        if (!formData.name) {
            toast.error('Bitte Namen eingeben');
            return;
        }

        setUploading(true);
        try {
            // Upload file
            const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

            // Get file type
            const fileType = selectedFile.name.split('.').pop()?.toUpperCase() || 'Unbekannt';

            // Create document
            await base44.entities.Document.create({
                name: formData.name,
                description: formData.description,
                file_url,
                file_type: fileType,
                file_size: selectedFile.size,
                category: formData.category,
                linked_entity_type: formData.linked_entity_type === 'Keine' ? null : formData.linked_entity_type,
                linked_entity_id: formData.linked_entity_id || null,
                linked_entity_name: formData.linked_entity_name || null,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
                expiry_date: formData.expiry_date || null
            });

            toast.success('Dokument erfolgreich hochgeladen');
            onSuccess();
        } catch (error) {
            toast.error('Fehler beim Hochladen: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const getLinkedEntities = () => {
        switch (formData.linked_entity_type) {
            case 'Employee':
                return employees;
            case 'Event':
                return events;
            case 'Supplier':
                return suppliers;
            default:
                return [];
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-slate-800 border-slate-700 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-amber-500" />
                        Dokument hochladen
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* File Upload */}
                    <div>
                        <Label className="text-slate-300">Datei auswählen *</Label>
                        <Input
                            type="file"
                            onChange={handleFileSelect}
                            className="bg-slate-900 border-slate-600 text-white"
                        />
                        {selectedFile && (
                            <p className="text-sm text-slate-400 mt-1">
                                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                            </p>
                        )}
                    </div>

                    {/* Name */}
                    <div>
                        <Label className="text-slate-300">Dokumentenname *</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="z.B. Arbeitsvertrag Max Mustermann"
                            className="bg-slate-900 border-slate-600 text-white"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <Label className="text-slate-300">Beschreibung</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Zusätzliche Informationen..."
                            className="bg-slate-900 border-slate-600 text-white"
                            rows={3}
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <Label className="text-slate-300">Kategorie</Label>
                        <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                            <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Vertrag">Vertrag</SelectItem>
                                <SelectItem value="Rechnung">Rechnung</SelectItem>
                                <SelectItem value="Bericht">Bericht</SelectItem>
                                <SelectItem value="Handbuch">Handbuch</SelectItem>
                                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Entity Link */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-slate-300">Verknüpfen mit</Label>
                            <Select 
                                value={formData.linked_entity_type} 
                                onValueChange={(value) => setFormData(prev => ({ 
                                    ...prev, 
                                    linked_entity_type: value,
                                    linked_entity_id: '',
                                    linked_entity_name: ''
                                }))}
                            >
                                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Keine">Keine Verknüpfung</SelectItem>
                                    <SelectItem value="Employee">Mitarbeiter</SelectItem>
                                    <SelectItem value="Event">Event</SelectItem>
                                    <SelectItem value="Supplier">Lieferant</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.linked_entity_type !== 'Keine' && (
                            <div>
                                <Label className="text-slate-300">Auswählen</Label>
                                <Select 
                                    value={formData.linked_entity_id}
                                    onValueChange={(value) => {
                                        const entity = getLinkedEntities().find(e => e.id === value);
                                        setFormData(prev => ({
                                            ...prev,
                                            linked_entity_id: value,
                                            linked_entity_name: entity?.name || entity?.title || ''
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                        <SelectValue placeholder="Wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getLinkedEntities().map(entity => (
                                            <SelectItem key={entity.id} value={entity.id}>
                                                {entity.name || entity.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <Label className="text-slate-300">Tags (kommagetrennt)</Label>
                        <Input
                            value={formData.tags}
                            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                            placeholder="wichtig, dringend, vertraulich"
                            className="bg-slate-900 border-slate-600 text-white"
                        />
                    </div>

                    {/* Expiry Date */}
                    <div>
                        <Label className="text-slate-300">Ablaufdatum (optional)</Label>
                        <Input
                            type="date"
                            value={formData.expiry_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                            className="bg-slate-900 border-slate-600 text-white"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="border-slate-600 text-slate-300"
                    >
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {uploading ? 'Lädt hoch...' : 'Hochladen'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}