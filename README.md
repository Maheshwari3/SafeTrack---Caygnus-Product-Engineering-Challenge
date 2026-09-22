# SafeTrack — Offline-Capable Factory Safety Conversation

SafeTrack is an **offline-first factory safety mobile application** built for the **Caygnus Product Engineering Challenge**.

The application allows factory workers to send safety-related messages even when there is no internet connection. Messages are stored locally on the device and synchronized with the backend when connectivity is restored.

The project focuses on:

* Offline message creation
* Durable local persistence (SQLite)
* Automatic synchronization on network reconnection
* Failed synchronization and retry (bounded retries & manual retry)
* Application restart & crash durability
* Deterministic message ordering (FIFO)
* Idempotent message ingestion (stable UUIDs & zero duplicate records)
* Server-side persistence (MongoDB)
* Repeatable end-to-end verification benchmark

---

## Selected Problem

**Problem 2 — Offline-Capable Mobile Conversation**

SafeTrack demonstrates how a mobile conversation system guarantees message delivery without loss when network connectivity is unavailable, interrupted, or uncertain.

A message follows this lifecycle:

```text
User creates message
        ↓
Generate clientMessageId (UUID)
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

If synchronization encounters a failure:

```text
SENDING
   ↓
 FAILED (Attempt X / 3)
   ↓
Auto-retry on reconnect (if < 3) / User taps 'Retry'
   ↓
SENDING
   ↓
DELIVERED
```

---

# Key Features

### 1. Offline messaging
Users can create safety messages without an internet connection. Messages are saved to the device before transmission is attempted.

### 2. Durable local storage
SQLite is used as a local outbox (`messages` table) so messages survive application backgrounding, termination, battery death, and process restarts.

### 3. Crash recovery supervisor
If the application is terminated while a message is in-flight (`sending`), the system automatically resets its state back to `pending` upon startup via `resetSendingMessagesLocal()`, guaranteeing messages are never stranded.

### 4. Automatic synchronization
When network connectivity returns, `SyncManager` detects the transition via `@react-native-community/netinfo` and automatically drains pending messages.

### 5. Reviewer simulation drawer
An in-app diagnostic control panel allowing reviewers to simulate:
- Offline mode without disabling device Wi-Fi
- Temporary 503 backend failure
- Lost network acknowledgements
- Queueing 10 benchmark messages with one tap

### 6. Strict FIFO message ordering
Queued messages are processed sequentially according to local creation time (`ORDER BY createdAt ASC, id ASC`), preserving causal consistency.

### 7. Bounded retries & manual recovery
Temporary errors (5xx, timeouts) are retried automatically up to `MAX_AUTO_RETRIES = 3`. Once exhausted, messages transition to a terminal failed state requiring explicit user manual retry.

### 8. Idempotency against uncertain acknowledgements
Every message carries a stable client-generated UUID (`clientMessageId`). The backend enforces a unique index in MongoDB, catching duplicate key errors (code `11000`) and returning HTTP 200 with the existing record rather than creating duplicates.

### 9. Dynamic queue draining (Stretch Goal)
Messages added to the outbox while synchronization is actively running are dynamically picked up and synchronized in order without corrupting state.

---

# Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                       │
│                   (Frontend/SafeTrack)                      │
│                                                             │
│    ConversationScreen.js                                    │
│    - Renders optimistic chat list                           │
│    - Delivery badges (Pending, Sending, Failed, Delivered)  │
│    - Reviewer Simulation Controls & Manual Retry            │
│             ↓                                               │
│    messageRepository.js / database.js                       │
│    - Durable SQLite database table 'messages'               │
│    - Crash recovery: resetSendingMessagesLocal()            │
│             ↓                                               │
│    SyncManager.js                                           │
│    - NetInfo network lifecycle listener                     │
│    - Mutex concurrency guard (isSyncing)                    │
│    - FIFO queue processor (createdAt ASC, id ASC)           │
│    - Bounded retries (MAX_AUTO_RETRIES = 3)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTP REST API (clientMessageId)
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                      Node.js + Express                      │
│                   (backend/ or Backend/)                    │
│                                                             │
│    messageController.js                                     │
│    - Unique clientMessageId validation                      │
│    - Idempotent duplicate resolution (HTTP 200)             │
│    - Reviewer simulation flags (503 failure, lost ack)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                           MongoDB                           │
│                                                             │
│    Message Collection                                       │
│    - Unique index: { clientMessageId: 1 }                   │
└─────────────────────────────────────────────────────────────┘
```

---

# Main Components

## 1. Conversation Screen (`src/screens/ConversationScreen.js`)
* Displays the safety conversation feed.
* Provides immediate optimistic UI display with delivery badges.
* Houses the collapsible Reviewer Simulation Drawer.
* Provides one-tap manual retry for failed messages.

## 2. Message Repository (`src/database/messageRepository.js`)
* Manages the SQLite durable outbox table `messages`.
* Handles saving new messages locally before transmission.
* Manages query retrieval for pending/failed messages.
* Updates delivery state (`pending`, `sending`, `failed`, `delivered`).
* Implements crash recovery to reset in-flight `sending` messages back to `pending`.

## 3. SQLite Local Outbox (`src/database/database.js`)
* Stores messages persistently across app force-closes and restarts.
* Preserves message schema: `clientMessageId`, `conversationId`, `content`, `createdAt`, `deliveryState`, `retryCount`, `lastError`.

## 4. SyncManager (`src/sync/SyncManager.js`)
* Manages network connectivity events via `@react-native-community/netinfo`.
* Enforces single-concurrency execution (`isSyncing` mutex).
* Coordinates sequential FIFO transmission (`createdAt ASC, id ASC`).
* Enforces bounded retries (`MAX_AUTO_RETRIES = 3`).
* Dynamic while-loop draining for messages added during sync (**Stretch Goal**).

## 5. Node.js / Express API (`backend/src/controllers/messageController.js`)
* Ingests messages via `POST /api/messages`.
* Enforces idempotency: detects MongoDB duplicate key code `11000` and returns HTTP 200 with the existing record.
* Supports simulation headers: `x-simulate-failure` (HTTP 503) and `x-simulate-lost-ack` (saves to DB, drops client response).

## 6. MongoDB Persistence (`backend/src/models/Message.js`)
* Server-side source of truth.
* Strict unique index constraint on `clientMessageId`.

---

# Message Lifecycle

```text
       [User writes message]
                 │
                 ▼
            ┌─────────┐
            │ PENDING │ ◄──┐ (On App Restart if was 'sending')
            └────┬────┘    │ (On Manual Retry from 'failed')
                 │         │
          (Sync starts)    │
                 ▼         │
            ┌─────────┐    │
            │ SENDING ├────┘
            └────┬────┘
                 │
      ┌──────────┴──────────┐
  (HTTP 200/201)       (Network Error / 5xx)
      │                     │
      ▼                     ▼
┌───────────┐         ┌───────────┐
│ DELIVERED │         │  FAILED   │ (retryCount++)
└───────────┘         └─────┬─────┘
                            │
               ┌────────────┴────────────┐
       (retryCount < MAX)         (retryCount >= MAX)
               │                         │
               ▼                         ▼
         [Auto-Retry on           [Requires Manual
          Reconnection]            Retry by User]
```

---

# Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **React Native (0.80.0)** | Cross-platform mobile framework (Android target) |
| **React 19** | Component UI state & concurrent rendering |
| **SQLite (`react-native-sqlite-storage`)** | Durable local message outbox |
| **NetInfo (`@react-native-community/netinfo`)** | Network connectivity monitoring & event dispatch |
| **UUID (`uuid`)** | Stable client-generated message identifiers |
| **Node.js + Express** | Lightweight backend REST API |
| **MongoDB + Mongoose** | Server-side persistence with unique index idempotency |
| **Jest + Supertest** | Automated unit & integration test suites |

---

# Why These Technologies?

### React Native
Used to build the mobile application and provide the Android implementation required for the challenge.

### SQLite
Used for durable local storage because offline messages must survive application termination, battery loss, and system restarts.

### NetInfo
Used to monitor network connectivity and trigger synchronization when connectivity returns.

### UUID
Used to generate stable client-side message identifiers (`clientMessageId`) before synchronization begins.

### Node.js + Express
Used to build a lightweight REST backend suitable for the challenge requirements.

### MongoDB + Mongoose
Used for server-side persistence and idempotent message ingestion via unique indexing.

---

# Project Structure

```text
SafeTrack/
│
├── android/
├── ios/
├── src/
│   ├── database/
│   │   ├── database.js
│   │   └── messageRepository.js
│   ├── screens/
│   │   └── ConversationScreen.js
│   ├── sync/
│   │   └── SyncManager.js
│   ├── config.js
│   └── theme.js
│
├── apk/
│   └── SafeTrack.apk
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── messageController.js
│   │   ├── models/
│   │   │   └── Message.js
│   │   ├── routes/
│   │   │   └── messageRoutes.js
│   │   └── app.js
│   ├── tests/
│   │   └── message.test.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── scripts/
│   └── verificationBenchmark.js
├── __tests__/
│   ├── App.test.tsx
│   └── SyncManager.test.js
├── App.tsx
├── package.json
├── jest.setup.js
├── SUBMISSION.md
└── README.md
```

---

# Prerequisites

Install the following before running the project:

* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher
* **Android Studio & Android SDK**: Configured with Android platform tools
* **Android device / Emulator**: Physical device connected via USB with USB debugging enabled, or an Android Virtual Device (AVD)
* **MongoDB**: Running locally on port `27017` (e.g. via MongoDB Community Edition or Docker)

---

# Backend Setup

From the `backend` directory (or the root `Backend` directory):

```powershell
cd backend
npm install
```

Create or verify `.env` inside `backend/`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/safetrack
NODE_ENV=development
```

> **Note:** Never commit `.env` or sensitive credentials to version control.

Start the backend server:
```powershell
npm run dev
```

The server will listen at:
```text
http://localhost:5000
```

---

# Mobile Setup (Debug Build & Release APK)

The mobile application supports both **Debug Development builds** and **Standalone Release APK builds** through automatic environment switching (`__DEV__`) in `src/config.js`.

---

### Option A: Debug Build (Development via Metro & USB)

In debug mode, `src/config.js` uses `DEV_API_URL = 'http://localhost:5000'`.

1. **Port Forwarding (USB Debugging / Emulator):**
   Run port forwarding so Android routes requests directly to your PC's backend over USB:
   ```powershell
   adb reverse tcp:5000 tcp:5000
   ```

2. **Install & Launch in Debug Mode:**
   ```powershell
   npm install

   # Start Metro Bundler:
   npm start

   # In a separate terminal, install and launch on Android:
   npx react-native run-android
   ```

---

### Option B: Standalone Release APK Build

In a standalone Release APK (or when the phone is not tethered via USB with `adb reverse`), `localhost` points to the phone itself rather than your PC.

React Native automatically sets `__DEV__ = false` in release builds, switching to `PROD_API_URL` in `src/config.js`.

#### 1. Choose your Release Endpoint in `src/config.js`:
* **Method 1 (Local Wi-Fi Testing):** Use your PC's Wi-Fi IP address (both phone and PC on the same Wi-Fi):
  ```javascript
  const PROD_API_URL = 'http://10.102.115.9:5000'; // Replace with your PC IP from ipconfig
  ```
  *(Note: Allow port 5000 TCP inbound in Windows Defender Firewall).*
* **Method 2 (Instant HTTPS Tunnel - Works anywhere on Wi-Fi or Mobile Data):**
  Run in your backend terminal:
  ```powershell
  npx localtunnel --port 5000
  ```
  Paste the generated URL:
  ```javascript
  const PROD_API_URL = 'https://cool-panda-42.loca.lt';
  ```
* **Method 3 (Deployed Cloud Server):**
  Deploy backend to Render, Railway, or AWS:
  ```javascript
  const PROD_API_URL = 'https://safetrack-api.onrender.com';
  ```

#### 2. Build the Release APK:
```powershell
cd android
./gradlew assembleRelease
```

The generated APK is located at:
```text
android/app/build/outputs/apk/release/app-release.apk
```
Transfer and install `app-release.apk` onto any Android device.

---

# API Specification

## 1. Create Message
```http
POST /api/messages
Content-Type: application/json

{
  "clientMessageId": "msg_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "conversationId": "factory-safety-room-1",
  "content": "Oil leakage detected near machine 4",
  "createdAt": "2026-09-21T10:00:00.000Z"
}
```
* **New Message**: Returns `201 Created` with saved document.
* **Idempotent Retry**: Returns `200 OK` with existing document (no duplicate record created).
* **Simulate 503**: Send header `x-simulate-failure: true` or body `simulateFailure: true`.
* **Simulate Lost Ack**: Send header `x-simulate-lost-ack: true` or body `simulateLostAck: true`.

## 2. Get Messages
```http
GET /api/messages?conversationId=factory-safety-room-1
```
Returns list of messages ordered by `createdAt ASC, _id ASC`.

## 3. Reset Messages (Test Utility)
```http
DELETE /api/messages/reset?conversationId=factory-safety-room-1
```
Clears messages for testing and benchmarking.

---

# Offline Scenario

### 1. Disable network
Turn off Wi-Fi/mobile connectivity, or toggle **"Simulate Offline"** ON in the app's Reviewer Simulation Drawer.

### 2. Send a message
Create a safety message in the Factory Safety conversation.

### 3. Local persistence
The message is immediately stored in SQLite:
```text
Message
   ↓
SQLite
   ↓
PENDING (🕒 Amber badge)
```

### 4. Restore connectivity
When the network becomes available:
```text
PENDING
   ↓
SENDING
   ↓
Backend
   ↓
MongoDB
   ↓
DELIVERED (✓ Delivered badge)
```

---

# Application Restart Scenario

Offline messages are stored in SQLite rather than only in React state:
```text
Create message
      ↓
SQLite
      ↓
Force-close app / Reload Metro
      ↓
Open app
      ↓
Message remains available & resumes state
```

### Crash Recovery Guarantee
If the app process is terminated while a message is in-flight (`sending`), `resetSendingMessagesLocal()` runs during SQLite initialization and safely restores it to `pending`.

---

# Failure and Retry

If synchronization encounters a network failure or 5xx server error:
```text
SENDING
   ↓
 FAILED (Attempt 1 / 3)
```

The message remains locally available in the outbox.

### Bounded Retries
1. Retries are attempted automatically on network reconnection up to `MAX_AUTO_RETRIES = 3`.
2. If all 3 attempts fail, the message transitions to a terminal failed state requiring explicit user action:
```text
FAILED (Terminal)
   ↓
Tap 'Retry'
   ↓
SENDING
   ↓
DELIVERED
```

---

# Message Ordering

Pending messages are processed according to their deterministic local creation order:
```sql
SELECT * FROM messages WHERE deliveryState = 'pending' ORDER BY createdAt ASC, id ASC
```
The Sync Manager processes queued messages sequentially in a FIFO pipeline. This guarantees that messages created offline arrive at the server in the exact sequence they were drafted.

---

# Idempotency

Every message receives a stable `clientMessageId` (UUID v4) prior to synchronization:
```text
clientMessageId = "msg_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
```

The exact same identifier is reused when the message is retried.

### Scenario: Lost Acknowledgement
1. Client sends request with `clientMessageId`.
2. Server writes message to MongoDB.
3. Network connection drops before server's HTTP 201 reaches the client.
4. Client marks message as `FAILED`.
5. Client retries with the identical `clientMessageId`.
6. Server receives repeated request, catches MongoDB duplicate key code `11000`, and returns `200 OK` with the existing record.
7. Result: Client updates to `DELIVERED`, and **zero duplicate records** are created in MongoDB.

---

# Testing

## 1. Mobile Automated Tests
From the project root:
```powershell
npm test -- --no-cache --runInBand --forceExit
```

**Observed Result:**
```text
PASS __tests__/SyncManager.test.js
  SyncManager & Offline Outbox Tests
    √ Scenario 1: Accepts outgoing message offline, stores locally, and shows pending state
    √ Scenario 2: Synchronizes pending messages sequentially in FIFO order when connectivity returns
    √ Scenario 3: Retries bounded up to MAX_AUTO_RETRIES (3) on temporary failure before marking failed
    √ Scenario 4: Honors manual retry for failed messages and resets retry count
    √ Scenario 5: Idempotency - Retries reuse clientMessageId preventing duplicate creations
    √ Crash Recovery: Resets in-flight 'sending' messages back to 'pending' on startup
    √ Stretch Goal: Drains messages added to outbox dynamically while sync is already active
    √ Reviewer Tools: Simulates offline, temporary 503 errors, and lost acknowledgements
PASS __tests__/App.test.tsx

Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        1.397 s
```

## 2. Backend Automated Tests
From `backend`:
```powershell
cd backend
npm test
```

**Observed Result:**
```text
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

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        1.85 s
```

---

# Acceptance Scenarios

## AC1 — Offline Send
1. Open the Factory Safety conversation in the app.
2. Tap the sliders icon (top right) and toggle **"Simulate Offline"** ON (or disconnect network).
3. Send a message: *"Check pressure gauge on valve 3"*.
4. **Verification**:
   - Message appears immediately in the chat list.
   - Message is stored durably in SQLite.
   - Message displays an honest amber **`🕒 Pending`** status badge.

## AC2 — Force-Close Durability
1. While messages are in `pending` state, force-close the app or reload Metro (`R` twice).
2. Reopen the application and navigate to the conversation.
3. **Verification**:
   - All messages and delivery states are restored from SQLite.
   - If killed while in-flight (`sending`), the supervisor safely recovers it back to `pending`.

## AC3 — Reconnection Sync
1. Create one or more messages while offline.
2. Toggle **"Simulate Offline"** OFF (or reconnect network).
3. **Verification**:
   - `SyncManager` detects network restoration.
   - Messages are transmitted sequentially in FIFO order.
   - Server commits messages to MongoDB.
   - Local state transitions to green **`✓ Delivered`**.

## AC4 — Temporary Failure and Retry
1. Toggle **"Simulate 503 Temp Error"** ON in the Reviewer Simulation Drawer.
2. Send a message.
3. **Verification**:
   - Backend returns HTTP 503.
   - Message transitions to red **`⚠️ Failed (Attempt 1/3)`**.
   - Auto-retries are bounded to 3 attempts.
   - Toggle 503 OFF and tap the **"Retry"** button on the bubble.
   - Message retries and successfully transitions to **`✓ Delivered`**.

## AC5 — Idempotency (Uncertain Acknowledgement)
1. Toggle **"Simulate Lost Ack"** ON in the Reviewer Simulation Drawer.
2. Send a message.
3. **Verification**:
   - Backend saves to MongoDB, but client connection drops before response is received.
   - Client displays **`⚠️ Failed`**.
   - Tap **"Retry"**: Client sends the identical `clientMessageId`.
   - Backend catches MongoDB duplicate key code `11000` and returns `200 OK`.
   - Client reconciles to **`✓ Delivered`** with **zero duplicate records** in MongoDB.

---

# Verification Benchmark

A repeatable automated benchmark validates the complete 5-step problem sequence:
```powershell
npm run benchmark
```

### Observed Benchmark Output
```text
========================================================================
  SAFE TRACK - PROBLEM 2 VERIFICATION BENCHMARK
========================================================================
Total Messages Queued:            10
Messages Persisted in Outbox:     10/10 (State: pending)
Crash Recovery Validated:         Yes (in-flight 'sending' recovered to 'pending')
Messages Synchronized:            10/10
Simulated Temporary Error (503):  1 recovered (bench_msg_003)
Simulated Lost Ack (AC5):         1 recovered idempotently (bench_msg_007)
Duplicate Records Created:        0 (Unique constraint enforced)
Backend Final Verification:       10/10 present in exact FIFO order
Local Outbox Reconciled:          10/10 marked delivered
Execution Status:                 PASS (Exit Code 0)
========================================================================
```

---

# Important Engineering Decisions

## 1. Durable Local Outbox (SQLite)
SQLite provides ACID guarantees so messages survive app backgrounding, crashes, and restarts. The outbox pattern decouples message creation from network availability.

## 2. Stable Client-Generated Identifiers (UUID)
`clientMessageId` is generated client-side upon creation. It stays immutable through all retry attempts, providing the backend with a deterministic deduplication token.

## 3. Strict Sequential FIFO Synchronization
Pending messages are sorted by `ORDER BY createdAt ASC, id ASC`. Sequential transmission preserves causal ordering for conversations.

## 4. Head-of-Line Blocking vs. Bounded Retries
To prevent a single corrupted message from indefinitely blocking subsequent messages, auto-retries are bounded to `MAX_AUTO_RETRIES = 3`. Once exhausted, the message enters a terminal failed state, allowing recovery via user retry.

## 5. Crash Recovery Supervisor
On startup, `resetSendingMessagesLocal()` checks for any messages left in `sending` state due to process termination and restores them to `pending`.

## 6. Dynamic Queue Draining (Stretch Goal)
A dynamic `while (hasPending)` loop inside `SyncManager` inspects the database at the end of each batch. Any messages created by the user while sync was active are processed seamlessly in the same pipeline.

---

# Assumptions and Limitations

The current implementation focuses on the challenge requirements:

* **Authentication & Profiles**: Outside the scope of the challenge.
* **Attachments**: Images, audio, and video are not supported; text only.
* **Incoming Real-time**: Focus is on outgoing offline messages and their synchronization lifecycle.
* **Prototype Backend & Environment Routing**: Development builds use `localhost:5000` via `adb reverse tcp:5000 tcp:5000`. Release APK builds switch via `__DEV__` in `src/config.js` to `PROD_API_URL` (local Wi-Fi IP, HTTPS tunnel, or cloud server) for standalone device operation.
* **Background Sync**: Background synchronization while the application is completely terminated is not implemented.
* **Production Deployment**: Requires HTTPS, JWT authentication, and security monitoring.

---

# Production Improvements

The submitted implementation focuses on the core challenge requirements:
* Offline persistence
* Durable local outbox
* Connectivity-aware synchronization
* Failure handling
* Retry/recovery
* Ordering
* Idempotent message ingestion

For production, the following improvements are recommended:

### Security
* HTTPS
* Authentication & Authorization
* Secure credential handling
* Input validation & Rate limiting

### Synchronization
* Background synchronization via Android WorkManager
* Exponential backoff with jitter
* Stronger acknowledgement handling
* Conflict resolution for bidirectional synchronization

### Backend Scalability
* Database indexing & Pagination
* Connection pooling & Horizontal scaling
* Queue-based processing where appropriate
* Production database monitoring

### Observability
* Structured logging & Metrics
* Distributed tracing & Error tracking
* Synchronization monitoring & Alerting

### Testing & Delivery
* Integration & End-to-end tests
* Failure-injection tests
* Device-level testing & CI/CD automation

---

# AI Usage

AI tools were used during development for:
* Understanding challenge requirements
* Discussing architecture and implementation approaches
* Debugging development issues
* Reviewing implementation details
* Assisting with code and documentation

AI-generated suggestions were reviewed and adapted during implementation. Application behavior was manually tested during development.

---

# Demo

The demo should show the complete offline-to-online workflow:

1. Open SafeTrack.
2. Show the Factory Safety conversation.
3. Send a message while online.
4. Disable network connectivity (or toggle Simulate Offline ON).
5. Send a message while offline.
6. Show that the message appears immediately with pending state.
7. Force-close the application / reload Metro.
8. Reopen the application and show that the message is still available.
9. Restore network connectivity (or toggle Simulate Offline OFF).
10. Show synchronization and message becoming delivered.
11. Demonstrate a temporary synchronization failure (toggle 503 ON).
12. Show the failed state, toggle 503 OFF, and tap Retry to deliver.
13. Demonstrate duplicate prevention using `clientMessageId` (toggle Lost Ack ON, retry).

---

# Repository

**Candidate:** Maheshwari (`maheshwari3044@gmail.com`)  
**GitHub Repository:** [https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge](https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge)  
**Selected Problem:** Problem 2 — Offline-Capable Mobile Conversation  
**Project:** SafeTrack  
