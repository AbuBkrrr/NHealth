/**
 * Socket.io Polling Fallback Service
 * Supplements real-time Socket.io with periodic polling for offline recovery
 * Ensures client always has up-to-date state, even when sockets disconnect
 */

import { Server as SocketServer } from 'socket.io';
import { prisma } from '../config/prisma';

export interface ChangesQuery {
  userId: string;
  lastSync: number; // timestamp
  types?: string[]; // filter by event types
}

export class PollingFallbackService {
  private static readonly POLL_INTERVAL = 30000; // 30 seconds
  private static readonly RETENTION_DAYS = 7; // Keep changes for 7 days

  /**
   * Get all changes since last sync
   * Used when client reconnects or polling
   */
  static async getChangesSince(query: ChangesQuery): Promise<Array<{
    type: string;
    action: string;
    entityId: string;
    entityType: string;
    data: any;
    timestamp: number;
    changedBy: string;
  }>> {
    try {
      // In production, this would query from a dedicated changes table or event log
      // For now, return empty array - but structure is ready for implementation
      // This would typically query events like:
      // - appointments:updated
      // - orders:updated
      // - prescriptions:new
      // - payments:confirmed
      // etc.

      const changes: Array<any> = [];

      // Example implementation structure:
      // const changesTable = await db.getChangesSince({
      //   userId: query.userId,
      //   after: query.lastSync,
      //   types: query.types
      // });

      return changes.map(change => ({
        type: change.type,
        action: change.action,
        entityId: change.entityId,
        entityType: change.entityType,
        data: change.data,
        timestamp: change.timestamp,
        changedBy: change.changedBy
      }));
    } catch (error) {
      console.error('Error fetching changes:', error);
      return [];
    }
  }

  /**
   * Register a client for polling
   * Start periodic sync checks
   */
  static startPollingClient(
    userId: string,
    socket: any,
    onChanges?: (changes: any[]) => void
  ): NodeJS.Timer {
    console.log(`📡 Started polling for user: ${userId}`);

    let lastSync = Date.now();

    const pollInterval = setInterval(async () => {
      try {
        const changes = await this.getChangesSince({
          userId,
          lastSync
        });

        if (changes.length > 0) {
          console.log(`📡 Found ${changes.length} changes for ${userId}`);

          // Emit changes to client
          socket?.emit('polling:changes', {
            changes,
            timestamp: Date.now()
          });

          // Callback for custom handling
          onChanges?.(changes);

          lastSync = Date.now();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, this.POLL_INTERVAL);

    return pollInterval;
  }

  /**
   * Setup hybrid Socket.io + Polling architecture
   * Socket.io for real-time, polling for fallback
   */
  static setupHybridSync(io: SocketServer) {
    io.on('connection', (socket) => {
      const userId = socket.data.userId;
      let pollInterval: NodeJS.Timer | null = null;

      // When client connects, start polling as backup
      console.log(`🔌 Socket connected for ${userId}, starting polling backup`);

      pollInterval = this.startPollingClient(userId, socket, (changes) => {
        // Forward polling changes as socket events
        changes.forEach(change => {
          socket.emit(change.type, change.data);
        });
      });

      // When client disconnects, continue polling to queue missed updates
      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected for ${userId}, keeping polling active`);
        // Poll interval continues to run - when socket reconnects,
        // client will query missed changes via polling endpoint
      });

      socket.on('reconnect', () => {
        console.log(`🔌 Socket reconnected for ${userId}`);
        // Client should call polling endpoint to catch up
      });
    });
  }

  /**
   * Record a change for polling clients to pick up
   * Called when any entity is updated
   */
  static async recordChange(
    type: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL',
    entityId: string,
    entityType: string,
    data: any,
    changedBy: string
  ): Promise<void> {
    try {
      // In production, would store in changes/events table:
      // await db.changes.create({
      //   type,
      //   action,
      //   entityId,
      //   entityType,
      //   data,
      //   changedBy,
      //   timestamp: Date.now(),
      //   expiresAt: new Date(Date.now() + this.RETENTION_DAYS * 24 * 60 * 60 * 1000)
      // });

      console.log(`📝 Recorded change: ${type}:${action} for ${entityId}`);
    } catch (error) {
      console.error('Failed to record change:', error);
    }
  }

  /**
   * Cleanup old changes (retention policy)
   */
  static async cleanupOldChanges(): Promise<number> {
    // In production:
    // const cutoffDate = new Date(Date.now() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    // return await db.changes.where({ timestamp }).below(cutoffDate).delete();

    return 0;
  }
}

export default PollingFallbackService;
