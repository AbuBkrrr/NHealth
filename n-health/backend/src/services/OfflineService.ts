import Dexie, { Table } from 'dexie';

interface OfflineData {
  id?: number;
  type: 'receipt' | 'barcode' | 'inventory' | 'general';
  data: any;
  timestamp: number;
  synced: boolean;
  endpoint: string;
}

export class OfflineDB extends Dexie {
  offlineData!: Table<OfflineData>;

  constructor() {
    super('NHealthOfflineDB');
    this.version(1).stores({
      offlineData: '++id, type, synced, timestamp',
    });
  }
}

export class OfflineService {
  private static instance: OfflineService;
  private db: OfflineDB;
  private isOnline: boolean = navigator.onLine;
  private syncQueue: OfflineData[] = [];
  private syncInterval: NodeJS.Timer | null = null;

  private constructor() {
    this.db = new OfflineDB();
    this.setupNetworkListeners();
    this.startSync();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /**
   * Listen to online/offline changes
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🟢 Back online - starting sync');
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔴 Went offline - queuing operations');
    });
  }

  /**
   * Queue operation for later sync
   */
  async queueOperation(
    type: 'receipt' | 'barcode' | 'inventory' | 'general',
    data: any,
    endpoint: string
  ): Promise<number> {
    const offlineData: OfflineData = {
      type,
      data,
      timestamp: Date.now(),
      synced: false,
      endpoint,
    };

    const id = await this.db.offlineData.add(offlineData);
    console.log(`📦 Queued ${type} operation:`, id);
    return id;
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(): Promise<OfflineData[]> {
    return this.db.offlineData.where('synced').equals(false).toArray();
  }

  /**
   * Sync all pending operations with server
   */
  async syncOfflineData() {
    if (!this.isOnline) {
      console.log('Still offline, cannot sync');
      return;
    }

    const pending = await this.getPendingOperations();
    if (pending.length === 0) {
      console.log('✅ No pending operations');
      return;
    }

    console.log(`🔄 Syncing ${pending.length} pending operations...`);

    for (const operation of pending) {
      try {
        const response = await fetch(operation.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data),
        });

        if (response.ok) {
          await this.db.offlineData.update(operation.id!, { synced: true });
          console.log(`✅ Synced operation ${operation.id}`);
        } else {
          console.error(`❌ Failed to sync operation ${operation.id}: ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Sync error for operation ${operation.id}:`, error);
      }
    }

    const remaining = await this.getPendingOperations();
    console.log(`📊 Sync complete. Remaining: ${remaining.length}`);
  }

  /**
   * Start automatic sync interval
   */
  private startSync() {
    // Try to sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncOfflineData();
      }
    }, 30000);
  }

  /**
   * Stop automatic sync
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Clear synced operations (cleanup)
   */
  async clearSyncedOperations() {
    const deleted = await this.db.offlineData.where('synced').equals(true).delete();
    console.log(`🗑️ Cleared ${deleted} synced operations`);
    return deleted;
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats() {
    const total = await this.db.offlineData.count();
    const pending = await this.db.offlineData.where('synced').equals(false).count();
    const synced = total - pending;

    return {
      total,
      pending,
      synced,
      lastSync: await this.db.offlineData
        .where('synced')
        .equals(true)
        .last()
        .then(item => item?.timestamp || null),
    };
  }
}

export default OfflineService.getInstance();
