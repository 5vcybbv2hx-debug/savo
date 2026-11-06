import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from "@/components/ui/card";

export default function PermissionDenied({ message }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 text-center">
                <ShieldAlert className="w-16 h-16 text-status-danger mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-muted-foreground mb-2">Keine Berechtigung</h2>
                <p className="text-muted-foreground">
                    {message || 'Du hast keine Berechtigung, diese Seite zu sehen.'}
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                    Wende dich an einen Manager, wenn du Zugriff benötigst.
                </p>
            </Card>
        </div>
    );
}