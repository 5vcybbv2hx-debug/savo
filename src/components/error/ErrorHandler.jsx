/**
 * Standardisiertes Error-Handling-System für alle Pages/Tabs
 * Einheitliches Pattern für Fehlerbehandlung, Retry, Benachrichtigungen
 */

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * AppError wrapper — für konsistente Fehlerbehandlung
 */
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN', details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

/**
 * useErrorHandler — Hook für vereinheitlichte Fehlerbehandlung
 */
export function useErrorHandler() {
  const handleError = (error, context = '') => {
    const message = error?.message || 'Ein Fehler ist aufgetreten';
    const code = error?.code || 'UNKNOWN';
    
    // Log für Debugging
    console.error(`[${code}] ${context}:`, error);
    
    return {
      message,
      code,
      isDeveloper: error instanceof AppError,
      canRetry: code !== 'FORBIDDEN' && code !== 'INVALID_DATA'
    };
  };
  
  return { handleError };
}

/**
 * ErrorFallback — Einheitliche Error-UI für alle Fehler
 */
export function ErrorFallback({
  error,
  onRetry = null,
  title = 'Ein Fehler ist aufgetreten',
  details = null,
  isDark = true
}) {
  const { handleError } = useErrorHandler();
  const errorInfo = handleError(error, 'ErrorFallback');
  
  return (
    <Card className={`p-6 border-status-danger/40 ${isDark ? 'bg-status-danger/5' : 'bg-status-danger/15'}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AlertCircle className="w-6 h-6 text-status-danger" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-status-danger dark:text-status-danger">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {errorInfo.message}
          </p>
          {details && (
            <p className="text-xs text-muted-foreground mt-2 font-mono bg-background/50 p-2 rounded">
              {details}
            </p>
          )}
          {onRetry && errorInfo.canRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="mt-3 text-status-danger border-status-danger/40 hover:bg-status-danger/10"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Erneut versuchen
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Fehler-Kategorisierung für Benutzer-freundliche Meldungen
 */
export const ERROR_TYPES = {
  NETWORK: { message: 'Netzwerkfehler — Bitte überprüfe deine Verbindung', retry: true },
  PERMISSION: { message: 'Du hast keine Berechtigung für diese Aktion', retry: false },
  NOT_FOUND: { message: 'Eintrag nicht gefunden', retry: false },
  VALIDATION: { message: 'Bitte überprüfe deine Eingaben', retry: false },
  SERVER: { message: 'Serverfehler — Bitte versuche es später erneut', retry: true },
  UNKNOWN: { message: 'Ein unerwarteter Fehler ist aufgetreten', retry: true }
};

/**
 * getErrorMessage — Mappe error code zu benutzerfreundlicher Meldung
 */
export function getErrorMessage(error) {
  if (!error) return ERROR_TYPES.UNKNOWN;
  
  const code = error.code || error.response?.status || 'UNKNOWN';
  
  if (code === 'ECONNABORTED' || code === 'ENOTFOUND') return ERROR_TYPES.NETWORK;
  if (code === 403 || error.message?.includes('Forbidden')) return ERROR_TYPES.PERMISSION;
  if (code === 404 || error.message?.includes('not found')) return ERROR_TYPES.NOT_FOUND;
  if (code === 400 || error.message?.includes('validation')) return ERROR_TYPES.VALIDATION;
  if (code >= 500) return ERROR_TYPES.SERVER;
  
  return ERROR_TYPES.UNKNOWN;
}