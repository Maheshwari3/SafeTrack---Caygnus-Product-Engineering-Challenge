/* eslint-disable */
// @ts-nocheck

const request = require('supertest');
const app = require('../src/app.js');
const Message = require('../src/models/Message.js');

describe('Message API - Idempotency and Validation', () => {
    const mockMessage = {
        clientMessageId: 'msg_test_12345',
        conversationId: 'factory-safety-room',
        content: 'Machine 4 has an oil leak',
        createdAt: '2026-09-21T10:00:00.000Z',
    };

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('should save a new message and return 201', async () => {
        const savedMessage = {
            ...mockMessage,
            _id: 'mock_mongo_message_id',
        };

        jest
            .spyOn(Message.prototype, 'save')
            .mockResolvedValue(savedMessage);

        const response = await request(app)
            .post('/api/messages')
            .send(mockMessage);

        expect(response.status).toBe(201);
        expect(response.body.clientMessageId).toBe(
            mockMessage.clientMessageId
        );
        expect(response.body.content).toBe(mockMessage.content);
    });

    it('should return the existing message when the same clientMessageId is sent again', async () => {
        const existingMessage = {
            ...mockMessage,
            _id: 'existing_mongo_message_id',
        };

        // Simulate MongoDB duplicate-key error caused by
        // the unique clientMessageId constraint.
        const duplicateError = new Error('Duplicate key');

        duplicateError.code = 11000;
        duplicateError.keyPattern = {
            clientMessageId: 1,
        };

        jest
            .spyOn(Message.prototype, 'save')
            .mockRejectedValue(duplicateError);

        const findOneSpy = jest
            .spyOn(Message, 'findOne')
            .mockResolvedValue(existingMessage);

        const response = await request(app)
            .post('/api/messages')
            .send(mockMessage);

        expect(response.status).toBe(200);

        expect(response.body._id).toBe(
            existingMessage._id
        );

        expect(response.body.clientMessageId).toBe(
            mockMessage.clientMessageId
        );

        expect(findOneSpy).toHaveBeenCalledWith({
            clientMessageId: mockMessage.clientMessageId,
        });
    });

    it('should not create a second message for the same clientMessageId', async () => {
        const existingMessage = {
            ...mockMessage,
            _id: 'existing_mongo_message_id',
        };

        const duplicateError = new Error('Duplicate key');

        duplicateError.code = 11000;
        duplicateError.keyPattern = {
            clientMessageId: 1,
        };

        const saveSpy = jest
            .spyOn(Message.prototype, 'save')
            .mockRejectedValue(duplicateError);

        jest
            .spyOn(Message, 'findOne')
            .mockResolvedValue(existingMessage);

        const response = await request(app)
            .post('/api/messages')
            .send(mockMessage);

        expect(response.status).toBe(200);

        // The second request does not create another database record.
        expect(saveSpy).toHaveBeenCalledTimes(1);

        expect(response.body._id).toBe(
            existingMessage._id
        );
    });

    it('should reject a message when required fields are missing', async () => {
        const invalidMessage = {
            conversationId: 'factory-safety-room',
            content: 'Machine 4 has an oil leak',
            createdAt: '2026-09-21T10:00:00.000Z',
        };

        const response = await request(app)
            .post('/api/messages')
            .send(invalidMessage);

        expect(response.status).toBe(400);

        expect(response.body.error).toBe(
            'clientMessageId, conversationId, content and createdAt are required'
        );
    });

    it('should return messages ordered by createdAt and _id', async () => {
        const messages = [
            {
                _id: 'message_1',
                clientMessageId: 'msg_1',
                conversationId: 'factory-safety-room',
                content: 'First message',
                createdAt: new Date('2026-09-21T10:00:00.000Z'),
            },
            {
                _id: 'message_2',
                clientMessageId: 'msg_2',
                conversationId: 'factory-safety-room',
                content: 'Second message',
                createdAt: new Date('2026-09-21T10:01:00.000Z'),
            },
        ];

        const sortSpy = jest.fn().mockResolvedValue(messages);

        jest.spyOn(Message, 'find').mockReturnValue({
            sort: sortSpy,
        });

        const response = await request(app)
            .get('/api/messages')
            .query({
                conversationId: 'factory-safety-room',
            });

        expect(response.status).toBe(200);

        expect(response.body).toHaveLength(2);

        expect(response.body[0].clientMessageId).toBe('msg_1');
        expect(response.body[1].clientMessageId).toBe('msg_2');

        expect(Message.find).toHaveBeenCalledWith({
            conversationId: 'factory-safety-room',
        });

        expect(sortSpy).toHaveBeenCalledWith({
            createdAt: 1,
            _id: 1,
        });
    });

    it('should simulate temporary failure (503) without saving message', async () => {
        const saveSpy = jest.spyOn(Message.prototype, 'save');

        const response = await request(app)
            .post('/api/messages')
            .send({
                ...mockMessage,
                simulateFailure: true,
            });

        expect(response.status).toBe(503);
        expect(response.body.error).toContain('Simulated temporary backend failure');
        expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should simulate lost acknowledgement: message saved but error returned, then idempotent retry succeeds with 200', async () => {
        const savedMessage = {
            ...mockMessage,
            _id: 'mongo_lost_ack_id',
        };

        // First attempt: simulate lost ack - message saves, but returns 500
        jest.spyOn(Message.prototype, 'save').mockResolvedValue(savedMessage);

        const firstResponse = await request(app)
            .post('/api/messages')
            .send({
                ...mockMessage,
                simulateLostAck: true,
            });

        expect(firstResponse.status).toBe(500);
        expect(firstResponse.body.error).toContain('Simulated lost acknowledgement');

        // Second attempt: client retries the same clientMessageId (without simulation flag).
        // Database triggers duplicate key error.
        const duplicateError = new Error('Duplicate key');
        duplicateError.code = 11000;
        duplicateError.keyPattern = { clientMessageId: 1 };

        jest.spyOn(Message.prototype, 'save').mockRejectedValue(duplicateError);
        jest.spyOn(Message, 'findOne').mockResolvedValue(savedMessage);

        const retryResponse = await request(app)
            .post('/api/messages')
            .send(mockMessage);

        expect(retryResponse.status).toBe(200);
        expect(retryResponse.body.clientMessageId).toBe(mockMessage.clientMessageId);
        expect(retryResponse.body._id).toBe(savedMessage._id);
    });

    it('should reset messages when requested', async () => {
        jest.spyOn(Message, 'deleteMany').mockResolvedValue({ deletedCount: 5 });

        const response = await request(app)
            .delete('/api/messages/reset')
            .query({ conversationId: 'factory-safety-room' });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('reset successfully');
        expect(Message.deleteMany).toHaveBeenCalledWith({
            conversationId: 'factory-safety-room',
        });
    });
});