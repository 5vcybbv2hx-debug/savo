import { Lightbulb, StickyNote } from 'lucide-react';
import CopyField from '@/components/accounting/schulden/CopyField';
import { SAVO_BLUE } from '@/lib/offenePosten';

/** Aufklappbarer Detailbereich: Bankdaten mit Copy, Notizen, Empfehlung. */
export default function PostenDetails({ posten }) {
    const hasBank = !!(posten.iban || posten.bic || posten.verwendungszweck);
    const hasContent = hasBank || posten.notizen || posten.empfehlung || posten.brief_nr;

    if (!hasContent) {
        return (
            <p className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground">
                Keine weiteren Angaben hinterlegt.
            </p>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
            {posten.brief_nr && (
                <p className="text-[11px] text-muted-foreground">
                    Schreiben: <span className="font-medium text-foreground">{posten.brief_nr}</span>
                </p>
            )}

            {hasBank && (
                <div className="space-y-1.5">
                    <CopyField label="IBAN" value={posten.iban} />
                    <CopyField label="BIC" value={posten.bic} />
                    <CopyField label="Verwendungszweck" value={posten.verwendungszweck} />
                </div>
            )}

            {posten.notizen && (
                <div className="flex gap-2">
                    <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-foreground whitespace-pre-line">{posten.notizen}</p>
                </div>
            )}

            {posten.empfehlung && (
                <div
                    className="flex gap-2 rounded-lg border px-2.5 py-2"
                    style={{ borderColor: 'rgba(0,153,219,0.25)', backgroundColor: 'rgba(0,153,219,0.07)' }}
                >
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: SAVO_BLUE }} />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: SAVO_BLUE }}>
                            Empfehlung
                        </p>
                        <p className="text-xs text-foreground mt-0.5 whitespace-pre-line">{posten.empfehlung}</p>
                    </div>
                </div>
            )}
        </div>
    );
}