/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

jest.mock('../src/database/database', () => ({
  getDBConnection: jest.fn().mockResolvedValue({
    executeSql: jest.fn().mockResolvedValue([
      {
        rows: {
          length: 0,
          item: jest.fn(),
        },
      },
    ]),
  }),
  initializeDB: jest.fn().mockResolvedValue({}),
  createTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/database/messageRepository', () => ({
  saveMessageLocal: jest.fn().mockResolvedValue({}),
  getMessagesLocal: jest.fn().mockResolvedValue([]),
  getMessageQueueSummaryLocal: jest.fn().mockResolvedValue({ pending: 0, sending: 0, failed: 0, delivered: 0 }),
  clearAllMessagesLocal: jest.fn().mockResolvedValue(undefined),
  resetSendingMessagesLocal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/sync/SyncManager', () => ({
  init: jest.fn(),
  destroy: jest.fn(),
  forceSync: jest.fn().mockResolvedValue(undefined),
  syncPendingMessages: jest.fn().mockResolvedValue(undefined),
}));

import App from '../App';

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue([]),
});

test('renders correctly', async () => {
  let root;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
  if (root) {
    await ReactTestRenderer.act(async () => {
      root.unmount();
    });
  }
});