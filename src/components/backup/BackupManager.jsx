import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function BackupManager() {
    const [modalOpen, setModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState(null);

    const createBackup = async () => {
        setIsCreating(true);
        setStatus(null);
        
        try {
            const response = await base44.functions.invoke('createBackup', {});
            
            // JSON als Datei speichern
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { 
                type: 'application/json' 
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            setStatus('success');
            setTimeout(() => setModalOpen(false), 2000);
        } catch (error) {
            console.error('Backup-Fehler:', error);
            setStatus('error');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <Button
                onClick={() => setModalOpen(true)}
                variant="outline"
                className="border-primary/70 text-primary hover:bg-primary/15"
            >
                <Database className="w-4 h-4 mr-2" />
                Backup erstellen
            </Button>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-primary" />
                            Backup-Manager
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-primary/15 border border-primary/25 rounded-lg text-sm text-primary">
                            <p className="font-medium mb-2">ℹ️ Vollständiges Backup</p>
                            <p className="text-xs">
                                Erstellt ein komplettes Backup aller App-Daten als JSON-Datei. 
                                Beinhaltet: Mitarbeiter, Schichten, Artikel, Rezepte, Zeiterfassung, 
                                Budget und alle weiteren Daten.
                            </p>
                        </div>

                        {status === 'success' && (
                            <div className="flex items-center gap-2 p-3 bg-status-ok/15 border border-status-ok/25 rounded-lg text-status-ok">
                                <CheckCircle className="w-5 h-5" />
                                <span className="text-sm font-medium">Backup erfolgreich erstellt!</span>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="flex items-center gap-2 p-3 bg-status-danger/15 border border-status-danger/25 rounded-lg text-status-danger">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-sm font-medium">Fehler beim Erstellen des Backups</span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setModalOpen(false)}
                                className="flex-1"
                                disabled={isCreating}
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={createBackup}
                                className="flex-1 bg-primary/70 hover:bg-primary/70"
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Erstelle...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Backup erstellen
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}