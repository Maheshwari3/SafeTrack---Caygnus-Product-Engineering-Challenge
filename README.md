# SafeTrack — Offline-Capable Factory Safety Conversation

SafeTrack is an **offline-first factory safety mobile application** built for the **Caygnus Product Engineering Challenge**.

The application allows factory workers to send safety-related messages even when there is no internet connection. Messages are stored locally on the device and synchronized with the backend when connectivity is restored.

The project focuses on:

* Offline message creation
* Durable local persistence
* Automatic synchronization
* Failed synchronization and retry
* Application restart durability
* Deterministic message ordering
* Idempotent message ingestion
* Server-side persistence

---

## Selected Problem

**Problem 2 — Offline-Capable Mobile Conversation**

SafeTrack demonstrates how a mobile conversation system can continue working when network connectivity is unavailable.

A message follows this lifecycle:

```text
User creates message
        ↓
Generate clientMessageId
        ↓
Save to SQLite
        ↓
     PENDING
        ↓
Network available
        ↓
   SyncManager
        ↓
Node.js / Express
        ↓
     MongoDB
        ↓
    DELIVERED
```

If synchronization fails:

```text
SYNCHRONIZING
       ↓
     FAILED
       ↓
      RETRY
       ↓
SYNCHRONIZING
       ↓
    DELIVERED
```

---

# Key Features

### Offline messaging

Users can create safety messages without an internet connection.

Messages are stored locally instead of being lost.

### Durable local storage

SQLite is used as a local outbox so messages survive application termination and restart.

### Automatic synchronization

When network connectivity returns, the Sync Manager detects the connection and synchronizes pending messages with the backend.

### Failure handling

If synchronization fails, the message remains locally available and can be retried.

### Message ordering

Queued messages are processed in deterministic local creation order.

### Idempotency

Each message has a stable `clientMessageId`.

The backend uses this identifier to prevent duplicate server-side messages when the same request is retried.

---

# Architecture

```text
┌──────────────────────────────┐
│       React Native App       │
│                              │
│    Conversation Screen       │
│             ↓                │
│    Message Repository        │
│             ↓                │
│       SQLite Database        │
│             ↓                │
│        Local Outbox          │
│             ↓                │
│        SyncManager           │
└──────────────┬───────────────┘
               │
               │ HTTP REST API
               ↓
┌──────────────────────────────┐
│      Node.js + Express       │
│                              │
│       Message API            │
│       Idempotency            │
└──────────────┬───────────────┘
               │
               ↓
┌──────────────────────────────┐
│           MongoDB            │
│                              │
│      Server Messages         │
└──────────────────────────────┘
```

---

# Main Components

## Conversation Screen

Responsible for:

* Displaying the factory safety conversation
* Creating new messages
* Displaying messages immediately
* Showing delivery state
* Providing retry actions

## Message Repository

Provides the interface between the application and SQLite.

It manages:

* Creating messages
* Reading messages
* Finding pending messages
* Updating delivery state
* Updating retry information

## SQLite Local Outbox

SQLite provides durable local storage for outgoing messages.

Messages are persisted before synchronization so they can survive:

* Network loss
* Backend failures
* Application restarts

## SyncManager

The Sync Manager coordinates synchronization between the mobile application and backend.

It handles:

* Connectivity changes
* Pending message retrieval
* Synchronization
* Delivery-state updates
* Failure handling
* Retry handling
* Message ordering

## Node.js / Express

The backend receives messages from the mobile application and stores them in MongoDB.

It also handles idempotent message ingestion using `clientMessageId`.

## MongoDB

MongoDB provides server-side message persistence.

The client-generated message identifier is used to prevent duplicate server-side records.

---

# Message Lifecycle

A message can move through the following states:

```text
PENDING
   ↓
SYNCHRONIZING
   ↓
DELIVERED
```

When synchronization fails:

```text
PENDING
   ↓
SYNCHRONIZING
   ↓
FAILED
```

A failed message can be retried:

```text
FAILED
   ↓
RETRY
   ↓
SYNCHRONIZING
   ↓
DELIVERED
```

---

# Technology Stack

| Technology   | Purpose                             |
| ------------ | ----------------------------------- |
| React Native | Mobile application                  |
| TypeScript   | Application development             |
| SQLite       | Durable local message storage       |
| NetInfo      | Network connectivity monitoring     |
| UUID         | Stable client-generated message IDs |
| Node.js      | Backend runtime                     |
| Express      | REST API                            |
| MongoDB      | Server-side persistence             |
| Mongoose     | MongoDB data modeling               |

---

# Why These Technologies?

### React Native

Used to build the mobile application and provide the Android implementation required for the challenge.

### SQLite

Used for durable local storage because offline messages must survive application restart.

### NetInfo

Used to monitor network connectivity and trigger synchronization when connectivity returns.

### UUID

Used to generate stable client-side message identifiers before synchronization.

### Node.js + Express

Used to build a lightweight REST backend suitable for the challenge.

### MongoDB

Used for server-side message persistence and idempotent message ingestion.

---

# Project Structure

```text
SafeTrack/
│
├── android/
├── ios/
├── src/
│   ├── components/
│   ├── screens/
│   ├── database/
│   ├── repositories/
│   └── sync/
│
├── backend/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   └── server.js
│
├── __tests__/
│
├── App.tsx
├── package.json
└── README.md
```

> Adjust the folder names above if your actual repository structure differs.

---

# Prerequisites

Install the following before running the project:

* Node.js 18+
* Android Studio
* Android SDK
* React Native development environment
* Android emulator or physical Android device
* MongoDB

---

# Backend Setup

From the project root:

```powershell
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
MONGODB_URI=<your-mongodb-connection-string>
PORT=5000
```

Do not commit `.env` or any secret values.

Start the backend:

```powershell
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

---

# Mobile Setup

From the project root:

```powershell
npm install
```

Start Metro:

```powershell
npm start
```

In another terminal:

```powershell
npx react-native run-android
```

For a physical Android device, configure the mobile API URL to use the development machine's local network IP address instead of `localhost`.

Example:

```text
http://<YOUR-PC-IP>:5000
```

---

# Environment Variables

The backend requires:

```env
MONGODB_URI=<your-mongodb-connection-string>
PORT=5000
```

Never commit:

```text
.env
API keys
Passwords
Access tokens
Private credentials
```

---

# API

## Create Message

```http
POST /api/messages
```

Example request:

```json
{
  "clientMessageId": "msg-123",
  "conversationId": "factory-safety",
  "content": "Oil leakage detected near machine 4",
  "createdAt": "2026-09-20T10:00:00.000Z"
}
```

## Get Messages

```http
GET /api/messages
```

The backend uses `clientMessageId` to identify the logical message and prevent duplicate records.

---

# Offline Scenario

### 1. Disable network

Turn off Wi-Fi/mobile connectivity or otherwise make the device offline.

### 2. Send a message

Create a safety message in the Factory Safety conversation.

### 3. Local persistence

The message is immediately stored in SQLite.

```text
Message
   ↓
SQLite
   ↓
PENDING
```

### 4. Restore connectivity

When the network becomes available:

```text
PENDING
   ↓
SYNCHRONIZING
   ↓
Backend
   ↓
MongoDB
   ↓
DELIVERED
```

---

# Application Restart Scenario

Offline messages are stored in SQLite rather than only in React state.

Therefore:

```text
Create message
      ↓
SQLite
      ↓
Force-close app
      ↓
Open app
      ↓
Message remains available
```

This provides durability across application restarts.

---

# Failure and Retry

If synchronization fails:

```text
SYNCHRONIZING
       ↓
     FAILED
```

The message remains locally available.

After the network/backend problem is resolved, the message can be retried:

```text
FAILED
   ↓
RETRY
   ↓
SYNCHRONIZING
   ↓
DELIVERED
```

---

# Message Ordering

Pending messages are processed according to their local creation order.

The ordering policy is:

```sql
ORDER BY createdAt ASC, id ASC
```

The Sync Manager processes queued messages sequentially.

This provides predictable ordering for messages created while offline.

---

# Idempotency

Every message receives a stable `clientMessageId`.

Example:

```text
clientMessageId = abc123
```

The same identifier is reused when the message is retried.

If the backend receives:

```text
Request 1
clientMessageId = abc123
```

the message is created.

If the backend later receives:

```text
Request 2
clientMessageId = abc123
```

the backend recognizes that the logical message already exists and does not create another duplicate message.

This protects against duplicate messages when a request is retried after an uncertain network acknowledgement.

---

# Testing

## Mobile tests

From the project root:

```powershell
npm test -- --runInBand
```

## Backend tests

```powershell
cd backend
npm test
```

Before submitting the challenge, record the actual test results.

Example:

```text
Mobile tests: X passed
Backend tests: X passed
```

---

# Acceptance Scenarios

## AC1 — Offline Send

1. Disable network connectivity.
2. Open the Factory Safety conversation.
3. Send a safety message.
4. Verify that the message appears immediately.
5. Verify that the message is stored locally.
6. Verify that its state is pending.

## AC2 — Force-Close Durability

1. Disable network connectivity.
2. Send a message.
3. Verify that it is pending.
4. Force-close the application.
5. Reopen the application.
6. Verify that the message is still available.

## AC3 — Reconnection Sync

1. Create one or more messages while offline.
2. Restore network connectivity.
3. Verify that synchronization starts.
4. Verify that messages are sent to the backend.
5. Verify that messages are stored in MongoDB.
6. Verify that the local state becomes delivered.

## AC4 — Temporary Failure and Retry

1. Create a message while offline.
2. Trigger a temporary synchronization/backend failure.
3. Verify the failed state.
4. Restore the required network/backend condition.
5. Retry the message.
6. Verify successful synchronization.

## AC5 — Idempotency

1. Create a message.
2. Record its `clientMessageId`.
3. Submit the same logical message again using the same `clientMessageId`.
4. Verify that the backend does not create a duplicate server-side record.

---

# Verification Benchmark

A useful verification benchmark is:

1. Disable network connectivity.
2. Queue at least 10 messages.
3. Verify that the messages are stored locally.
4. Restart the application.
5. Verify that the messages remain available.
6. Restore connectivity.
7. Allow synchronization to complete.
8. Verify the resulting backend records.
9. Repeat a request using an existing `clientMessageId`.
10. Verify that no duplicate record is created.

Record the actual observed results before submission.

```text
Messages queued:
Messages remaining after restart:
Messages synchronized:
Messages failed:
Duplicate requests tested:
Duplicate records created:
Final result:
```

---

# Important Engineering Decisions

## Durable local outbox

SQLite is used as the durable source for outgoing messages.

This prevents messages from being lost when the device is offline or the application is restarted.

## Stable client-generated identifiers

`clientMessageId` is generated before synchronization.

The identifier remains the same during retries, allowing the backend to identify repeated requests.

## Sequential synchronization

Pending messages are processed sequentially according to their local creation order.

This provides deterministic behavior and simplifies synchronization failure handling.

## Idempotent ingestion

The backend uses `clientMessageId` to prevent duplicate server-side messages.

This is important because a network failure can happen after the server receives a message but before the client receives the response.

---

# Assumptions and Limitations

The current implementation focuses on the challenge requirements.

Known limitations:

* Authentication is outside the scope of the challenge.
* User profiles are outside the scope.
* Incoming real-time messages are outside the current implementation.
* Images, audio, video, and other attachments are not supported.
* The backend is intended as a challenge prototype.
* The development configuration uses a local backend address.
* Background synchronization while the application is completely terminated is not implemented.
* Production deployment would require HTTPS.
* Production deployment would require authentication and authorization.
* Production deployment would require additional monitoring and security controls.

---

# Production Improvements

The submitted implementation focuses on the core challenge requirements.

For production, I would consider:

### Security

* HTTPS
* Authentication
* Authorization
* Secure credential handling
* Input validation
* Rate limiting

### Synchronization

* Background synchronization
* Exponential backoff
* Jitter
* Stronger acknowledgement handling
* Conflict resolution for bidirectional synchronization

### Backend

* Database indexing
* Pagination
* Connection pooling
* Horizontal scaling
* Queue-based processing where appropriate
* Production database monitoring

### Observability

* Structured logging
* Metrics
* Distributed tracing
* Error tracking
* Synchronization monitoring
* Alerting

### Testing

* Integration tests
* End-to-end tests
* Device-level tests
* Failure-injection tests
* CI/CD automation

These are proposed production improvements and are not claimed as functionality already implemented in the submitted version.

---

# AI Usage

AI tools were used during development for:

* Understanding challenge requirements
* Discussing architecture and implementation approaches
* Debugging development issues
* Reviewing implementation details
* Assisting with code and documentation

AI-generated suggestions were reviewed and adapted during implementation.

Application behavior was manually tested during development.

---

# Demo

The demo should show the complete offline-to-online workflow.

Recommended sequence:

1. Open SafeTrack.
2. Show the Factory Safety conversation.
3. Send a message while online.
4. Disable network connectivity.
5. Send a message while offline.
6. Show that the message appears immediately.
7. Show the pending state.
8. Force-close the application.
9. Reopen the application.
10. Show that the message is still available.
11. Restore network connectivity.
12. Show synchronization.
13. Show the message becoming delivered.
14. Demonstrate a temporary synchronization failure.
15. Show the failed state.
16. Retry the message.
17. Show successful synchronization.
18. Demonstrate duplicate prevention using `clientMessageId`.

---

# Repository

**GitHub Repository:**

https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge

**Selected Problem:**

Problem 2 — Offline-Capable Mobile Conversation

**Project:**

SafeTrack
