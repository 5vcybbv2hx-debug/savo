import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Mail, Phone, Calendar, Lock, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import PinManager from '@/components/employees/PinManager';
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
    const [showPinManager, setShowPinManager] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: () => base44.auth.me()
    });

    const { data: myEmployee } = useQuery({
        queryKey: ['my-employee', currentUser?.email],
        queryFn: async () => {
            const employees = await base44.entities.Employee.filter({ email: currentUser.email });
            return employees[0];
        },
        enabled: !!currentUser
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

    if (!currentUser || !myEmployee) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="text-foreground">Lädt...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <UserCircle className="w-12 h-12 text-amber-500" />
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
                                <Badge className="bg-amber-600">{myEmployee.role}</Badge>
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

                <Card className="bg-card/50 border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Shield className="w-5 h-5 text-amber-500" />
                            Sicherheit
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border">
                            <div>
                                <div className="font-medium text-foreground mb-1">Terminal-PIN</div>
                                <div className="text-sm text-muted-foreground">
                                    {myEmployee.pin 
                                        ? 'PIN ist eingerichtet - für Zeiterfassung am Terminal' 
                                        : 'Noch keine PIN erstellt'}
                                </div>
                            </div>
                            <Button
                                onClick={() => setShowPinManager(true)}
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                {myEmployee.pin ? 'PIN ändern' : 'PIN erstellen'}
                            </Button>
                        </div>

                        <div className="p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                            <div className="text-sm text-blue-200">
                                <strong>Wichtig:</strong> Ihre PIN ist persönlich und wird für die Zeiterfassung 
                                am Terminal benötigt. Teilen Sie Ihre PIN niemals mit anderen.
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <MyShiftsCalendarSync
                    employeeId={myEmployee.id}
                    existingToken={myEmployee.calendar_token}
                />

                <Card className="bg-red-900/10 border-red-800/50">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Gefahrenzone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-red-800/30">
                            <div>
                                <div className="font-medium text-foreground mb-1">Account löschen <span className="text-xs text-red-400 font-normal">(Art. 17 DSGVO)</span></div>
                                <div className="text-sm text-muted-foreground">
                                    Formale Lösch-Anfrage: Ihr Profil und alle personenbezogenen Daten werden dauerhaft gelöscht.
                                </div>
                            </div>
                            <Button
                                onClick={() => setShowDeleteDialog(true)}
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Account löschen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {showPinManager && (
                <PinManager
                    employee={myEmployee}
                    open={showPinManager}
                    onClose={() => setShowPinManager(false)}
                    isAdmin={false}
                />
            )}

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
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
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-red-200">
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
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleteDataMutation.isPending ? 'Anfrage wird gesendet…' : 'Ja, Account löschen'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}