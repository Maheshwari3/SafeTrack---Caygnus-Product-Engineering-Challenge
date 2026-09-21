# SafeTrack — Backend API (Node.js / Express / MongoDB)

This service is the backend API for **SafeTrack**, providing server-side message ingestion, persistence, deduplication, and simulation endpoints for testing offline synchronization scenarios.

---

## Key Features

1. **Idempotent Ingestion (`POST /api/messages`)**
   - Every message includes a client-generated UUID (`clientMessageId`).
   - The `Message` collection in MongoDB enforces a strict unique index on `{ clientMessageId: 1 }`.
   - If a client retries due to an uncertain acknowledgement or lost connection, the backend catches MongoDB duplicate key code `11000` and returns `200 OK` with the existing document instead of creating a duplicate.

2. **Sequential Retrieval (`GET /api/messages`)**
   - Returns messages ordered by `createdAt ASC, _id ASC` to ensure FIFO causal ordering.

3. **Simulation Endpoints for Reviewers & Automated Testing**
   - **Simulated 503 Temporary Error**: Send header `x-simulate-failure: true` or JSON field `simulateFailure: true`. Returns HTTP 503 Service Unavailable without writing to the database.
   - **Simulated Lost Acknowledgement**: Send header `x-simulate-lost-ack: true` or JSON field `simulateLostAck: true`. Saves the message to MongoDB, but drops the response with HTTP 500 to simulate a network drop right after server persistence.
   - **Reset Endpoint (`DELETE /api/messages/reset`)**: Clears test messages for repeatable automated verification benchmarks.

---

## Environment Setup

Create `.env` inside this folder:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/safetrack
NODE_ENV=development
```

---

## Installation & Running

```powershell
npm install
npm run dev
```

The server listens on `http://localhost:5000`.

---

## Automated Tests

Run the test suite using Jest and Supertest:

```powershell
npm test
```

### Observed Test Output
```text
PASS tests/incident.test.js
PASS tests/message.test.js
  Message API - Idempotency and Validation
    √ should save a new message and return 201
    √ should return the existing message when the same clientMessageId is sent again
    √ should not create a second message for the same clientMessageId
    √ should reject a message when required fields are missing
    √ should return messages ordered by createdAt and _id
    √ should simulate temporary failure (503) without saving message
    √ should simulate lost acknowledgement: message saved but error returned, then idempotent retry succeeds with 200
    √ should reset messages when requested

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        1.85 s
```
