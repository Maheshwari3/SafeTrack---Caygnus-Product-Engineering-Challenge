import { getDBConnection } from './database';

export const saveIncidentLocal = async (incident) => {
  const db = await getDBConnection();
  const insertQuery = `
    INSERT INTO incidents 
    (clientIncidentId, title, location, severity, description, createdAt, syncStatus, retryCount, lastError) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const values = [
    incident.clientIncidentId,
    incident.title,
    incident.location,
    incident.severity,
    incident.description,
    incident.createdAt,
    incident.syncStatus,
    incident.retryCount || 0,
    incident.lastError || null
  ];

  try {
    return await db.executeSql(insertQuery, values);
  } catch (error) {
    console.error('Error saving incident locally:', error);
    throw error;
  }
};

export const getIncidentsLocal = async () => {
  const db = await getDBConnection();
  const query = `SELECT * FROM incidents WHERE syncStatus != 'synced' ORDER BY createdAt DESC`;
  
  try {
    const [results] = await db.executeSql(query);
    let incidents = [];
    for (let i = 0; i < results.rows.length; i++) {
      incidents.push(results.rows.item(i));
    }
    return incidents;
  } catch (error) {
    console.error('Error fetching local incidents:', error);
    throw error;
  }
};

export const getHistoryIncidentsLocal = async () => {
  const db = await getDBConnection();
  const query = `SELECT * FROM incidents WHERE syncStatus = 'synced' ORDER BY createdAt DESC`;
  
  try {
    const [results] = await db.executeSql(query);
    let incidents = [];
    for (let i = 0; i < results.rows.length; i++) {
      incidents.push(results.rows.item(i));
    }
    return incidents;
  } catch (error) {
    console.error('Error fetching history incidents:', error);
    throw error;
  }
};

export const updateIncidentStatusLocal = async (clientIncidentId, newStatus) => {
  const db = await getDBConnection();
  const query = `UPDATE incidents SET syncStatus = ? WHERE clientIncidentId = ?`;
  
  try {
    return await db.executeSql(query, [newStatus, clientIncidentId]);
  } catch (error) {
    console.error('Error updating incident status:', error);
    throw error;
  }
};

export const getPendingOrFailedIncidents = async () => {
  const db = await getDBConnection();
  // Fetch both pending and failed incidents (also grab syncing if any stuck)
  const query = `SELECT * FROM incidents WHERE syncStatus IN ('pending', 'failed', 'syncing') ORDER BY createdAt ASC`;
  
  try {
    const [results] = await db.executeSql(query);
    let incidents = [];
    for (let i = 0; i < results.rows.length; i++) {
      incidents.push(results.rows.item(i));
    }
    return incidents;
  } catch (error) {
    console.error('Error fetching pending incidents:', error);
    throw error;
  }
};

export const resetSyncingIncidentsLocal = async () => {
  const db = await getDBConnection();
  const query = `UPDATE incidents SET syncStatus = 'pending' WHERE syncStatus = 'syncing'`;
  try {
    return await db.executeSql(query);
  } catch (error) {
    console.error('Error resetting syncing incidents:', error);
  }
};

export const updateIncidentSyncFailedLocal = async (clientIncidentId, errorMessage) => {
  const db = await getDBConnection();
  const query = `
    UPDATE incidents 
    SET syncStatus = 'failed', 
        retryCount = retryCount + 1, 
        lastError = ? 
    WHERE clientIncidentId = ?
  `;
  
  try {
    return await db.executeSql(query, [errorMessage, clientIncidentId]);
  } catch (error) {
    console.error('Error updating incident failure status:', error);
    throw error;
  }
};

export const getQueueSummaryLocal = async () => {
  const db = await getDBConnection();
  const query = `SELECT syncStatus, COUNT(*) as count FROM incidents GROUP BY syncStatus`;
  
  try {
    const [results] = await db.executeSql(query);
    const summary = {
      pending: 0,
      syncing: 0,
      failed: 0,
      synced: 0
    };
    for (let i = 0; i < results.rows.length; i++) {
      const item = results.rows.item(i);
      const status = item.syncStatus ? item.syncStatus.toLowerCase() : '';
      if (Object.prototype.hasOwnProperty.call(summary, status)) {
        summary[status] = item.count;
      }
    }
    return summary;
  } catch (error) {
    console.error('Error fetching queue summary:', error);
    return { pending: 0, syncing: 0, failed: 0, synced: 0 };
  }
};


