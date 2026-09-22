import NetInfo from '@react-native-community/netinfo';
import { DeviceEventEmitter } from 'react-native';

import {
  getPendingMessages,
  updateMessageStateLocal,
  updateMessageFailedLocal,
  resetSendingMessagesLocal,
  resetMessageForManualRetryLocal,
} from '../database/messageRepository';

import { MESSAGES_API_URL } from '../config';

const API_URL = MESSAGES_API_URL;

// Maximum number of automatic attempts for one message.
export const MAX_AUTO_RETRIES = 3;

class SyncManager {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.isInitialized = false;
    this.unsubscribeNetwork = null;

    // Reviewer and test simulation controls
    this.simulateOffline = false;
    this.simulateFailure = false;
    this.simulateLostAck = false;

    this.apiUrl = MESSAGES_API_URL;
  }

  init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    // Crash recovery (AC2):
    // If the app was terminated while a message was in 'sending' state,
    // we don't know whether the backend received it or not.
    // Move it back to 'pending' so it can safely be retried idempotently.
    resetSendingMessagesLocal().catch((err) => {
      console.error('Failed to reset sending messages on init:', err);
    });

    this.unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      const isNowOnline = state.isConnected === true && !this.simulateOffline;

      this.isOnline = isNowOnline;

      console.log('Network state changed. Online:', this.isOnline);

      // Connectivity returned (AC3)
      if (wasOffline && isNowOnline) {
        this.syncPendingMessages();
      }
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      this.isOnline = state.isConnected === true && !this.simulateOffline;
      if (this.isOnline) {
        this.syncPendingMessages();
      }
    }).catch(() => {});
  }

  // Set offline simulation mode for reviewers and tests
  setSimulateOffline(enabled) {
    this.simulateOffline = Boolean(enabled);
    if (this.simulateOffline) {
      this.isOnline = false;
    } else {
      NetInfo.fetch().then((state) => {
        const wasOffline = !this.isOnline;
        this.isOnline = state.isConnected === true;
        if (wasOffline && this.isOnline) {
          this.syncPendingMessages();
        }
      }).catch(() => {
        this.isOnline = true;
      });
    }
  }

  // Set backend failure simulation (503 temporary error)
  setSimulateFailure(enabled) {
    this.simulateFailure = Boolean(enabled);
  }

  // Set backend lost acknowledgement simulation (saved on backend, response dropped)
  setSimulateLostAck(enabled) {
    this.simulateLostAck = Boolean(enabled);
  }

  async syncPendingMessages({ manualRetry = false } = {}) {
    // Effective online check considering reviewer simulation
    const effectiveOnline = this.isOnline && !this.simulateOffline;

    if (this.isSyncing || !effectiveOnline) {
      return;
    }

    this.isSyncing = true;

    try {
      // Loop to drain all messages, including messages added while sync is in progress (stretch goal)
      let continueDraining = true;

      while (continueDraining && (this.isOnline && !this.simulateOffline)) {
        const messages = (await getPendingMessages()) || [];

        let messagesToSync;

        if (manualRetry) {
          // Manual retry can recover messages that exhausted their automatic retry limit
          messagesToSync = messages;
        } else {
          // Automatic retry is bounded (AC4)
          messagesToSync = messages.filter((message) => {
            if (message.deliveryState === 'pending') {
              return true;
            }
            if (message.deliveryState === 'sending') {
              return true;
            }
            if (message.deliveryState === 'failed') {
              return (message.retryCount || 0) < MAX_AUTO_RETRIES;
            }
            return false;
          });
        }

        if (!messagesToSync || messagesToSync.length === 0) {
          break;
        }

        console.log(`Processing sync batch for ${messagesToSync.length} message(s)...`);

        let networkHalted = false;

        // Process one message at a time in strict FIFO order (createdAt ASC, id ASC)
        for (const message of messagesToSync) {
          if (!this.isOnline || this.simulateOffline) {
            console.log('Network lost during sync. Pausing queue...');
            networkHalted = true;
            break;
          }

          try {
            // If message was in failed state and manual retry is running, reset counter first
            if (manualRetry && message.deliveryState === 'failed') {
              await resetMessageForManualRetryLocal(message.clientMessageId);
            }

            // Transition: pending/failed → sending
            await updateMessageStateLocal(message.clientMessageId, 'sending');
            DeviceEventEmitter.emit('messageSyncUpdated');

            const headers = {
              'Content-Type': 'application/json',
            };

            // Reviewer simulation headers
            if (this.simulateFailure) {
              headers['x-simulate-failure'] = 'true';
            }
            if (this.simulateLostAck) {
              headers['x-simulate-lost-ack'] = 'true';
              // Consume one-shot lost ack if desired, or keep until toggled
            }

            const requestOptions = {
              method: 'POST',
              headers,
              body: JSON.stringify({
                clientMessageId: message.clientMessageId,
                conversationId: message.conversationId,
                content: message.content,
                createdAt: message.createdAt,
                simulateFailure: this.simulateFailure,
                simulateLostAck: this.simulateLostAck,
              }),
            };

            let response;
            try {
              response = await fetch(this.apiUrl, requestOptions);
            } catch (initialError) {
              if (__DEV__ && (this.apiUrl.includes('localhost') || this.apiUrl.includes('10.102.115.9'))) {
                const fallback = this.apiUrl.includes('localhost')
                  ? 'http://10.102.115.9:5000/api/messages'
                  : 'http://localhost:5000/api/messages';

                try {
                  const altRes = await fetch(fallback, requestOptions);
                  if (altRes && typeof altRes.status === 'number') {
                    response = altRes;
                    this.apiUrl = fallback;
                    console.log(`Switched active messages API endpoint to: ${fallback}`);
                  } else {
                    throw initialError;
                  }
                } catch {
                  throw initialError;
                }
              } else {
                throw initialError;
              }
            }

            if (response.ok) {
              // HTTP 201 = newly created on server
              // HTTP 200 = idempotent retry of existing message (AC5)
              await updateMessageStateLocal(message.clientMessageId, 'delivered');
              console.log(`Message delivered successfully: ${message.clientMessageId}`);
            } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              // Non-retryable client validation error (permanent failure)
              await updateMessageFailedLocal(
                message.clientMessageId,
                `Client Error: ${response.status}`
              );
              console.log(`Message permanently failed (4xx): ${message.clientMessageId}`);
            } else {
              // Temporary server failure (5xx or 429) (AC4)
              await updateMessageFailedLocal(
                message.clientMessageId,
                `Server Error: ${response.status}`
              );
              console.log(`Temporary server error (${response.status}) for: ${message.clientMessageId}`);

              // In strict FIFO ordering: temporary failure pauses subsequent dependent messages
              // so they are not delivered out-of-order.
              networkHalted = true;
              break;
            }
          } catch (error) {
            // Network error (timeout, connection refused, DNS failure)
            await updateMessageFailedLocal(
              message.clientMessageId,
              error.message || 'Network error'
            );
            console.log(`Network error for message: ${message.clientMessageId} - ${error.message}`);

            // Network issue encountered - pause processing remaining messages in this cycle
            networkHalted = true;
            break;
          }

          DeviceEventEmitter.emit('messageSyncUpdated');
        }

        if (networkHalted) {
          break;
        }
      }
    } catch (error) {
      console.error('Error in message SyncManager:', error);
    } finally {
      this.isSyncing = false;
      DeviceEventEmitter.emit('messageSyncUpdated');
      DeviceEventEmitter.emit('messageSyncFinished');
      DeviceEventEmitter.emit('syncFinished');
    }
  }

  // Force sync / Manual retry for all failed or pending messages
  async forceSync() {
    if (this.simulateOffline) {
      console.log('Cannot sync messages: simulation is set to offline');
      return;
    }

    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected === true;
    } catch {
      this.isOnline = true;
    }

    await this.syncPendingMessages({
      manualRetry: true,
    });
  }

  // Manual retry for a specific message by ID
  async retryMessage(clientMessageId) {
    await resetMessageForManualRetryLocal(clientMessageId);
    DeviceEventEmitter.emit('messageSyncUpdated');
    await this.forceSync();
  }

  destroy() {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    this.isInitialized = false;
    this.isSyncing = false;
  }
}

const syncManagerInstance = new SyncManager();

export default syncManagerInstance;