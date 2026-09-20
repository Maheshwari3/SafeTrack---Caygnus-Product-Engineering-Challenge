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
const MAX_AUTO_RETRIES = 3;

class SyncManager {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.isInitialized = false;
    this.unsubscribeNetwork = null;
  }

  init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    // Crash recovery:
    // If the app was terminated while a message was being sent,
    // we don't know whether the backend received it.
    // Move it back to pending so it can safely be retried.
    resetSendingMessagesLocal();

    this.unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      const isNowOnline = state.isConnected === true;

      this.isOnline = isNowOnline;

      console.log(
        'Network state changed. Online:',
        this.isOnline
      );

      // Connectivity returned.
      if (wasOffline && isNowOnline) {
        this.syncPendingMessages();
      }
    });
  }

  async syncPendingMessages({ manualRetry = false } = {}) {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;

    try {
      const messages = await getPendingMessages();

      let messagesToSync;

      if (manualRetry) {
        // Manual retry can recover messages that exhausted
        // their automatic retry limit.
        messagesToSync = messages;
      } else {
        // Automatic retry is bounded.
        messagesToSync = messages.filter((message) => {
          if (message.deliveryState === 'pending') {
            return true;
          }

          if (message.deliveryState === 'sending') {
            return true;
          }

          if (message.deliveryState === 'failed') {
            return message.retryCount < MAX_AUTO_RETRIES;
          }

          return false;
        });
      }

      if (messagesToSync.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(
        `Starting message sync for ${messagesToSync.length} message(s)...`
      );

      // IMPORTANT:
      // We process one message at a time.
      // This preserves our documented ordering policy.
      for (const message of messagesToSync) {
        if (!this.isOnline) {
          console.log(
            'Network lost during sync. Pausing...'
          );
          break;
        }

        try {
          // Manual retry resets the retry counter first.
          if (
            manualRetry &&
            message.deliveryState === 'failed'
          ) {
            await resetMessageForManualRetryLocal(
              message.clientMessageId
            );
          }

          // pending → sending
          await updateMessageStateLocal(
            message.clientMessageId,
            'sending'
          );

          DeviceEventEmitter.emit('messageSyncUpdated');

          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clientMessageId: message.clientMessageId,
              conversationId: message.conversationId,
              content: message.content,
              createdAt: message.createdAt,
            }),
          });

          if (response.ok) {
            // 201 = newly created
            // 200 = idempotent retry / existing message
            await updateMessageStateLocal(
              message.clientMessageId,
              'delivered'
            );

            console.log(
              `Message delivered: ${message.clientMessageId}`
            );
          } else {
            await updateMessageFailedLocal(
              message.clientMessageId,
              `Server Error: ${response.status}`
            );

            console.log(
              `Message failed: ${message.clientMessageId}`
            );
          }
        } catch (error) {
          await updateMessageFailedLocal(
            message.clientMessageId,
            error.message || 'Network error'
          );

          console.log(
            `Network error for message: ${message.clientMessageId}`
          );
        }

        DeviceEventEmitter.emit('messageSyncUpdated');
      }
    } catch (error) {
      console.error(
        'Error in message SyncManager:',
        error
      );
    } finally {
      this.isSyncing = false;

      DeviceEventEmitter.emit('messageSyncFinished');
    }
  }

  // Manual retry button can call this method.
  async forceSync() {
    const state = await NetInfo.fetch();

    if (!state.isConnected) {
      console.warn(
        'Cannot sync messages: device is offline'
      );
      return;
    }

    this.isOnline = true;

    await this.syncPendingMessages({
      manualRetry: true,
    });
  }

  destroy() {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }

    this.isInitialized = false;
  }
}

const syncManagerInstance = new SyncManager();

export default syncManagerInstance;