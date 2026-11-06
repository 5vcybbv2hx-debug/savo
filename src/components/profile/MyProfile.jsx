import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Mail, Phone, Calendar, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import MyShiftsCalendarSync from '@/components/calendar/MyShiftsCalendarSync';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MyProfilePage() {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const { data: currentUser, isLoading: userLoading, error: userError } = useQuery({
        queryKey: ['current-user'],
        queryFn: () => base44.auth.me(),
        retry: 1,
    });

    // Mitarbeitereintrag robust suchen: erst per E-Mail (case-insensitiv),
    // damit ein abweichend gespeicherter Eintrag die Seite nicht blockiert.
    const { data: myEmployee, isLoading: employeeLoading, error: employeeError } = useQuery({
        queryKey: ['my-employee', currentUser?.email],
        queryFn: async () => {
            const email = String(currentUser?.email || '').toLowerCase();
            const employees = await base44.entities.Employee.list('-created_date', 300);
            return employees.find(e => String(e.email || '').toLowerCase() === email) || null;
        },
        enabled: !!currentUser?.email,
        retry: 1,
    });

    const deleteDataMutation = useMutation({
        mutationFn: async () => {
            // GDPR Art. 17 — formal deletion request with audit trail
            await base44.functions.invoke('requestAccountDeletion', { email: currentUser.email });
        },
        onSuccess: () => {
            toast.success('Lösch-Anfrage eingegangen. Sie erhalten eine Bestätigungs-E-Mail.');
            setShowDeleteDialog(false);
            setTimeout(() => base44.auth.logout(), 2500);
        },
        onError: () => {
            toast.error('Fehler beim Senden der Lösch-Anfrage. Bitte erneut versuchen.');
        }
    });

    if (userLoading || employeeLoading) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-7 h-7 border-2 border-track border-t-primary rounded-full animate-spin" />
                    <p className="text-[12px] text-muted-foreground">Profil wird geladen…</p>
                </div>
            </div>
        );
    }

    if (userError || !currentUser) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="max-w-md text-center space-y-3">
                    <AlertTriangle className="w-6 h-6 mx-auto text-status-warn" />
                    <p className="text-foreground font-medium">Anmeldung konnte nicht geladen werden</p>
                    <p className="text-[12px] text-muted-foreground">
                        {userError?.message || 'Bitte die Seite neu laden. Bleibt es dabei, hilft ein Logout und Login.'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Neu laden</Button>
                </div>
            </div>
        );
    }

    if (!myEmployee) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="max-w-md text-center space-y-3">
                    <UserCircle className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="text-foreground font-medium">Kein Mitarbeitereintrag zu dieser Anmeldung</p>
                    <p className="text-[12px] text-muted-foreground">
                        Angemeldet als <span className="text-foreground">{currentUser.email}</span>. In der Mitarbeiterliste
                        gibt es dazu keinen Eintrag. Ein Manager kann die E-Mail-Adresse im Team-Bereich ergänzen, danach
                        lädt dieses Profil wieder.
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                        {employeeError ? `Abfragefehler: ${employeeError.message}` : 'Die Abfrage war erfolgreich, es fehlt nur der Eintrag.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <UserCircle className="w-12 h-12 text-status-warn" />
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Mein Profil</h1>
                        <p className="text-muted-foreground">Persönliche Informationen und Einstellungen</p>
                    </div>
                </div>

                <Card className="bg-card/50 border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Persönliche Daten</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Name</div>
                                <div className="text-foreground font-medium">{myEmployee.name}</div>
                            </div>

                            <div>
                                <div className="text-sm text-muted-foreground mb-1">Position</div>
                                <Badge className="bg-status-warn/70">{myEmployee.role}</Badge>
                            </div>

                            {myEmployee.email && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        E-Mail
                                    </div>
                                    <div className="text-foreground">{myEmployee.email}</div>
                                </div>
                            )}

                            {myEmployee.phone && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        Telefon
                                    </div>
                                    <div className="text-foreground">{myEmployee.phone}</div>
                                </div>
                            )}

                            {myEmployee.entry_date && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Eintrittsdatum
                                    </div>
                                    <div className="text-foreground">
                                        {new Date(myEmployee.entry_date).toLocaleDateString('de-DE')}
                                    </div>
                                </div>
                            )}

                            {myEmployee.contract_type && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-1">Vertragsart</div>
                                    <div className="text-foreground">{myEmployee.contract_type}</div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <MyShiftsCalendarSync
                    employeeId={myEmployee.id}
                    existingToken={myEmployee.calendar_token}
                />

                <Card className="bg-status-danger/10 border-status-danger/50">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-status-danger" />
                            Gefahrenzone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-status-danger/30">
                            <div>
                                <div className="font-medium text-foreground mb-1">Account löschen <span className="text-xs text-status-danger font-normal">(Art. 17 DSGVO)</span></div>
                                <div className="text-sm text-muted-foreground">
                                    Formale Lösch-Anfrage: Ihr Profil und alle personenbezogenen Daten werden dauerhaft gelöscht.
                                </div>
                            </div>
                            <Button
                                onClick={() => setShowDeleteDialog(true)}
                                variant="destructive"
                                className="bg-status-danger/70 hover:bg-status-danger/70"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Account löschen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-status-danger" />
                        Account löschen (Art. 17 DSGVO)?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-foreground/80">
                        Sie beantragen die dauerhafte Löschung Ihres Accounts und aller
                        personenbezogenen Daten nach Art. 17 DSGVO. <strong>Diese Aktion ist unwiderruflich.</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Ihr Mitarbeiterprofil wird dauerhaft gelöscht</li>
                            <li>Alle Schichten, Zeiteinträge und Stempelzeiten</li>
                            <li>Alle zugehörigen personenbezogenen Daten</li>
                        </ul>
                        <div className="mt-4 p-3 bg-status-danger/20 border border-status-danger/30 rounded-lg text-status-danger/25">
                            <strong>Bitte beachten:</strong> Die Lösch-Anfrage wird verarbeitet. Sie erhalten eine
                            Bestätigungs-E-Mail und werden anschließend abgemeldet.
                        </div>
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">
                            Abbrechen
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteDataMutation.mutate()}
                            disabled={deleteDataMutation.isPending}
                            className="bg-status-danger/70 hover:bg-status-danger/70 text-white"
                        >
                            {deleteDataMutation.isPending ? 'Anfrage wird gesendet…' : 'Ja, Account löschen'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}