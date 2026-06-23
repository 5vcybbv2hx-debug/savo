import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { sendPushNotification } from '@/lib/pushService';

export default function SendNotificationModal() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sendPush, setSendPush] = useState(false);
    const [targetRoles, setTargetRoles] = useState(['admin', 'user']);

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list('name')
    });

    const sendMutation = useMutation({
        mutationFn: async () => {
            // Speichere Benachrichtigung in DB
            const notificationData = {
                title,
                message,
                type: 'general',
                target_roles: targetRoles,
                read_by: []
            };

            const notification = await base44.entities.Notification.create(notificationData);

            // Sende Push wenn aktiviert
            if (sendPush) {
                try {
                    await sendPushNotification({
                        title,
                        message,
                        target_role: targetRoles?.[0] || 'all'
                    });
                } catch (error) {
                    console.error('Push-Fehler:', error);
                    toast.warning('Benachrichtigung erstellt, aber Push-Versand fehlgeschlagen');
                }
            }

            return notification;
        },
        onSuccess: () => {
            toast.success('Benachrichtigung versendet!');
            queryClient.invalidateQueries(['notifications']);
            setTitle('');
            setMessage('');
            setSendPush(false);
            setOpen(false);
        },
        onError: (error) => {
            toast.error('Fehler beim Versenden: ' + error.message);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            toast.error('Titel und Nachricht erforderlich');
            return;
        }
        sendMutation.mutate();
    };

    const toggleRole = (role) => {
        setTargetRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm h-9">
                    <Bell className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Benachrichtigung</span>
                    <span className="sm:hidden">+</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-amber-400" />
                        Benachrichtigung senden
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label>Titel *</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="z.B. Wichtige Mitteilung"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Nachricht *</Label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Deine Benachrichtigung..."
                            rows={4}
                            required
                        />
                    </div>

                    <div className="space-y-3 py-4 border-y border-slate-700">
                        <Label className="text-sm font-medium">Zielgruppe</Label>
                        <div className="space-y-2">
                            {['admin', 'user'].map(role => (
                                <label key={role} className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={targetRoles.includes(role)}
                                        onCheckedChange={() => toggleRole(role)}
                                    />
                                    <span className="text-sm capitalize text-slate-300">
                                        {role === 'admin' ? 'Manager' : 'Mitarbeiter'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                        <Checkbox
                            id="push"
                            checked={sendPush}
                            onCheckedChange={setSendPush}
                        />
                        <label htmlFor="push" className="text-sm text-blue-300 cursor-pointer flex-1">
                            Auch als Push-Benachrichtigung senden
                        </label>
                    </div>

                    {sendPush && (
                        <Alert className="bg-blue-900/20 border-blue-800/30">
                            <AlertDescription className="text-blue-300 text-sm">
                                Wird an alle Nutzer mit aktivierten Push-Benachrichtigungen versendet
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                            disabled={sendMutation.isPending}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                            disabled={sendMutation.isPending}
                        >
                            {sendMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Wird versendet...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Senden
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}