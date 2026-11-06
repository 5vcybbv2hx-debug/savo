import React, { useEffect, useState } from 'react';
import { syncMutations, getPendingMutations } from '@/components/utils/offlineSync';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Global component to manage offline sync
 * Shows sync status and pending mutations
 */
export default function OfflineSyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncStatus, setLastSyncStatus] = useState(null);

  // Check pending mutations
  useEffect(() => {
    const checkPending = async () => {
      const pending = await getPendingMutations();
      setPendingCount(pending.length);
    };
    
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync when online
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const result = await syncMutations(base44);
        setLastSyncStatus(result);
        setPendingCount(0);
      } catch (err) {
        console.error('Sync failed:', err);
        setLastSyncStatus({ error: err.message });
      } finally {
        setIsSyncing(false);
      }
    };
    
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-[5.5rem] md:bottom-4 right-4 z-40 bg-status-warn/90 text-status-warn px-4 py-3 rounded-lg shadow-lg border border-status-warn/50 backdrop-blur-sm max-w-xs">
        <p className="text-sm font-semibold">Offline Mode</p>
        {pendingCount > 0 && (
          <p className="text-xs mt-1 opacity-90">
            {pendingCount} Änderung{pendingCount > 1 ? 'en' : ''} in der Warteschlange
          </p>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-[5.5rem] md:bottom-4 right-4 z-40 bg-primary/90 text-primary px-4 py-3 rounded-lg shadow-lg border border-primary/50 backdrop-blur-sm flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-semibold">Synchronisiere...</span>
      </div>
    );
  }

  if (lastSyncStatus?.synced > 0) {
    return (
      <div className="fixed bottom-[5.5rem] md:bottom-4 right-4 z-40 bg-status-ok/90 text-status-ok px-4 py-3 rounded-lg shadow-lg border border-status-ok/50 backdrop-blur-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-semibold">
          {lastSyncStatus.synced} Änderung{lastSyncStatus.synced > 1 ? 'en' : ''} synced
        </span>
      </div>
    );
  }

  if (lastSyncStatus?.error || (lastSyncStatus?.failed > 0)) {
    return (
      <div className="fixed bottom-[5.5rem] md:bottom-4 right-4 z-40 bg-status-danger/90 text-status-danger px-4 py-3 rounded-lg shadow-lg border border-status-danger/50 backdrop-blur-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-semibold">Sync-Fehler</span>
      </div>
    );
  }

  return null;
}