import { useEffect } from 'react';
import { cacheData } from '@/components/utils/offlineSync';
import { base44 } from '@/api/base44Client';

export function OfflineCacheManager() {
  useEffect(() => {
    const cacheImportantData = async () => {
      try {
        const [employees, shifts, articles, recipes, events, reservations, cleaningTasks, quickListItems] = await Promise.all([
          base44.entities.Employee.list(),
          base44.entities.Shift.list('-date', 3000), // war ohne Limit; 750 Shifts im System
          base44.entities.Article.list(),
          base44.entities.Recipe.list(),
          base44.entities.Event.list(),
          base44.entities.Reservation.list(),
          base44.entities.CleaningTask.list(),
          base44.entities.QuickListItem.list('-created_date', 500) // fuer Offline-Cold-Start der Einkaufsliste
        ]).catch(err => {
          console.warn('Error caching data:', err);
          return [[], [], [], [], [], [], [], []];
        });
        
        // Cache all data
        await Promise.all([
          cacheData('Employee', employees),
          cacheData('Shift', shifts),
          cacheData('Article', articles),
          cacheData('Recipe', recipes),
          cacheData('Event', events),
          cacheData('Reservation', reservations),
          cacheData('CleaningTask', cleaningTasks),
          cacheData('QuickListItem', quickListItems)
        ]);
      } catch (error) {
        console.error('Failed to cache data:', error);
      }
    };
    
    // Cache on mount and every 5 minutes
    cacheImportantData();
    const interval = setInterval(cacheImportantData, 5 * 60 * 1000);
    
    // Handle online/offline
    const handleOnline = () => cacheImportantData();
    window.addEventListener('online', handleOnline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  return null;
}