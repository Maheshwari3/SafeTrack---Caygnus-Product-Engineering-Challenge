/* eslint-disable */
// @ts-nocheck
const request = require('supertest');
const app = require('../src/app.js');
const Incident = require('../src/models/Incident.js');

describe('Incident API - Duplicate Prevention', () => {
  const mockIncident = {
    clientIncidentId: 'inc_test_12345',
    title: 'Test Incident',
    location: 'Test Location',
    severity: 'high',
    description: 'This is a test incident',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should save a new incident and return 201', async () => {
    // Spy on findOne to return null (no duplicate found)
    const findOneSpy = jest.spyOn(Incident, 'findOne').mockResolvedValue(null);
    
    // Spy on save to return the saved incident
    jest.spyOn(Incident.prototype, 'save').mockResolvedValue({ ...mockIncident, _id: 'mock_mongo_id' });

    const response = await request(app)
      .post('/api/incidents')
      .send(mockIncident);

    expect(response.status).toBe(201);
    expect(findOneSpy).not.toHaveBeenCalled(); // The controller calls save first
  });

  it('should prevent duplicates with same clientIncidentId and return 200 (Idempotent)', async () => {
    // Spy on save to throw a Duplicate Key error
    const duplicateError = new Error('Duplicate key');
    duplicateError.code = 11000;
    duplicateError.keyPattern = { clientIncidentId: 1 };
    jest.spyOn(Incident.prototype, 'save').mockRejectedValue(duplicateError);

    // Spy on findOne to return the existing incident in the catch block
    const findOneSpy = jest.spyOn(Incident, 'findOne').mockResolvedValue({ ...mockIncident, _id: 'existing_mongo_id' });

    const response = await request(app)
      .post('/api/incidents')
      .send(mockIncident);

    expect(response.status).toBe(200);
    expect(response.body._id).toBe('existing_mongo_id');
    expect(findOneSpy).toHaveBeenCalledWith({ clientIncidentId: mockIncident.clientIncidentId });
  });
});
