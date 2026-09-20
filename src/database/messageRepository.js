import { getDBConnection } from './database';

export const saveMessageLocal = async (message) => {
    const db = await getDBConnection();

    const query = `
    INSERT INTO messages
    (
      clientMessageId,
      conversationId,
      content,
      createdAt,
      deliveryState,
      retryCount,
      lastError
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const values = [
        message.clientMessageId,
        message.conversationId,
        message.content,
        message.createdAt,
        message.deliveryState || 'pending',
        message.retryCount || 0,
        message.lastError || null,
    ];

    try {
        return await db.executeSql(query, values);
    } catch (error) {
        console.error('Error saving message locally:', error);
        throw error;
    }
};

export const getMessagesLocal = async (conversationId) => {
    const db = await getDBConnection();

    const query = `
    SELECT *
    FROM messages
    WHERE conversationId = ?
    ORDER BY createdAt ASC, id ASC
  `;

    try {
        const [results] = await db.executeSql(query, [conversationId]);

        const messages = [];

        for (let i = 0; i < results.rows.length; i++) {
            messages.push(results.rows.item(i));
        }

        return messages;
    } catch (error) {
        console.error('Error fetching messages locally:', error);
        throw error;
    }
};

export const getPendingMessages = async () => {
    const db = await getDBConnection();

    const query = `
    SELECT *
    FROM messages
    WHERE deliveryState IN ('pending', 'failed', 'sending')
    ORDER BY createdAt ASC, id ASC
  `;

    try {
        const [results] = await db.executeSql(query);

        const messages = [];

        for (let i = 0; i < results.rows.length; i++) {
            messages.push(results.rows.item(i));
        }

        return messages;
    } catch (error) {
        console.error('Error fetching pending messages:', error);
        throw error;
    }
};

export const updateMessageStateLocal = async (
    clientMessageId,
    deliveryState
) => {
    const db = await getDBConnection();

    const query = `
    UPDATE messages
    SET deliveryState = ?
    WHERE clientMessageId = ?
  `;

    return db.executeSql(query, [
        deliveryState,
        clientMessageId,
    ]);
};

export const updateMessageFailedLocal = async (
    clientMessageId,
    errorMessage
) => {
    const db = await getDBConnection();

    const query = `
    UPDATE messages
    SET
      deliveryState = 'failed',
      retryCount = retryCount + 1,
      lastError = ?
    WHERE clientMessageId = ?
  `;

    return db.executeSql(query, [
        errorMessage,
        clientMessageId,
    ]);
};

export const resetSendingMessagesLocal = async () => {
    const db = await getDBConnection();

    const query = `
    UPDATE messages
    SET deliveryState = 'pending'
    WHERE deliveryState = 'sending'
  `;

    return db.executeSql(query);
};

export const getMessageQueueSummaryLocal = async () => {
    const db = await getDBConnection();

    const query = `
    SELECT deliveryState, COUNT(*) as count
    FROM messages
    GROUP BY deliveryState
  `;

    try {
        const [results] = await db.executeSql(query);

        const summary = {
            pending: 0,
            sending: 0,
            failed: 0,
            delivered: 0,
        };

        for (let i = 0; i < results.rows.length; i++) {
            const item = results.rows.item(i);

            if (
                Object.prototype.hasOwnProperty.call(
                    summary,
                    item.deliveryState
                )
            ) {
                summary[item.deliveryState] = item.count;
            }
        }

        return summary;
    } catch (error) {
        console.error('Error fetching message queue summary:', error);

        return {
            pending: 0,
            sending: 0,
            failed: 0,
            delivered: 0,
        };
    }
};

export const resetMessageForManualRetryLocal = async (
    clientMessageId
) => {
    const db = await getDBConnection();

    const query = `
    UPDATE messages
    SET
      deliveryState = 'pending',
      retryCount = 0,
      lastError = NULL
    WHERE clientMessageId = ?
  `;

    return db.executeSql(query, [clientMessageId]);
};