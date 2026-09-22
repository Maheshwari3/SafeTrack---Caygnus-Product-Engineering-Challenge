import SQLite from 'react-native-sqlite-storage';

// Enable Promise support for SQLite
SQLite.enablePromise(true);

const DATABASE_NAME = 'SafeTrack.db';
const DATABASE_VERSION = '1.0';
const DATABASE_DISPLAYNAME = 'SafeTrack Offline Database';
const DATABASE_SIZE = 200000;

export const getDBConnection = async () => {
  return SQLite.openDatabase(
    DATABASE_NAME,
    DATABASE_VERSION,
    DATABASE_DISPLAYNAME,
    DATABASE_SIZE
  );
};

export const createTables = async (db) => {
  // Offline message outbox (Problem 2)
  const messagesQuery = `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientMessageId TEXT UNIQUE NOT NULL,
      conversationId TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      deliveryState TEXT NOT NULL,
      retryCount INTEGER DEFAULT 0,
      lastError TEXT
    );
  `;

  await db.executeSql(messagesQuery);
};

export const initializeDB = async () => {
  try {
    const db = await getDBConnection();
    await createTables(db);
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};
