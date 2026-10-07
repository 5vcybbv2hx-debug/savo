import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Settings, Save, RotateCcw, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { CATEGORY_LABELS, DEFAULT_SETTINGS } from '@/lib/notificationUtils';
import { cn } from "@/lib/utils";
import { toast } from 'react-hot-toast';

function PushDeviceToggle() {
  const [status, setStatus] = React.useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const handleEnable = async () => {
    if (!window.OneSignal) { toast.error('Push-Service nicht verfügbar'); return; }
    try {
      await window.OneSignal.User.PushSubscription.optIn();
      setStatus('granted');
      toast.success('Push-Benachrichtigungen aktiviert ✓');
    } catch (err) {
      toast.error('Aktivierung fehlgeschlagen');
    }
  };

  const handleDisable = async () => {
    if (!window.OneSignal) return;
    try {
      await window.OneSignal.User.PushSubscription.optOut();
      setStatus('denied');
      toast.success('Push-Benachrichtigungen deaktiviert');
    } catch (err) {
      console.error(err);
    }
  };

  if (status === 'unsupported') return <span className="text-xs text-muted-foreground">Nicht unterstützt</span>;

  if (status === 'denied') return (
    <div className="flex items-center gap-2">
      <XCircle className="w-4 h-4 text-destructive" />
      <span className="text-xs text-muted-foreground">Blockiert — in Browser-Einstellungen ändern</span>
    </div>
  );

  if (status === 'granted') return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-primary" />
      <Button variant="outline" size="sm" onClick={handleDisable} className="min-h-[44px]">
        Deaktivieren
      </Button>
    </div>
  );

  return <Button size="sm" onClick={handleEnable} className="min-h-[44px]">Aktivieren</Button>;
}

export default function NotificationSettings() {
    const queryClient = useQueryClient();
    const [localSettings, setLocalSettings] = useState(null);

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW
    });

    const { data: settings } = useQuery({
        queryKey: ['notificationSettings', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return null;
            const found = await base44.entities.NotificationSettings.filter({
                user_email: currentUser.email
            });
            return found.length > 0 ? found[0] : null;
        },
        enabled: !!currentUser?.email
    });

    useEffect(() => {
        if (settings) {
            setLocalSettings({
                ...DEFAULT_SETTINGS,
                ...settings,
                categories: {
                    ...DEFAULT_SETTINGS.categories,
                    ...settings?.categories
                }
            });
        } else if (!localSettings && currentUser) {
            setLocalSettings(DEFAULT_SETTINGS);
        }
    }, [settings, currentUser]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (settings?.id) {
                await base44.entities.NotificationSettings.update(settings.id, data);
            } else {
                await base44.entities.NotificationSettings.create({
                    user_email: currentUser.email,
                    ...data
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
        }
    });

    const handleCategoryToggle = (category) => {
        setLocalSettings(prev => ({
            ...prev,
            categories: {
                ...prev.categories,
                [category]: !prev.categories[category]
            }
        }));
    };

    const handleSave = async () => {
        await saveMutation.mutateAsync({
            categories: localSettings.categories,
            min_priority: localSettings.min_priority,
            only_assigned_tasks: localSettings.only_assigned_tasks
        });
    };

    const handleReset = () => {
        setLocalSettings({
            ...DEFAULT_SETTINGS,
            ...settings,
            categories: {
                ...DEFAULT_SETTINGS.categories,
                ...settings?.categories
            }
        });
    };

    const enabledCategoriesCount = Object.values(localSettings?.categories || {}).filter(Boolean).length;
    const totalCategories = Object.keys(DEFAULT_SETTINGS.categories).length;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-0">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                            <Settings className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Benachrichtigungen</h1>
                            <p className="text-sm text-muted-foreground">Passe deine Benachrichtigungseinstellungen an</p>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {localSettings && (
                    <div className="space-y-6">
                        {/* Push auf diesem Gerät */}
                        <Card className="p-5 mb-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Smartphone className="w-5 h-5 text-primary" />
                              <div>
                                <p className="font-semibold text-foreground">Push auf diesem Gerät</p>
                                <p className="text-sm text-muted-foreground">
                                  Benachrichtigungen auch wenn die App geschlossen ist
                                </p>
                              </div>
                            </div>
                            <PushDeviceToggle />
                          </div>
                        </Card>

                        {/* Kategorien Sektion */}
                        <Card className="p-6 border-border">
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-amber-500" />
                                    Kategorien
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Wähle, welche Benachrichtigungen du erhalten möchtest
                                </p>
                            </div>

                            <div className="space-y-3">
                                {Object.entries(DEFAULT_SETTINGS.categories).map(([category, _]) => (
                                    <div key={category} className="flex items-center justify-between p-4 rounded-lg bg-card border border-border/50 hover:border-border transition-colors">
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-medium text-foreground cursor-pointer">
                                                {CATEGORY_LABELS[category]}
                                            </label>
                                        </div>
                                        <Switch
                                            checked={localSettings.categories[category] ?? true}
                                            onCheckedChange={() => handleCategoryToggle(category)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs sm:text-sm text-blue-200">
                                    ℹ️ Aktiviert: <strong>{enabledCategoriesCount}/{totalCategories}</strong> Kategorien
                                </p>
                            </div>
                        </Card>

                        {/* Priorität Sektion */}
                        <Card className="p-6 border-border">
                            <h2 className="text-lg font-semibold text-foreground mb-4">Mindestpriorität</h2>
                            <p className="text-sm text-muted-foreground mb-4">
                                Zeige nur Benachrichtigungen mit dieser oder höherer Priorität
                            </p>

                            <div className="space-y-2">
                                {[
                                    { value: 'info', label: 'ℹ️ Info & höher', desc: 'Alle Benachrichtigungen' },
                                    { value: 'wichtig', label: '⭐ Wichtig & höher', desc: 'Nur wichtige und kritische' },
                                    { value: 'kritisch', label: '🚨 Nur kritisch', desc: 'Nur kritische Benachrichtigungen' }
                                ].map(option => (
                                    <label key={option.value} className="flex items-center p-3 rounded-lg border border-border/50 hover:border-border cursor-pointer transition-colors">
                                        <input
                                            type="radio"
                                            name="priority"
                                            value={option.value}
                                            checked={localSettings.min_priority === option.value}
                                            onChange={(e) => setLocalSettings(prev => ({
                                                ...prev,
                                                min_priority: e.target.value
                                            }))}
                                            className="w-4 h-4"
                                        />
                                        <div className="ml-3 flex-1">
                                            <p className="text-sm font-medium text-foreground">{option.label}</p>
                                            <p className="text-xs text-muted-foreground">{option.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </Card>

                        {/* Aufgaben Filter */}
                        <Card className="p-6 border-border">
                            <h2 className="text-lg font-semibold text-foreground mb-4">Aufgaben-Filter</h2>
                            
                            <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border/50">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Nur mir zugewiesene Aufgaben</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Zeige nur Benachrichtigungen für dich zugewiesene Aufgaben
                                    </p>
                                </div>
                                <Switch
                                    checked={localSettings.only_assigned_tasks ?? true}
                                    onCheckedChange={(checked) => setLocalSettings(prev => ({
                                        ...prev,
                                        only_assigned_tasks: checked
                                    }))}
                                />
                            </div>
                        </Card>

                        {/* Info Box */}
                        <Card className="p-4 bg-amber-500/10 border border-amber-500/20">
                            <div className="flex gap-3">
                                <span className="text-lg">💡</span>
                                <div className="text-sm text-amber-200">
                                    <p className="font-semibold mb-1">Kritische Benachrichtigungen</p>
                                    <p>
                                        Benachrichtigungen mit "Kritisch" Priorität können nicht ausgeblendet werden und werden dir immer angezeigt.
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={saveMutation.isPending}
                                className="flex-1 bg-amber-600 hover:bg-amber-700"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {saveMutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
                            </Button>
                            <Button
                                onClick={handleReset}
                                variant="outline"
                                className="flex-1"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Zurücksetzen
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}