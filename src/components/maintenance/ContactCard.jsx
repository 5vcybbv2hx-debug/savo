import React from 'react';
import { Phone, Mail, MapPin, Trash2, Edit2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ContactCard({ contact, onEdit, onDelete, isPrimary }) {
    return (
        <div className={cn(
            "rounded-xl border p-4 space-y-3",
            isPrimary ? "bg-status-warn/10 border-status-warn/30" : "bg-card border-border/50"
        )}>
            {/* Header mit Primary-Badge */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground truncate">{contact.company_name}</h4>
                        {isPrimary && (
                            <Star className="w-4 h-4 text-status-warn fill-status-warn shrink-0" />
                        )}
                    </div>
                    {contact.contact_person && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{contact.contact_person}</p>
                    )}
                </div>
            </div>

            {/* Kontaktinformationen */}
            <div className="space-y-2">
                {contact.phone && (
                    <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span className="break-all">{contact.phone}</span>
                    </a>
                )}
                {contact.mobile && (
                    <a
                        href={`tel:${contact.mobile}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span className="break-all">{contact.mobile}</span>
                    </a>
                )}
                {contact.email && (
                    <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="break-all">{contact.email}</span>
                    </a>
                )}
            </div>

            {/* Rolle und Notiz */}
            <div className="space-y-1 text-sm">
                {contact.role && (
                    <p className="text-xs bg-muted/50 px-2 py-1 rounded text-muted-foreground inline-block">
                        {contact.role}
                    </p>
                )}
                {contact.note && (
                    <p className="text-xs text-muted-foreground italic">{contact.note}</p>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onEdit}
                    className="flex-1 h-9"
                >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Bearbeiten
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="flex-1 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}