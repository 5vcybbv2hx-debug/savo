import React, { useState } from 'react';
import { X, Eye } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AttachmentGallery({ attachments = [], onDelete = null, readOnly = false }) {
    const [previewUrl, setPreviewUrl] = useState(null);

    if (!attachments || attachments.length === 0) return null;

    return (
        <>
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Anhänge ({attachments.length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {attachments.map((att) => (
                        <div
                            key={att.id}
                            className="relative group rounded-xl overflow-hidden bg-secondary/30 aspect-square border border-border/40 hover:border-border transition-all"
                        >
                            <img
                                src={att.thumbnail_url || att.url}
                                alt={att.type === 'sketch' ? 'Skizze' : 'Foto'}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100">
                                <button
                                    onClick={() => setPreviewUrl(att.url)}
                                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-900 transition-all"
                                    title="Ansehen"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                {!readOnly && (
                                    <button
                                        onClick={() => onDelete(att.id)}
                                        className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-white transition-all"
                                        title="Löschen"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/50 text-white uppercase">
                                {att.type === 'sketch' ? '✏️' : '📷'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fullscreen Preview */}
            {previewUrl && (
                <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
                    <DialogContent className="max-w-2xl p-0 bg-black border-0 rounded-xl">
                        <button
                            onClick={() => setPreviewUrl(null)}
                            className="absolute top-3 right-3 z-50 p-2 rounded-lg bg-white/20 hover:bg-white/40 text-white transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img src={previewUrl} alt="Preview" className="w-full h-auto rounded-xl" />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}