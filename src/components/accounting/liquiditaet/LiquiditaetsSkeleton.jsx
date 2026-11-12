import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Ladezustand in Kartenform — kein Spinner. */
export default function LiquiditaetsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <Card key={i} className="p-4">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="mt-3 h-5 w-32" />
                        <Skeleton className="mt-2.5 h-2.5 w-20" />
                    </Card>
                ))}
            </div>
            <Card className="p-4">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="mt-4 h-[210px] w-full" />
            </Card>
            <Card className="space-y-2.5 p-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                ))}
            </Card>
        </div>
    );
}