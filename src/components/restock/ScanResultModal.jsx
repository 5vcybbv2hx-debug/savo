import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ScanResultModal — Shows scan results, disambiguation, or not-found state
 */
export default function ScanResultModal({
  open,
  onClose,
  scanCode,
  matchResult,
  allMatches,
  onSelectArticle,
  onCreateNew,
  isLoading = false,
}) {
  if (!open) return null;

  // Success: single match
  if (matchResult?.article) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-status-ok" />
              Artikel gefunden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {matchResult.article.image_url && (
              <img
                src={matchResult.article.image_url}
                alt={matchResult.article.name}
                className="w-full h-40 object-cover rounded-lg border border-border/30"
              />
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {matchResult.article.category}
              </p>
              <h2 className="text-lg font-bold">{matchResult.article.name}</h2>
              <p className="text-xs text-muted-foreground mt-2">
                Code: {scanCode}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  onSelectArticle(matchResult.article);
                  onClose();
                }}
                className="flex-1 bg-status-ok/70 hover:bg-status-ok/70"
              >
                <Plus className="w-4 h-4 mr-2" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Multiple matches: show disambiguation
  if (Array.isArray(allMatches) && allMatches.length > 1) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              {allMatches.length} Artikel gefunden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {allMatches.map((match, idx) => (
              <button
                key={match.article.id}
                onClick={() => {
                  onSelectArticle(match.article);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-accent transition-colors text-left"
              >
                {match.article.image_url && (
                  <img
                    src={match.article.image_url}
                    alt={match.article.name}
                    className="w-12 h-12 rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{match.article.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {match.article.category}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={onClose} className="w-full">
            Abbrechen
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Not found
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-status-warn" />
            Artikel nicht gefunden
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Code "{scanCode}" konnte nicht einem Artikel zugeordnet werden.
          </p>
          <p className="text-xs text-muted-foreground">
            Du kannst einen neuen Artikel anlegen oder den Code manuell eintragen.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                onCreateNew?.(scanCode);
                onClose();
              }}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neuer Artikel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}