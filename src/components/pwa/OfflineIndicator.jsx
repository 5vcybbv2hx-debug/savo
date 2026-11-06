import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed top-[env(safe-area-inset-top,1rem)] left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <Badge className="bg-status-danger/70 text-white px-4 py-2.5 shadow-lg flex items-center gap-2">
                <WifiOff className="w-4 h-4" />
                <span className="font-medium">Offline-Modus</span>
                <span className="text-xs opacity-75">· Daten werden synchronisiert</span>
            </Badge>
        </div>
    );
}