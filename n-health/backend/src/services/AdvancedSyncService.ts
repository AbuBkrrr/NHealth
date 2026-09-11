import Dexie, { Table } from 'dexie';

export interface SyncQueueItem {
  id?: number;
  type: 'APPOINTMENT' | 'PHARMACY_ORDER' | 'EMERGENCY' | 'NURSE_REQUEST' | 'LAB_TEST' | 'PAYMENT' | 'MESSAGE';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL';
  payload: any;
  endpoint: string;
  userId: string;
  createdAt: number;
  attempt: number;
  maxRetries: number;
  synced: boolean;
  error?: string;
  syncedAt?: number;
}

export interface CachedData {
  id?: number;
  key: string; // e.g., 'appointments:user123', 'profile:doctor456'
  data: any;
  expiresAt: number; // timestamp when cache should invalidate
  type: 'READ' | 'WRITE'; // READ = API response cache, WRITE = pending sync
  userId: string;
}

export class SyncDatabase extends Dexie {
  syncQueue!: Table<SyncQueueItem>;
  cachedData!: Table<CachedData>;

  constructor() {
    super('NHealthSyncDB');
    this.version(1).stores({
      syncQueue: '++id, userId, synced, createdAt, type',
      cachedData: '++id, key, userId, expiresAt, type'
    });
  }
}

/**
 * Advanced sync and offline service
 * Manages both read caching and write queue for offline-first architecture
 */
export class AdvancedSyncService {
  private static instance: AdvancedSyncService;
  private db: SyncDatabase;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInterval: NodeJS.Timer | null = null;
  private retryInterval: NodeJS.Timer | null = null;
  private currentUserId: string = '';

  private constructor() {
    this.db = new SyncDatabase();
    this.setupNetworkListeners();
    this.startSync();
  }

  static getInstance(): AdvancedSyncService {
    if (!AdvancedSyncService.instance) {
      AdvancedSyncService.instance = new AdvancedSyncService();
    }
    return AdvancedSyncService.instance;
  }

  /**
   * Initialize with user ID (call on login)
   */
  setCurrentUser(userId: string) {
    this.currentUserId = userId;
  }

  /**
   * Listen to network state changes
   */
  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🟢 Back online - starting sync');
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔴 Went offline - queuing operations');
    });
  }

  /**
   * Cache data with automatic expiration
   * @param key - Cache key (e.g., 'appointments:userId')
   * @param data - Data to cache
   * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
   */
  async cacheData(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;

    await this.db.cachedData.put({
      key,
      data,
      expiresAt,
      type: 'READ',
      userId: this.currentUserId
    });

    console.log(`💾 Cached: ${key} (expires in ${ttlSeconds}s)`);
  }

  /**
   * Retrieve cached data if not expired
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const cached = await this.db.cachedData.get({ key });

    if (!cached) return null;

    // Check expiration
    if (cached.expiresAt < now) {
      await this.db.cachedData.delete(cached.id!);
      console.log(`⏰ Cache expired: ${key}`);
      return null;
    }

    console.log(`📦 Cache hit: ${key}`);
    return cached.data as T;
  }

  /**
   * Queue a write operation for later sync
   */
  async queueWrite(
    type: SyncQueueItem['type'],
    action: SyncQueueItem['action'],
    payload: any,
    endpoint: string
  ): Promise<number> {
    const item: SyncQueueItem = {
      type,
      action,
      payload,
      endpoint,
      userId: this.currentUserId,
      createdAt: Date.now(),
      attempt: 0,
      maxRetries: 3,
      synced: false
    };

    const id = await this.db.syncQueue.add(item);
    console.log(`📝 Queued ${type}:${action} (ID: ${id})`);
    return id;
  }

  /**
   * Get all pending operations for current user
   */
  async getPendingOperations(): Promise<SyncQueueItem[]> {
    return this.db.syncQueue
      .where({ userId: this.currentUserId, synced: false })
      .toArray();
  }

  /**
   * Sync all pending operations
   */
  async syncAll(): Promise<{ successful: number; failed: number }> {
    if (!this.isOnline) {
      console.log('❌ Still offline, cannot sync');
      return { successful: 0, failed: 0 };
    }

    const pending = await this.getPendingOperations();
    if (pending.length === 0) {
      console.log('✅ No pending operations');
      return { successful: 0, failed: 0 };
    }

    console.log(`🔄 Syncing ${pending.length} pending operations...`);

    let successful = 0;
    let failed = 0;

    for (const operation of pending) {
      try {
        const response = await fetch(operation.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
          },
          body: JSON.stringify(operation.payload)
        });

        if (response.ok) {
          await this.db.syncQueue.update(operation.id!, {
            synced: true,
            syncedAt: Date.now()
          });
          console.log(`✅ Synced: ${operation.type}:${operation.action} (${operation.id})`);
          successful++;
        } else {
          operation.attempt++;

          if (operation.attempt >= operation.maxRetries) {
            await this.db.syncQueue.update(operation.id!, {
              error: `Failed after ${operation.maxRetries} attempts: ${response.status}`,
              attempt: operation.attempt
            });
            console.error(`❌ Failed permanently: ${operation.type}:${operation.action}`);
            failed++;
          } else {
            await this.db.syncQueue.update(operation.id!, {
              attempt: operation.attempt
            });
            console.warn(`⚠️ Retry needed: ${operation.type}:${operation.action}`);
          }
        }
      } catch (error) {
        operation.attempt++;

        if (operation.attempt >= operation.maxRetries) {
          await this.db.syncQueue.update(operation.id!, {
            error: `Network error: ${(error as Error).message}`,
            attempt: operation.attempt
          });
          failed++;
        } else {
          await this.db.syncQueue.update(operation.id!, {
            attempt: operation.attempt
          });
        }

        console.error(`❌ Sync error: ${error}`);
      }
    }

    console.log(`📊 Sync complete: ${successful} successful, ${failed} failed`);
    return { successful, failed };
  }

  /**
   * Start automatic sync interval
   */
  private startSync() {
    // Try to sync every 30 seconds
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncAll();
      }
    }, 30000);

    // Retry failed operations every 2 minutes
    this.retryInterval = setInterval(async () => {
      if (this.isOnline) {
        const failed = await this.db.syncQueue
          .where({ synced: false, userId: this.currentUserId })
          .toArray();

        const toRetry = failed.filter(
          op => op.attempt < op.maxRetries && op.attempt > 0
        );

        if (toRetry.length > 0) {
          console.log(`🔄 Retrying ${toRetry.length} failed operations...`);
          await this.syncAll();
        }
      }
    }, 120000);
  }

  /**
   * Stop automatic sync
   */
  stopSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.retryInterval) clearInterval(this.retryInterval);
  }

  /**
   * Check online status
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const all = await this.db.syncQueue
      .where({ userId: this.currentUserId })
      .toArray();

    const pending = all.filter(op => !op.synced);
    const failed = pending.filter(op => op.attempt >= op.maxRetries);

    return {
      total: all.length,
      pending: pending.length,
      synced: all.length - pending.length,
      failed: failed.length,
      lastSync: all
        .filter(op => op.syncedAt)
        .sort((a, b) => (b.syncedAt || 0) - (a.syncedAt || 0))[0]?.syncedAt || null
    };
  }

  /**
   * Clear old synced operations (cleanup)
   */
  async cleanupSyncedOperations(olderThanDays: number = 7) {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const deleted = await this.db.syncQueue
      .where('syncedAt')
      .below(cutoffTime)
      .delete();

    console.log(`🗑️ Cleaned up ${deleted} old synced operations`);
    return deleted;
  }

  /**
   * Clear cache for a specific key
   */
  async clearCache(key: string) {
    const count = await this.db.cachedData.where({ key }).delete();
    console.log(`🗑️ Cleared ${count} cache entries for ${key}`);
  }

  /**
   * Clear all expired cache entries
   */
  async clearExpiredCache() {
    const now = Date.now();
    const expired = await this.db.cachedData
      .where('expiresAt')
      .below(now)
      .delete();

    console.log(`🗑️ Cleared ${expired} expired cache entries`);
    return expired;
  }
}

export default AdvancedSyncService.getInstance();
