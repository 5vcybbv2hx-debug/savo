import { QueryClient } from '@tanstack/react-query';
import { STALE, GC } from './queryUtils';
import { toast } from 'sonner';
import { normalizeError } from './errorHandler';

function isRateLimitError(error) {
	if (!error) return false;
	const msg = (error.message || '').toLowerCase();
	const status = error.status || error.response?.status;
	return status === 429 || msg.includes('rate limit') || msg.includes('too many requests');
}

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// Don't re-fetch just because the user switched tabs
			refetchOnWindowFocus: false,
			// Default stale time — overridden per-hook where needed
			staleTime: STALE.SLOW,
			// Keep unused data in memory for 15 min before GC
			gcTime: GC.DEFAULT,
			// Only retry once on error — avoids hammering the API on auth issues.
			// But NEVER retry rate-limit errors: retrying immediately makes the
			// rate limit worse and cascades into more failures.
			retry: (failureCount, error) => {
				if (isRateLimitError(error)) return false;
				return failureCount < 1;
			},
			retryDelay: 3000,
		},
		mutations: {
			// Don't retry mutations — side effects must not be duplicated
			retry: 0,
			// Global fallback error handler — fires for any mutation without its own onError
			onError: (error, _variables, _context) => {
				const normalized = normalizeError(error);
				// Don't show toast for auth errors — AuthContext handles those
				if (normalized.type === 'auth_error' || normalized.type === 'unauthorized') return;
				toast.error(normalized.userMessage || 'Aktion fehlgeschlagen', {
					description: normalized.retriable ? 'Bitte erneut versuchen.' : undefined,
					duration: 4000,
				});
			},
		},
	},
});