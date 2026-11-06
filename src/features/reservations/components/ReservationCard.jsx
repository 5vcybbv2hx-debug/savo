/**
 * ReservationCard.jsx
 * Example container component: fetches nothing, receives data via props.
 * Business actions are injected via callbacks — the card stays reusable.
 */
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Users, Clock, Phone, MessageSquare, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ReservationStatusBadge from './ReservationStatusBadge';

export default function ReservationCard({ reservation, onConfirm, onCancel, onDelete, isUpdating }) {
    const { customer_name, date, time, guests, phone, notes, table, status } = reservation;

    return (
        <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="font-semibold text-foreground">{customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(date), 'EEE, dd. MMM yyyy', { locale: de })}
                        </p>
                    </div>
                    <ReservationStatusBadge status={status} />
                </div>

                {/* Details */}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{time} Uhr</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{guests} Pers.</span>
                    {table && <span className="text-xs">Tisch {table}</span>}
                    {phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{phone}</span>}
                </div>

                {notes && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {notes}
                    </p>
                )}

                {/* Actions — only shown when handlers are provided */}
                {(onConfirm || onCancel || onDelete) && (
                    <div className="flex gap-2 pt-1">
                        {onConfirm && status === 'vorgemerkt' && (
                            <Button size="sm" onClick={() => onConfirm(reservation.id)} disabled={isUpdating}
                                className="flex-1 gap-1 bg-status-ok/70 hover:bg-status-ok/70 text-white text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Bestätigen
                            </Button>
                        )}
                        {onCancel && status !== 'storniert' && (
                            <Button size="sm" variant="outline" onClick={() => onCancel(reservation.id)} disabled={isUpdating}
                                className="flex-1 gap-1 text-xs border-status-danger/30 text-status-danger hover:bg-status-danger/10">
                                <XCircle className="w-3.5 h-3.5" /> Stornieren
                            </Button>
                        )}
                        {onDelete && (
                            <Button size="sm" variant="ghost" onClick={() => onDelete(reservation.id)} disabled={isUpdating}
                                className="text-muted-foreground hover:text-destructive px-2">
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}