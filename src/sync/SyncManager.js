import NetInfo from '@react-native-community/netinfo';
import { getPendingOrFailedIncidents, updateIncidentStatusLocal, updateIncidentSyncFailedLocal, resetSyncingIncidentsLocal } from '../database/incidentRepository';

import { DeviceEventEmitter } from 'react-native';
import { INCIDENTS_API_URL } from '../config';

const API_URL = INCIDENTS_API_URL;

class SyncManager {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Crash recovery: if the app closed while syncing, reset those incidents to pending
    resetSyncingIncidentsLocal();

    // Subscribe to network state changes
    NetInfo.addEventListener(state => {
      const becameOnline = !this.isOnline && state.isConnected;
      this.isOnline = state.isConnected;
      
      console.log('Network state changed. Online:', this.isOnline);
      
      if (becameOnline) {
        this.syncPendingIncidents();
      }
    });
  }

  async syncPendingIncidents() {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    try {
      const pendingIncidents = await getPendingOrFailedIncidents();
      
      if (pendingIncidents.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`Starting sync for ${pendingIncidents.length} incidents...`);

      for (const incident of pendingIncidents) {
        if (!this.isOnline) {
          console.log('Network lost during sync. Pausing...');
          break;
        }

        try {
          // Optimistically mark as syncing
          await updateIncidentStatusLocal(incident.clientIncidentId, 'syncing');
          DeviceEventEmitter.emit('syncFinished'); // Refresh UI to show 'syncing'

          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(incident),
          });

          if (response.ok || response.status === 201 || response.status === 200) {
            // Synced successfully, or idempotent response
            await updateIncidentStatusLocal(incident.clientIncidentId, 'synced');
            console.log(`Successfully synced: ${incident.clientIncidentId}`);
          } else {
            const errorText = await response.text();
            // Server returned error (e.g., 500)
            await updateIncidentSyncFailedLocal(incident.clientIncidentId, `Server Error: ${response.status}`);
            console.log(`Failed to sync (Server Error): ${incident.clientIncidentId}`);
          }
        } catch (error) {
          // Network error, Server unreachable, etc.
          await updateIncidentSyncFailedLocal(incident.clientIncidentId, error.message);
          console.log(`Failed to sync (Network Error): ${incident.clientIncidentId}`);
        }
      }
    } catch (error) {
      console.error('Error in syncManager:', error);
    } finally {
      this.isSyncing = false;
      // Tell the Dashboard UI to refresh its list!
      DeviceEventEmitter.emit('syncFinished');
    }
  }

  // Triggered manually when the user presses "Retry Sync"
  async forceSync() {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      this.isOnline = true;
      await this.syncPendingIncidents();
    } else {
      console.warn('Cannot force sync: Offline');
    }
  }
}

// Export a singleton instance
const syncManagerInstance = new SyncManager();
export default syncManagerInstance;
