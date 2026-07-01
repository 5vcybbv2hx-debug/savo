/**
 * Offline Sync System
 * Handles offline mutations and syncs when back online
 */

const DB_NAME = 'BarManagerOfflineCache';
const SYNC_QUEUE_STORE = 'SyncQueue';
const DB_VERSION = 3; // v3: QuickListItem-Store fuer Offline-Cold-Start (Einkaufsliste im Getraenkemarkt)

/**
 * @typedef {Object} SyncQueueItem
 * @property {string} entityName - Name of the entity (e.g. 'TodoItem', 'Article')
 * @property {'create'|'update'|'delete'} type
 * @property {Partial<any>} data - Data payload
 * @property {string} [id] - Record ID (required for update/delete)
 * @property {'pending'|'completed'|'failed'} status
 * @property {number} timestamp
 * @property {number} retries
 * @property {string} [lastError]
 */

/**
 * @typedef {Object} SyncResult
 * @property {number} synced - Number of mutations synced successfully
 * @property {number} failed - Number of mutations that failed
 * @property {string} [error] - Overall error message if applicable
 */

// Initialize IndexedDB with SyncQueue store
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      const stores = [
        'Employee', 'Shift', 'Article', 'ShoppingList', 'RestockItem',
        'Recipe', 'Event', 'Reservation', 'CleaningTask', 'TimeEntry',
        'ClockEntry', 'TodoItem', 'CleaningArea', 'Room', 'Table',
        'Supplier', 'DailyRevenue', 'Wastage', 'WastageTemplate',
        'QuickListItem'
      ];
      
      stores.forEach(store => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
      
      // SyncQueue store for offline mutations
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

/**
 * Queue a mutation (create/update/delete) to be synced when back online
 * @param {Object} operation
 * @param {string} operation.entityName - Entity type name
 * @param {'create'|'update'|'delete'} operation.type
 * @param {Partial<any>} operation.data
 * @param {string} [operation.id]
 * @returns {Promise<boolean>} Success status
 */
export const queueMutation = async (operation) => {
  try {
    const db = await initDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    
    const queueItem = {
      entityName: operation.entityName,
      type: operation.type, // 'create', 'update', 'delete'
      data: operation.data,
      id: operation.id,
      status: 'pending',
      timestamp: Date.now(),
      retries: 0
    };
    
    store.add(queueItem);
    
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
    });
  } catch (error) {
    console.error('Queue mutation error:', error);
    return false;
  }
};

// Get pending mutations
export const getPendingMutations = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const index = store.index('status');
    const request = index.getAll('pending');
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.error('Get pending mutations error:', error);
    return [];
  }
};

// Update mutation status
export const updateMutationStatus = async (queueId, status, error = null) => {
  try {
    const db = await initDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    
    const getRequest = store.get(queueId);
    
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.status = status;
          if (error) item.lastError = error;
          item.retries = (item.retries || 0) + (status === 'pending' ? 1 : 0);
          store.put(item);
        }
      };
      
      tx.oncomplete = () => resolve(true);
    });
  } catch (error) {
    console.error('Update mutation status error:', error);
    return false;
  }
};

/**
 * Sync all pending mutations to the server
 * @param {Object} base44Instance - Base44 SDK instance
 * @returns {Promise<SyncResult>}
 */
export const syncMutations = async (base44Instance) => {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  
  try {
    const mutations = await getPendingMutations();
    let synced = 0;
    let failed = 0;
    
    for (const mutation of mutations) {
      try {
        const entity = base44Instance.entities[mutation.entityName];
        if (!entity) {
          await updateMutationStatus(mutation.id, 'failed', 'Entity not found');
          failed++;
          continue;
        }
        
        if (mutation.type === 'create') {
          await entity.create(mutation.data);
        } else if (mutation.type === 'update') {
          await entity.update(mutation.id, mutation.data);
        } else if (mutation.type === 'delete') {
          await entity.delete(mutation.id);
        }
        
        await updateMutationStatus(mutation.id, 'completed');
        synced++;
      } catch (error) {
        // Retry up to 3 times
        if (mutation.retries < 3) {
          await updateMutationStatus(mutation.id, 'pending', error.message);
        } else {
          await updateMutationStatus(mutation.id, 'failed', error.message);
        }
        failed++;
      }
    }
    
    return { synced, failed };
  } catch (error) {
    console.error('Sync error:', error);
    return { synced: 0, failed: 0, error: error.message };
  }
};

// Cache data
export const cacheData = async (storeName, data) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    await store.clear();
    
    if (Array.isArray(data)) {
      data.forEach(item => store.add(item));
    } else {
      store.add(data);
    }
    
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
    });
  } catch (error) {
    console.error('Cache error:', error);
    return false;
  }
};

// Get cached data
export const getCachedData = async (storeName) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.error('Get cache error:', error);
    return [];
  }
};

// Clear all offline data
export const clearOfflineData = async () => {
  try {
    const db = await initDB();
    const tx = db.transaction([...db.objectStoreNames], 'readwrite');
    
    for (let i = 0; i < db.objectStoreNames.length; i++) {
      tx.objectStore(db.objectStoreNames[i]).clear();
    }
    
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
    });
  } catch (error) {
    console.error('Clear offline data error:', error);
    return false;
  }
};