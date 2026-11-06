import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { FileUp, Download, Trash2, AlertCircle, Loader2, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DOCUMENT_TYPES = [
  { value: 'Personalbogen', label: 'Personalbogen' },
  { value: 'Arbeitsvertrag', label: 'Arbeitsvertrag' },
  { value: 'Steuerunterlagen', label: 'Steuerunterlagen' },
  { value: 'Versicherung', label: 'Versicherung' },
  { value: 'Ausbildung', label: 'Ausbildung' },
  { value: 'Bescheinigung', label: 'Bescheinigung' },
  { value: 'Sonstiges', label: 'Sonstiges' }
];

export default function DocumentManager({ employeeId, employeeName, canEdit = true }) {
  const [documentType, setDocumentType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Fetch documents
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['employeeDocuments', employeeId],
    queryFn: async () => {
      const docs = await base44.entities.EmployeeDocument.filter({ employee_id: employeeId });
      return docs.filter(d => !d.is_archived);
    },
    enabled: !!employeeId
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data) => {
      if (!selectedFile) throw new Error('Keine Datei ausgewählt');

      const uploadedFile = await base44.integrations.Core.UploadFile({ file: selectedFile });

      return base44.entities.EmployeeDocument.create({
        employee_id: employeeId,
        employee_name: employeeName,
        document_type: documentType,
        file_name: selectedFile.name,
        file_url: uploadedFile.file_url,
        file_type: selectedFile.type,
        description: description || undefined,
        uploaded_by: currentUser?.email
      });
    },
    onSuccess: () => {
      toast.success('Dokument hochgeladen');
      queryClient.invalidateQueries({ queryKey: ['employeeDocuments', employeeId] });
      setDocumentType('');
      setSelectedFile(null);
      setDescription('');
    },
    onError: (error) => {
      toast.error('Upload fehlgeschlagen: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (docId) => base44.entities.EmployeeDocument.delete(docId),
    onSuccess: () => {
      toast.success('Dokument gelöscht');
      queryClient.invalidateQueries({ queryKey: ['employeeDocuments', employeeId] });
    },
    onError: (error) => {
      toast.error('Löschen fehlgeschlagen: ' + error.message);
    }
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error('Datei zu groß (max. 25 MB)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!documentType) {
      toast.error('Bitte wählen Sie einen Dokumenttyp');
      return;
    }
    uploadMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Upload Bereich */}
      {canEdit && (
        <Card className="border-status-warn/20 bg-status-warn/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              Dokument hochladen
            </CardTitle>
            <CardDescription>PDF, Bilder und andere Dokumente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Dokumenttyp *</label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Dokumenttyp wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Datei *</label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploadMutation.isPending}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Button
                  variant="outline"
                  className="w-full h-10 justify-start text-left pointer-events-none"
                >
                  {selectedFile ? selectedFile.name : 'Datei auswählen'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Beschreibung (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="z.B. Handschriftlicher Personalbogen 2023"
                disabled={uploadMutation.isPending}
                className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-base placeholder:text-muted-foreground disabled:opacity-50"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !documentType || uploadMutation.isPending}
              className="w-full h-11"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4 mr-2" />
                  Dokument hochladen
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dokumente Liste */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Dokumente ({documents.length})
          </h3>
        </div>

        {loadingDocs ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Keine Dokumente vorhanden. Laden Sie Ihren Personalbogen oder andere Unterlagen hoch.
            </AlertDescription>
          </Alert>
        ) : (
          documents.map(doc => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-card dark:bg-surface">
                    <File className="w-6 h-6 text-muted-foreground dark:text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{doc.file_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {doc.document_type}
                    </p>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Hochgeladen: {format(parseISO(doc.created_date), 'dd. MMMM yyyy HH:mm', { locale: de })}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        try {
                          // Use secure document access function
                          const response = await base44.functions.invoke('getSecureDocument', {
                            documentId: doc.id
                          });
                          if (response.data.access_granted) {
                            window.open(doc.file_url, '_blank');
                          } else {
                            toast.error('Zugriff verweigert');
                          }
                        } catch (error) {
                          toast.error('Fehler beim Abrufen: ' + error.message);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-card dark:hover:bg-surface transition-colors"
                      title="Öffnen"
                    >
                      <Download className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => {
                          if (confirm('Dokument wirklich löschen?')) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-2 rounded-lg hover:bg-status-danger/15 dark:hover:bg-status-danger/30 transition-colors disabled:opacity-50"
                        title="Löschen"
                      >
                        <Trash2 className="w-5 h-5 text-status-danger" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}