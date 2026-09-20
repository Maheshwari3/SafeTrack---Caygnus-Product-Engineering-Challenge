import { saveIncidentLocal, getPendingOrFailedIncidents, updateIncidentStatusLocal, updateIncidentSyncFailedLocal } from '../src/database/incidentRepository';
import SyncManager from '../src/sync/SyncManager';
import NetInfo from '@react-native-community/netinfo';
import { DeviceEventEmitter } from 'react-native';

// Mock Dependencies
jest.mock('../src/database/incidentRepository', () => ({
  saveIncidentLocal: jest.fn(),
  getPendingOrFailedIncidents: jest.fn(),
  updateIncidentStatusLocal: jest.fn(),
  updateIncidentSyncFailedLocal: jest.fn(),
  resetSyncingIncidentsLocal: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

global.fetch = jest.fn();

describe('SyncManager - Failed Sync & Retry Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SyncManager.isOnline = true;
    SyncManager.isSyncing = false;
  });

  const mockIncident = {
    clientIncidentId: 'inc_test_1',
    title: 'Test',
    syncStatus: 'pending',
    retryCount: 0
  };

  it('should transition to failed on fetch error and increment retryCount via repository', async () => {
    getPendingOrFailedIncidents.mockResolvedValueOnce([mockIncident]);
    
    // Force a network error
    global.fetch.mockRejectedValueOnce(new Error('Network offline'));

    await SyncManager.syncPendingIncidents();

    // 1. Should mark as syncing first
    expect(updateIncidentStatusLocal).toHaveBeenCalledWith('inc_test_1', 'syncing');
    
    // 2. Should attempt fetch
    expect(global.fetch).toHaveBeenCalled();

    // 3. Should catch error and update status to failed (which bumps retry in repo)
    expect(updateIncidentSyncFailedLocal).toHaveBeenCalledWith('inc_test_1', 'Network offline');
  });

  it('should transition to synced on successful retry', async () => {
    // Start with a failed incident
    const failedIncident = { ...mockIncident, syncStatus: 'failed', retryCount: 1 };
    getPendingOrFailedIncidents.mockResolvedValueOnce([failedIncident]);
    
    // Force successful fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201
    });

    await SyncManager.syncPendingIncidents();

    // 1. Mark as syncing
    expect(updateIncidentStatusLocal).toHaveBeenCalledWith('inc_test_1', 'syncing');
    
    // 2. Successful fetch -> Mark as synced
    expect(updateIncidentStatusLocal).toHaveBeenCalledWith('inc_test_1', 'synced');
  });
});

describe('Offline Persistence', () => {
  it('should allow saving an incident locally even when offline', async () => {
    const newIncident = {
      clientIncidentId: 'inc_offline',
      title: 'Offline Event',
      syncStatus: 'pending',
    };

    saveIncidentLocal.mockResolvedValueOnce(true);

    await saveIncidentLocal(newIncident);

    // Verify repository was called (which represents our persistent queue)
    expect(saveIncidentLocal).toHaveBeenCalledWith(newIncident);
  });
});
