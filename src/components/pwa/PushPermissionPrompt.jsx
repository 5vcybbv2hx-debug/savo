import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROMPT_KEY = 'push_prompt_dismissed_v2';
// Zeigt sich nur wenn: PWA installiert, noch kein opt-in, noch nicht weggeklickt
export default function PushPermissionPrompt({ isAuthenticated }) {
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') return;
        if (Notification.permission === 'denied') return;
        if (sessionStorage.getItem(PROMPT_KEY)) return;

        // Kurz warten damit das Login-UI fertig gerendert ist
        const t = setTimeout(() => setShow(true), 2500);
        return () => clearTimeout(t);
    }, [isAuthenticated]);

    const handleEnable = async () => {
        setLoading(true);
        try {
            if (window.OneSignal?.User?.PushSubscription) {
                await window.OneSignal.User.PushSubscription.optIn();
            } else {
                await Notification.requestPermission();
            }
            setDone(true);
            setTimeout(() => setShow(false), 1800);
        } catch {
            setShow(false);
        } finally {
            setLoading(false);
            sessionStorage.setItem(PROMPT_KEY, '1');
        }
    };

    const handleDismiss = () => {
        sessionStorage.setItem(PROMPT_KEY, '1');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className={cn(
            'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm',
            'bg-card border border-border rounded-2xl shadow-2xl p-4',
            'animate-in slide-in-from-bottom-4 duration-300'
        )}>
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    {done ? (
                        <p className="text-sm font-semibold text-foreground">✅ Aktiviert!</p>
                    ) : (
                        <>
                            <p className="text-sm font-semibold text-foreground leading-tight">
                                Schicht-Benachrichtigungen aktivieren
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Erhalte Push-Nachrichten bei neuen Schichten, Tauschgesuchen & Aufgaben.
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleEnable}
                                    disabled={loading}
                                    className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60">
                                    {loading ? 'Wird aktiviert…' : 'Jetzt aktivieren'}
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground">
                                    Später
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
