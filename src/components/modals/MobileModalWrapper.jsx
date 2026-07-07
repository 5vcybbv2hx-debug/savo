import React from 'react';
import { cn } from "@/lib/utils";

/**
 * MobileModalWrapper — Reusable pattern für mobile-optimierte Modals
 * 
 * Nutzer:
 * <MobileModalWrapper>
 *   <div className="flex flex-col h-full">
 *     <MobileModalHeader onClose={onClose}>Titel</MobileModalHeader>
 *     <MobileModalContent>Scroll-Inhalt</MobileModalContent>
 *     <MobileModalFooter>Action Buttons</MobileModalFooter>
 *   </div>
 * </MobileModalWrapper>
 */

export function MobileModalHeader({ children, onClose, className, onNavigate, navPosition }) {
    return (
        <div className={cn(
            "flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border/50 shrink-0 bg-background",
            className
        )}>
            <div className="text-lg font-bold text-foreground flex-1 truncate">
                {children}
            </div>
            {onNavigate && navPosition && (
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums mr-0.5 hidden sm:inline">
                        {navPosition.index + 1} / {navPosition.total}
                    </span>
                    <button
                        type="button"
                        onClick={() => onNavigate('prev')}
                        disabled={!navPosition.hasPrev}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        aria-label="Zurück"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate('next')}
                        disabled={!navPosition.hasNext}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        aria-label="Weiter"
                    >
                        ›
                    </button>
                </div>
            )}
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 ml-2"
                    aria-label="Close"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export function MobileModalContent({ children, className }) {
    return (
        <div className={cn(
            "flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-4",
            className
        )}>
            {children}
        </div>
    );
}

export function MobileModalFooter({ children, className }) {
    return (
        <div className={cn(
            "shrink-0 px-4 sm:px-4 py-4 border-t border-border/50 bg-card flex flex-col gap-3",
            className
        )}>
            {children}
        </div>
    );
}

export function MobileModalForm({ children, onSubmit, id, className }) {
    return (
        <form
            id={id}
            onSubmit={onSubmit}
            className={cn("space-y-4", className)}
        >
            {children}
        </form>
    );
}