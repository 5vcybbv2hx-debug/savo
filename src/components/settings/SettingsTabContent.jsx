import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Clock, Globe, Download, Trash2, Info, Palette, Calendar, Bell, CheckSquare, AlertTriangle, Users, Package, Sparkles, Volume2, Printer } from 'lucide-react';
import CompanyInfoEditor from '@/components/settings/CompanyInfoEditor';
import CalendarExportTab from '@/components/settings/CalendarExportTab';
import PrintSettingsTab from '@/components/settings/PrintSettingsTab';
import BrandingTab from '@/components/settings/BrandingTab';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import BackupManager from '@/components/backup/BackupManager';
import { usePermissions } from '@/components/auth/usePermissions';
import LiveSyncInstructions from '@/components/calendar/LiveSyncInstructions';

const notificationTypes = [
    { key: 'tasks_assigned', icon: CheckSquare, title: 'Aufgaben zugewiesen', description: 'Benachrichtigung wenn dir eine neue Aufgabe zugewiesen wurde', color: 'text-blue-400' },
    { key: 'tasks_deadline', icon: AlertTriangle, title: 'Fällige Aufgaben', description: 'Erinnerung an Aufgaben die bald fällig sind (1 Tag vorher)', color: 'text-red-400' },
    { key: 'shifts_reminder', icon: Calendar, title: 'Schicht-Erinnerung', description: 'Erinnerung an deine nächste Schicht (4 Stunden vorher)', color: 'text-amber-400' },
    { key: 'shifts_swap', icon: Users, title: 'Schichttausch', description: 'Benachrichtigung bei neuen Schichttausch-Anfragen', color: 'text-purple-400' },
    { key: 'cleaning_overdue', icon: Sparkles, title: 'Überfällige Reinigung', description: 'Hinweis wenn Reinigungsaufgaben überfällig sind', color: 'text-green-400' },
    { key: 'inventory_low', icon: Package, title: 'Niedriger Bestand', description: 'Warnung bei Artikeln unter Mindestbestand', color: 'text-orange-400' },
    { key: 'maintenance_due', icon: AlertTriangle, title: 'Wartung fällig', description: 'Erinnerung an fällige Wartungsaufgaben (7 Tage vorher)', color: 'text-yellow-400' },
    { key: 'general_updates', icon: Bell, title: 'Allgemeine Updates', description: 'Wichtige Ankündigungen und Systemnachrichten', color: 'text-muted-foreground' }
];

const themes = [
    { value: 'light', label: 'Hell', icon: Sun, description: 'Heller Modus' },
    { value: 'dark', label: 'Dunkel', icon: Moon, description: 'Dunkler Modus' },
    { value: 'system', label: 'System', icon: Monitor, description: 'Folgt den Systemeinstellungen' }
];

export default function SettingsTabContent() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();

    const { data: company } = useQuery({
        queryKey: ['company-info'],
        queryFn: () => base44.entities.CompanyInfo.list().then(r => r[0] || null),
    });

    const [theme, setTheme] = useState('system');
    const [timeFormat, setTimeFormat] = useState('24h');
    const [dateFormat, setDateFormat] = useState('de');
    const [language, setLanguage] = useState('de');
    const [appVersion] = useState('1.0.0');

    // Notification state (user.notification_preferences)
    const [currentUser, setCurrentUser] = useState(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [barcodeSoundEnabled, setBarcodeSoundEnabled] = useState(true);
    const [notifPreferences, setNotifPreferences] = useState({
        tasks_assigned: true, tasks_deadline: true, shifts_reminder: true, shifts_swap: true,
        cleaning_overdue: true, inventory_low: true, maintenance_due: true, general_updates: true
    });

    useEffect(() => {
        setTheme(localStorage.getItem('theme') || 'system');
        setTimeFormat(localStorage.getItem('timeFormat') || '24h');
        setDateFormat(localStorage.getItem('dateFormat') || 'de');
        setLanguage(localStorage.getItem('language') || 'de');
        applyTheme(localStorage.getItem('theme') || 'system');

        base44.auth.me().then(user => {
            setCurrentUser(user);
            if (user.notification_preferences) {
                setNotifPreferences(prev => ({ ...prev, ...user.notification_preferences }));
                setSoundEnabled(user.notification_preferences.sound_enabled !== false);
                setVibrationEnabled(user.notification_preferences.vibration_enabled !== false);
                setBarcodeSoundEnabled(user.notification_preferences.barcode_sound !== false);
            }
        }).catch(() => {});
    }, []);

    const applyTheme = (newTheme) => {
        const root = document.documentElement;
        if (newTheme === 'system') {
            root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        } else if (newTheme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    };

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    const handleSettingChange = (key, value, storageKey) => {
        const setters = { timeFormat: setTimeFormat, dateFormat: setDateFormat, language: setLanguage };
        if (setters[key]) {
            setters[key](value);
            localStorage.setItem(storageKey || key, value);
        }
    };

    const saveNotifMutation = useMutation({
        mutationFn: () => base44.auth.updateMe({
            notification_preferences: {
                ...notifPreferences,
                sound_enabled: soundEnabled,
                vibration_enabled: vibrationEnabled,
                barcode_sound: barcodeSoundEnabled,
            }
        }),
        onSuccess: () => toast.success('Benachrichtigungseinstellungen gespeichert'),
        onError: () => toast.error('Fehler beim Speichern')
    });

    const exportDataMutation = useMutation({
        mutationFn: async () => base44.functions.invoke('exportUserData', {}),
        onSuccess: (data) => {
            const element = document.createElement('a');
            element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(data.data, null, 2))}`);
            element.setAttribute('download', `backup-${new Date().toISOString().split('T')[0]}.json`);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            toast.success('Daten exportiert');
        },
        onError: () => toast.error('Fehler beim Exportieren')
    });

    const deleteAccountMutation = useMutation({
        mutationFn: () => base44.functions.invoke('deleteMyAccount', {}),
        onSuccess: () => { toast.success('Account wird gelöscht...'); setTimeout(() => base44.auth.logout(), 2000); },
        onError: () => toast.error('Fehler beim Löschen des Accounts')
    });

    return (
        <div className="space-y-8">
            {/* Darstellung */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5" /> Farbschema
                </h2>
                <Card className="p-6 bg-card border-border">
                    <p className="text-sm text-muted-foreground mb-6">Wähle das Erscheinungsbild der App</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {themes.map((themeOption, tIdx) => {
                            const Icon = themeOption.icon;
                            const isActive = theme === themeOption.value;
                            return (
                                <button
                                    key={themeOption.value}
                                    onClick={() => handleThemeChange(themeOption.value)}
                                    style={{ '--delay': `${tIdx * 40}ms` }}
                                    className={`relative p-4 rounded-xl border-2 transition-all ${isActive ? 'scale-105 bg-card' : 'border-border bg-secondary hover:bg-accent'}`}
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className={`p-3 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                                            <Icon className={`w-6 h-6 ${isActive ? 'brand-text' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium mb-1 text-foreground">{themeOption.label}</p>
                                            <p className="text-xs text-muted-foreground">{themeOption.description}</p>
                                        </div>
                                        {isActive && <div className="absolute top-3 right-3 w-2 h-2 rounded-full brand-gradient" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            </section>

            {/* Zeit & Datum */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" /> Zeit & Datum
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="p-4 bg-card border-border">
                        <Label htmlFor="timeFormat" className="text-sm font-medium text-foreground mb-2 block">Zeitformat</Label>
                        <Select value={timeFormat} onValueChange={(val) => handleSettingChange('timeFormat', val)}>
                            <SelectTrigger id="timeFormat"><SelectValue placeholder="Zeitformat wählen" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="24h">24-Stunden (14:30)</SelectItem>
                                <SelectItem value="12h">12-Stunden (02:30 PM)</SelectItem>
                            </SelectContent>
                        </Select>
                    </Card>
                    <Card className="p-4 bg-card border-border">
                        <Label htmlFor="dateFormat" className="text-sm font-medium text-foreground mb-2 block">Datumsformat</Label>
                        <Select value={dateFormat} onValueChange={(val) => handleSettingChange('dateFormat', val)}>
                            <SelectTrigger id="dateFormat"><SelectValue placeholder="Datumsformat wählen" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="de">Deutsch (06.02.2026)</SelectItem>
                                <SelectItem value="en">Englisch (02/06/2026)</SelectItem>
                                <SelectItem value="iso">ISO (2026-02-06)</SelectItem>
                            </SelectContent>
                        </Select>
                    </Card>
                </div>
            </section>

            {/* Sprache */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5" /> Sprache
                </h2>
                <Card className="p-4 bg-card border-border">
                    <Label htmlFor="language" className="text-sm font-medium text-foreground mb-2 block">App-Sprache</Label>
                    <Select value={language} onValueChange={(val) => handleSettingChange('language', val)}>
                        <SelectTrigger id="language"><SelectValue placeholder="Sprache wählen" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="de">Deutsch</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">Noch nicht vollständig implementiert</p>
                </Card>
            </section>

            {/* Branding (Manager/Admin) */}
            {(permissions.isManager || permissions.isAdmin) && (
                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Palette className="w-5 h-5" /> Branding
                    </h2>
                    <BrandingTab
                        company={company}
                        onSave={async (data) => {
                            if (company?.id) {
                                await base44.entities.CompanyInfo.update(company.id, data);
                            } else {
                                await base44.entities.CompanyInfo.create(data);
                            }
                            queryClient.invalidateQueries({ queryKey: ['company-info'] });
                        }}
                    />
                </section>
            )}

            {/* Betriebsdaten (Manager/Admin) */}
            {(permissions.isManager || permissions.isAdmin) && (
                <section>
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" /> Betriebsdaten
                    </h2>
                    <CompanyInfoEditor />
                </section>
            )}

            {/* Kalender */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" /> Kalender
                </h2>
                <CalendarExportTab activeTab="calendar" />
                <Card className="p-6 bg-card border-border mt-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
                            <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-2">Live-Synchronisation</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Verbinde deinen Kalender mit einem Live-Feed, der automatisch aktualisiert wird, wenn sich Termine ändern.
                            </p>
                            <LiveSyncInstructions />
                        </div>
                    </div>
                </Card>
            </section>

            {/* Druck */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Printer className="w-5 h-5" /> Drucken
                </h2>
                <PrintSettingsTab />
            </section>

            {/* Benachrichtigungstypen & Töne */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5" /> Benachrichtigungen
                </h2>
                {currentUser && (
                    <Card className="p-6 bg-card border-border mb-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-foreground font-semibold mb-1">Push-Benachrichtigungen</h3>
                                <p className="text-sm text-muted-foreground">Aktiviere Push-Benachrichtigungen für Echtzeit-Meldungen auf deinem Gerät</p>
                            </div>
                            <Button size="sm" onClick={() => { localStorage.removeItem('push_prompt_seen'); window.location.reload(); }} variant="outline">
                                Erneut fragen
                            </Button>
                        </div>
                    </Card>
                )}
                <div className="space-y-3">
                    {notificationTypes.map((type, nIdx) => {
                        const Icon = type.icon;
                        return (
                            <Card key={type.key} className="p-4 bg-card border-border animate-stagger" style={{ '--delay': `${nIdx * 50}ms` }}>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-secondary rounded-lg shrink-0">
                                        <Icon className={`w-5 h-5 ${type.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <Label htmlFor={type.key} className="text-foreground font-medium cursor-pointer">{type.title}</Label>
                                        <p className="text-sm text-muted-foreground mt-0.5">{type.description}</p>
                                    </div>
                                    <Switch
                                        id={type.key}
                                        checked={notifPreferences[type.key]}
                                        onCheckedChange={() => setNotifPreferences(prev => ({ ...prev, [type.key]: !prev[type.key] }))}
                                        className="shrink-0"
                                    />
                                </div>
                            </Card>
                        );
                    })}
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={() => saveNotifMutation.mutate()} disabled={saveNotifMutation.isPending}>
                        {saveNotifMutation.isPending ? 'Speichern...' : 'Einstellungen speichern'}
                    </Button>
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-4 flex items-center gap-2">
                    <Volume2 className="w-5 h-5" /> Töne & Vibrationen
                </h3>
                <div className="space-y-3">
                    <Card className="p-4 bg-card border-border">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground">Benachrichtigungstöne</Label>
                            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Töne bei neuen Benachrichtigungen abspielen</p>
                    </Card>
                    <Card className="p-4 bg-card border-border">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground">Vibrationen</Label>
                            <Switch checked={vibrationEnabled} onCheckedChange={setVibrationEnabled} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Gerät vibrieren lassen bei Benachrichtigungen</p>
                    </Card>
                    <Card className="p-4 bg-card border-border">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground">Barcode-Scanner Ton</Label>
                            <Switch checked={barcodeSoundEnabled} onCheckedChange={setBarcodeSoundEnabled} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ton beim Scannen von Barcodes abspielen</p>
                    </Card>
                </div>
            </section>

            {/* Sicherung */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5" /> Sicherung
                </h2>
                <Card className="p-6 bg-card border-border">
                    <p className="text-sm text-muted-foreground mb-4">Erstelle Sicherungen deiner Daten und exportiere Informationen.</p>
                    <BackupManager />
                </Card>
            </section>

            {/* Daten */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5" /> Daten
                </h2>
                <div className="space-y-3">
                    <Card className="p-4 bg-card border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium text-foreground">Daten exportieren</Label>
                                <p className="text-xs text-muted-foreground mt-1">Speichere ein Backup deiner Daten als JSON</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => exportDataMutation.mutate()} disabled={exportDataMutation.isPending} className="gap-2">
                                <Download className="w-4 h-4" />
                                {exportDataMutation.isPending ? 'Lädt...' : 'Export'}
                            </Button>
                        </div>
                    </Card>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Card className="p-4 bg-red-500/10 border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-sm font-medium text-red-400">Account löschen</Label>
                                        <p className="text-xs text-red-300/70 mt-1">Löscht deinen Account und alle Daten</p>
                                    </div>
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </div>
                            </Card>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Account löschen?</AlertDialogTitle>
                                <AlertDialogDescription>Dies kann nicht rückgängig gemacht werden. Alle deine Daten werden permanent gelöscht.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAccountMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </section>

            {/* Über die App */}
            <section>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5" /> Über die App
                </h2>
                <Card className="p-6 bg-card border-border space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Version</span>
                        <span className="font-semibold text-foreground">{appVersion}</span>
                    </div>
                    <div className="border-t border-border pt-4">
                        <p className="text-xs text-muted-foreground">BarManager - Professionelle Bar-Management Software</p>
                    </div>
                </Card>
            </section>
        </div>
    );
}