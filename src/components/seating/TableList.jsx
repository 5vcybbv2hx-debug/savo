import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function TableList({ tables, reservations, getTableReservation, onTableClick }) {
    return (
        <div className="grid gap-4">
            {tables.length === 0 ? (
                <Card className="bg-card border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        Keine Tische definiert
                    </CardContent>
                </Card>
            ) : (
                tables.map(table => {
                    const reservation = getTableReservation(table.id);

                    return (
                        <button
                            key={table.id}
                            onClick={() => onTableClick(table)}
                            className="w-full text-left"
                        >
                            <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-semibold text-foreground">
                                                    Tisch {table.table_number}
                                                </h3>
                                                <Badge className={reservation ? "bg-status-warn/30 text-status-warn border-status-warn/70" : "bg-status-ok/30 text-status-ok border-status-ok/70"}>
                                                    {reservation ? 'Reserviert' : 'Frei'}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                Kapazität: {table.capacity} {table.capacity === 1 ? 'Person' : 'Personen'}
                                            </div>
                                            {table.section && (
                                                <div className="text-sm text-muted-foreground">
                                                    Bereich: {table.section}
                                                </div>
                                            )}
                                            {reservation && (
                                                <div className="text-sm text-status-warn mt-2">
                                                    Gast: {reservation.customer_name} • {reservation.guests} Personen • {reservation.time} Uhr
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </button>
                    );
                })
            )}
        </div>
    );
}