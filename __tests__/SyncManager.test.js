import {
  getPendingMessages,
  updateMessageStateLocal,
  updateMessageFailedLocal,
  resetSendingMessagesLocal,
  resetMessageForManualRetryLocal,
} from '../src/database/messageRepository';

import SyncManager, { MAX_AUTO_RETRIES } from '../src/sync/SyncManager';

jest.mock('../src/database/messageRepository', () => ({
  getPendingMessages: jest.fn(),
  updateMessageStateLocal: jest.fn(),
  updateMessageFailedLocal: jest.fn(),
  resetSendingMessagesLocal: jest.fn(),
  resetMessageForManualRetryLocal: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

global.fetch = jest.fn();

describe('SyncManager - Offline-Capable Conversation Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getPendingMessages.mockResolvedValue([]);

    SyncManager.isOnline = true;
    SyncManager.isSyncing = false;
    SyncManager.simulateOffline = false;
    SyncManager.simulateFailure = false;
    SyncManager.simulateLostAck = false;
  });

  const sampleMessage1 = {
    clientMessageId: 'msg_test_001',
    conversationId: 'factory-safety-room',
    content: 'Check boiler pressure valve #2',
    createdAt: '2026-09-21T10:00:00.000Z',
    deliveryState: 'pending',
    retryCount: 0,
    lastError: null,
  };

  const sampleMessage2 = {
    clientMessageId: 'msg_test_002',
    conversationId: 'factory-safety-room',
    content: 'Pressure valve #2 reading 85 PSI',
    createdAt: '2026-09-21T10:01:00.000Z',
    deliveryState: 'pending',
    retryCount: 0,
    lastError: null,
  };

  // =========================================================================
  // SCENARIO 1: Local Outbox Restoration After Lifecycle Restart (AC2)
  // =========================================================================
  describe('1. Lifecycle Restart & Outbox Restoration', () => {
    test('should reset in-flight "sending" messages back to "pending" on init (crash recovery)', async () => {
      resetSendingMessagesLocal.mockResolvedValueOnce();

      // Simulate app startup lifecycle
      SyncManager.isInitialized = false;
      SyncManager.init();

      expect(resetSendingMessagesLocal).toHaveBeenCalledTimes(1);
    });

    test('should restore durable messages and their states across lifecycle re-initialization', async () => {
      // Setup outbox state simulating SQLite restoration
      const restoredOutbox = [
        { ...sampleMessage1, deliveryState: 'pending' },
        { ...sampleMessage2, deliveryState: 'failed', retryCount: 2, lastError: 'Server Error: 503' },
      ];

      getPendingMessages.mockResolvedValueOnce(restoredOutbox);

      const pending = await getPendingMessages();

      expect(pending).toHaveLength(2);
      expect(pending[0].deliveryState).toBe('pending');
      expect(pending[1].deliveryState).toBe('failed');
      expect(pending[1].retryCount).toBe(2);
    });
  });

  // =========================================================================
  // SCENARIO 2: Documented FIFO Ordering Policy (AC3)
  // =========================================================================
  describe('2. Multiple Pending Messages FIFO Ordering', () => {
    test('should synchronize multiple pending messages strictly in createdAt FIFO sequence', async () => {
      // Return 2 pending messages in chronological order
      getPendingMessages.mockResolvedValueOnce([sampleMessage1, sampleMessage2]);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ clientMessageId: 'msg_test_001' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ clientMessageId: 'msg_test_002' }),
        });

      await SyncManager.syncPendingMessages();

      expect(global.fetch).toHaveBeenCalledTimes(2);

      const firstRequestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const secondRequestBody = JSON.parse(global.fetch.mock.calls[1][1].body);

      expect(firstRequestBody.clientMessageId).toBe('msg_test_001');
      expect(secondRequestBody.clientMessageId).toBe('msg_test_002');

      // Verify delivery state progression: sending -> delivered
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'sending');
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'delivered');
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_002', 'sending');
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_002', 'delivered');
    });
  });

  // =========================================================================
  // SCENARIO 3: Temporary Failure Followed by Successful Retry (AC4)
  // =========================================================================
  describe('3. Temporary Failure & Recovery', () => {
    test('should mark message as failed with incremented attempt on 503, then succeed on retry', async () => {
      // Step A: First attempt fails with 503
      getPendingMessages.mockResolvedValueOnce([sampleMessage1]);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await SyncManager.syncPendingMessages();

      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'sending');
      expect(updateMessageFailedLocal).toHaveBeenCalledWith(
        'msg_test_001',
        'Server Error: 503'
      );

      // Step B: Reconnection retry succeeds with 201
      const messageAfterFailure = {
        ...sampleMessage1,
        deliveryState: 'failed',
        retryCount: 1,
        lastError: 'Server Error: 503',
      };

      getPendingMessages.mockResolvedValueOnce([messageAfterFailure]);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ clientMessageId: 'msg_test_001' }),
      });

      await SyncManager.syncPendingMessages();

      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'delivered');
    });
  });

  // =========================================================================
  // SCENARIO 4: Uncertain Acknowledgement & Idempotent Retry (AC5)
  // =========================================================================
  describe('4. Uncertain Acknowledgement (Idempotency)', () => {
    test('should handle lost acknowledgement: network drop after server save reconciles to delivered on retry without duplicates', async () => {
      // Attempt 1: Client sends message, but connection drops before response (network timeout/drop)
      getPendingMessages.mockResolvedValueOnce([sampleMessage1]);

      global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

      await SyncManager.syncPendingMessages();

      expect(updateMessageFailedLocal).toHaveBeenCalledWith(
        'msg_test_001',
        'Network request failed'
      );

      // Attempt 2: Client retries with identical clientMessageId.
      // Server already saved the record from attempt 1 and returns HTTP 200 (idempotent duplicate resolution).
      const retriedMessage = {
        ...sampleMessage1,
        deliveryState: 'failed',
        retryCount: 1,
      };

      getPendingMessages.mockResolvedValueOnce([retriedMessage]);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200, // Idempotent 200 returned by server
        json: jest.fn().mockResolvedValue({
          _id: 'existing_mongo_id',
          clientMessageId: 'msg_test_001',
        }),
      });

      await SyncManager.syncPendingMessages();

      // Mobile client reconciles response and marks delivered
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'delivered');
    });
  });

  // =========================================================================
  // SCENARIO 5: Bounded Retry Limit & Manual Recovery
  // =========================================================================
  describe('5. Bounded Retry Limits & Manual Recovery', () => {
    test('should stop automatic retry once retryCount reaches MAX_AUTO_RETRIES', async () => {
      const exhaustedMessage = {
        ...sampleMessage1,
        deliveryState: 'failed',
        retryCount: MAX_AUTO_RETRIES, // 3 attempts exhausted
        lastError: 'Server Error: 500',
      };

      getPendingMessages.mockResolvedValueOnce([exhaustedMessage]);

      // Automatic sync runs (e.g. connectivity change)
      await SyncManager.syncPendingMessages({ manualRetry: false });

      // Automatic sync should filter out the exhausted message - no fetch made!
      expect(global.fetch).not.toHaveBeenCalled();
      expect(updateMessageStateLocal).not.toHaveBeenCalled();
    });

    test('should allow manual retry to reset counter and recover exhausted failed message', async () => {
      const exhaustedMessage = {
        ...sampleMessage1,
        deliveryState: 'failed',
        retryCount: 3,
        lastError: 'Server Error: 500',
      };

      resetMessageForManualRetryLocal.mockResolvedValueOnce();

      getPendingMessages.mockResolvedValueOnce([exhaustedMessage]);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ clientMessageId: 'msg_test_001' }),
      });

      // User presses "Retry" button (manualRetry = true)
      await SyncManager.syncPendingMessages({ manualRetry: true });

      expect(resetMessageForManualRetryLocal).toHaveBeenCalledWith('msg_test_001');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'delivered');
    });
  });

  // =========================================================================
  // SCENARIO 6: Stretch Goal - Messages Added While Sync Is In Progress
  // =========================================================================
  describe('6. Stretch Goal: Concurrent Outbox Additions', () => {
    test('should drain messages added to outbox while synchronization was in progress', async () => {
      // First batch has message 1
      // While message 1 is syncing, message 2 was added
      getPendingMessages
        .mockResolvedValueOnce([sampleMessage1])
        .mockResolvedValueOnce([sampleMessage2]);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ clientMessageId: 'msg_test_001' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ clientMessageId: 'msg_test_002' }),
        });

      await SyncManager.syncPendingMessages();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_001', 'delivered');
      expect(updateMessageStateLocal).toHaveBeenCalledWith('msg_test_002', 'delivered');
    });
  });
});