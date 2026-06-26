/**
 * Centralized Error Handler
 * Provides mobile-friendly error messages and categorization
 */

/**
 * Categorize and normalize errors
 * @param {Error|Object} error
 * @returns {Object} Normalized error object with type, message, userMessage
 */
export function normalizeError(error) {
  // Handle null/undefined
  if (!error) {
    return {
      type: 'unknown',
      message: 'Unknown error',
      userMessage: 'Ein Fehler ist aufgetreten',
      technical: false,
      retriable: false
    };
  }

  // Handle network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      type: 'network_error',
      message: error.message,
      userMessage: 'Netzwerkfehler – Internetverbindung prüfen',
      technical: false,
      retriable: true,
      offline: true
    };
  }

  // Handle HTTP errors from SDK/API
  if (error.status) {
    const status = error.status;

    // 401 Unauthorized
    if (status === 401) {
      return {
        type: 'auth_required',
        message: 'Unauthorized',
        userMessage: 'Anmeldung erforderlich',
        technical: false,
        retriable: false,
        actionRequired: true
      };
    }

    // 403 Forbidden – check for special auth errors
    if (status === 403) {
      const reason = error.data?.extra_data?.reason;

      if (reason === 'user_not_registered') {
        return {
          type: 'user_not_registered',
          message: 'User not registered for this app',
          userMessage: 'Dein Account hat keinen Zugriff auf diese App',
          technical: false,
          retriable: false,
          actionRequired: true
        };
      }

      if (reason === 'auth_required') {
        return {
          type: 'auth_required',
          message: 'Authentication required',
          userMessage: 'Anmeldung erforderlich',
          technical: false,
          retriable: false,
          actionRequired: true
        };
      }

      return {
        type: 'forbidden',
        message: error.message || 'Forbidden',
        userMessage: 'Du hast keine Berechtigung für diese Aktion',
        technical: false,
        retriable: false
      };
    }

    // 404 Not Found
    if (status === 404) {
      return {
        type: 'not_found',
        message: error.message || 'Not found',
        userMessage: 'Diese Ressource existiert nicht',
        technical: false,
        retriable: false
      };
    }

    // 409 Conflict
    if (status === 409) {
      return {
        type: 'conflict',
        message: error.message || 'Conflict',
        userMessage: 'Diese Aktion konnte nicht ausgeführt werden – bitte versuche es erneut',
        technical: false,
        retriable: true
      };
    }

    // 429 Too Many Requests
    if (status === 429) {
      return {
        type: 'rate_limit',
        message: 'Too many requests',
        userMessage: 'Zu viele Anfragen – bitte warten und erneut versuchen',
        technical: false,
        retriable: true,
        retryAfter: parseInt(error.headers?.['retry-after'] || '5', 10)
      };
    }

    // 5xx Server errors
    if (status >= 500) {
      return {
        type: 'server_error',
        message: error.message || `Server error ${status}`,
        userMessage: 'Server-Problem – versuche es später nochmal',
        technical: false,
        retriable: true
      };
    }

    // Generic HTTP error
    return {
      type: 'http_error',
      message: error.message || `HTTP ${status}`,
      userMessage: `Fehler ${status} – bitte versuche es erneut`,
      technical: false,
      retriable: status >= 500
    };
  }

  // Handle Base44 SDK errors (e.g. "Base44Error: Rate limit exceeded")
  // These may not carry an HTTP status but the message identifies the error.
  const lowerMsg = (error.message || '').toLowerCase();
  if (lowerMsg.includes('rate limit')) {
    return {
      type: 'rate_limit',
      message: error.message || 'Rate limit exceeded',
      userMessage: 'Zu viele Anfragen – bitte warte einen Moment und versuche es erneut',
      technical: false,
      retriable: false
    };
  }

  // Handle structured errors (e.g., from validation)
  if (error.code) {
    return {
      type: error.code,
      message: error.message,
      userMessage: error.userMessage || error.message || 'Ein Fehler ist aufgetreten',
      technical: !!error.technical,
      retriable: !!error.retriable,
      details: error.details
    };
  }

  // Default fallback
  return {
    type: 'unknown',
    message: error.message || String(error),
    userMessage: 'Ein unbekannter Fehler ist aufgetreten',
    technical: false,
    retriable: false
  };
}

/**
 * Check if error is retriable
 * @param {Object} normalizedError
 * @returns {boolean}
 */
export function isRetriable(normalizedError) {
  return normalizedError.retriable === true;
}

/**
 * Check if error requires user action (e.g., login, new consent)
 * @param {Object} normalizedError
 * @returns {boolean}
 */
export function requiresAction(normalizedError) {
  return normalizedError.actionRequired === true;
}

/**
 * Get user-friendly message (never show technical details on mobile)
 * @param {Object} normalizedError
 * @returns {string}
 */
export function getUserMessage(normalizedError) {
  return normalizedError.userMessage || normalizedError.message;
}

/**
 * Alias for getUserMessage (backwards compatibility)
 */
export const friendlyMessage = getUserMessage;

/**
 * Handle offline detection
 * @returns {boolean}
 */
export function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Log error safely (don't expose sensitive data)
 * @param {string} context - Where error occurred
 * @param {Error|Object} error
 * @param {boolean} isDev - Include technical details only in dev
 */
export function logError(context, error, isDev = false) {
  const normalized = normalizeError(error);

  const logEntry = {
    timestamp: new Date().toISOString(),
    context,
    type: normalized.type,
    message: normalized.message
  };

  const isDevelopment = isDev || import.meta.env.MODE === 'development';
  if (isDevelopment) {
    logEntry.fullError = error;
    logEntry.technical = normalized;
  }

  console.error(`[${context}]`, logEntry);
}

export default {
  normalizeError,
  isRetriable,
  requiresAction,
  getUserMessage,
  isOffline,
  logError
};