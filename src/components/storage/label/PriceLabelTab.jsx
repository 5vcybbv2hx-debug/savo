import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { STALE } from '@/lib/queryUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    buildPriceLabelPdf, formatEuro, openPdfForPrint, qrDataUrl,
} from '@/lib/slotLabels';
import PriceLabelPreview from './PriceLabelPreview';

function volumeOf(article) {
    if (!article?.content_amount || !article?.content_unit) return '';
    return `${article.content_amount} ${article.content_unit}`;
}

export default function PriceLabelTab({ open }) {
    const { data: articles = [], isLoading } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.filter({ is_active: true }, 'name', 500),
        enabled: open,
        staleTime: STALE.SLOW,
    });

    const [search, setSearch] = useState('');
    const [articleId, setArticleId] = useState('');
    const [price, setPrice] = useState('');
    const [qr, setQr] = useState('');
    const [busy, setBusy] = useState(false);

    const article = useMemo(() => articles.find(a => a.id === articleId) || null, [articles, articleId]);
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q
            ? articles.filter(a => [a.name, a.manufacturer].filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
            : articles;
        return list.slice(0, 60);
    }, [articles, search]);

    useEffect(() => {
        if (!article?.id) { setQr(''); return; }
        let cancelled = false;
        qrDataUrl(article.id).then(url => { if (!cancelled) setQr(url); }).catch(() => {});
        return () => { cancelled = true; };
    }, [article?.id]);

    const select = (a) => {
        setArticleId(a.id);
        setPrice(a.purchase_price != null ? String(a.purchase_price) : '');
    };

    const buildDoc = async () => {
        if (!article) return null;
        return buildPriceLabelPdf([{
            name: article.name,
            price: formatEuro(price) || '—',
            volume: volumeOf(article),
            qr,
        }]);
    };

    const handleDownload = async () => {
        setBusy(true);
        try {
            const doc = await buildDoc();
            if (doc) doc.save(`preisschild_${(article.name || 'artikel').replace(/[^a-zA-Z0-9]+/g, '_')}_62x30.pdf`);
        } finally { setBusy(false); }
    };

    const handlePrint = async () => {
        setBusy(true);
        try {
            const doc = await buildDoc();
            if (doc) openPdfForPrint(doc);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Artikel suchen…"
                    className="h-9 pl-8 text-xs"
                />
            </div>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border/40">
                {isLoading && <div className="px-3 py-3 text-xs text-muted-foreground">Artikel werden geladen…</div>}
                {!isLoading && visible.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground">Keine Artikel gefunden</div>
                )}
                {visible.map(a => (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() => select(a)}
                        className={cn(
                            'w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors',
                            articleId === a.id ? 'bg-primary/10 font-medium' : 'hover:bg-secondary/40'
                        )}
                    >
                        <span className="flex-1 truncate">{a.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatEuro(a.purchase_price)}</span>
                    </button>
                ))}
            </div>

            {article && (
                <>
                    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                        <div>
                            <label className="text-[11px] text-muted-foreground">Preis (€)</label>
                            <Input
                                value={price}
                                onChange={(e) => setPrice(e.target.value.replace(',', '.'))}
                                inputMode="decimal"
                                className="h-9 text-sm"
                                placeholder="4,50"
                            />
                        </div>
                        <div className="text-[11px] text-muted-foreground pb-2">
                            {volumeOf(article) || 'ohne Volumen'}
                        </div>
                    </div>

                    <div className="bg-secondary/30 rounded-xl p-3 flex justify-center overflow-x-auto">
                        <PriceLabelPreview
                            name={article.name}
                            price={formatEuro(price) || '—'}
                            volume={volumeOf(article)}
                            qrUrl={qr}
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            onClick={handleDownload}
                            disabled={busy}
                            className="flex-1 gap-1.5"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            PDF 62 × 30 mm
                        </Button>
                        <Button variant="outline" onClick={handlePrint} disabled={busy} className="gap-1.5">
                            <Printer className="w-4 h-4" /> Drucken
                        </Button>
                    </div>
                </>
            )}

            {!article && !isLoading && (
                <p className="text-[11px] text-muted-foreground text-center py-2">
                    Artikel wählen, Preis prüfen, Etikett drucken.
                </p>
            )}
        </div>
    );
}