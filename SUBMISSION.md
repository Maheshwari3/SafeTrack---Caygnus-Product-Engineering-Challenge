# Product Engineering Challenge Submission

## Candidate

- **Name:** Maheshwari
- **Email:** maheshwari3044@gmail.com
- **GitHub:** https://github.com/Maheshwari3
- **Selected problem:** Problem 2: Offline-Capable Mobile Conversation
- **Demo video:** [Link to Demo Video] *(Upload your recorded video walkthrough here)*

---

## Run the project

### Prerequisites
1. **Node.js**: `v18.x` or higher
2. **MongoDB**: Running locally at `mongodb://localhost:27017` (e.g. via MongoDB Community Server or Docker)
3. **Android SDK & ADB**: Android Studio with an Android device connected via USB or an Android Emulator
4. **npm**: `v9.x` or higher

### Environment Variables
In `Backend/.env`:
```text
PORT=5000
MONGODB_URI=mongodb://localhost:27017/safetrack
NODE_ENV=development
```

---

### Step 1: Start the Backend Service
From the repository root:
```bash
cd Backend
npm install
npm run dev
```
*The server will start at `http://localhost:5000` and connect to MongoDB.*

---

### Step 2: Configure Port Forwarding for Android (USB or Emulator)
To ensure reliable communication immune to local Wi-Fi router subnet changes or Windows Firewall blocks, forward port 5000 over ADB:
```bash
adb reverse tcp:5000 tcp:5000
```

---

### Step 3: Start Metro & Run the Mobile App
From the repository root:
```bash
cd Frontend/SafeTrack
npm install

# Start Metro Bundler
npm start

# In a separate terminal window, launch the Android application:
npx react-native run-android
```

---

### How Reviewers Can Trigger Scenarios in the App

1. **Triggering the Successful Online Scenario**:
   - Tap **"Factory Safety Assistant"** / **"Conversation"** from the SafeTrack dashboard.
   - Enter a message (e.g., *"Valve #4 inspected - nominal pressure"*).
   - Tap **Send**. The message immediately displays `🕒 Pending`, transitions to `🔄 Sending...`, and upon HTTP 201 receipt, becomes **`✓ Delivered`** (green badge).
   - Verify that the message appears immediately in MongoDB collection `safetrack.messages`.

2. **Triggering the Offline Scenario (AC1 & AC2)**:
   - Tap the **Sliders Icon** (top right) to open the **Reviewer Simulation Panel**.
   - Toggle **"Simulate Offline"** to **ON**.
   - Send one or more messages.
   - **Observation**: Messages are persisted locally in SQLite and displayed with an honest **`🕒 Pending`** amber badge.
   - Force close or reload the app (`R` twice in Metro).
   - **Observation**: All pending messages and states are durably restored from SQLite.

3. **Triggering the Temporary Failure & Recovery Scenario (AC4)**:
   - In the Reviewer Simulation Panel, toggle **"Simulate 503 Temp Error"** to **ON**.
   - Toggle **"Simulate Offline"** to **OFF**.
   - The queue worker attempts to send the pending message; the server returns HTTP 503 Service Unavailable.
   - **Observation**: The message displays **`⚠️ Failed (1/3)`** with the error text.
   - Toggle **"Simulate 503 Temp Error"** to **OFF** and tap the **"Retry"** button on the bubble (or **"Sync All"**).
   - **Observation**: The message is successfully delivered (**`✓ Delivered`**).

4. **Triggering the Uncertain Acknowledgement Scenario (AC5)**:
   - In the Reviewer Simulation Panel, toggle **"Simulate Lost Ack"** to **ON**.
   - Send a message.
   - **What happens**: The backend receives the message and durably saves it in MongoDB, but the response packet is abruptly dropped/errored before reaching the client.
   - **Observation**: The client displays **`⚠️ Failed`**.
   - Toggle **"Simulate Lost Ack"** to **OFF** and tap **"Retry"**.
   - **Observation**: The client retries using the exact same `clientMessageId`. The backend detects the unique constraint, handles duplicate key error `11000`, and responds with **HTTP 200 OK** returning the existing record. The client reconciles to **`✓ Delivered`** without creating a duplicate record.

---

## Run the tests

Execute the complete automated test suites:

### 1. Frontend Test Suite (SafeTrack)
```bash
cd Frontend/SafeTrack
npx jest --no-cache --runInBand --forceExit
```

### 2. Backend Test Suite
```bash
cd Backend
npm test
```

### 3. Verification Benchmark Command
```bash
cd Frontend/SafeTrack
npm run benchmark
```

---

## Acceptance scenarios and verification

### Completed Acceptance Scenarios

- [x] **AC1: Offline send**: Outgoing messages written while offline are saved locally to SQLite with `clientMessageId`, `conversationId`, `content`, `createdAt`, `deliveryState = 'pending'`, and `retryCount = 0`.
- [x] **AC2: Force-close durability**: App termination and crash recovery verified. Messages in `sending` state when crashed are safely reset to `pending` upon restart via `resetSendingMessagesLocal()`, guaranteeing messages are never stranded.
- [x] **AC3: Reconnection synchronization**: Automatic synchronization is triggered by NetInfo state transitions (`offline -> online`), processing pending messages sequentially in strict FIFO order (`createdAt ASC, id ASC`).
- [x] **AC4: Temporary failure and retry**: HTTP 5xx and network drop errors increment `retryCount` and mark messages `failed`. Automatic retries are strictly bounded to `MAX_AUTO_RETRIES = 3`. Once exhausted, messages transition to a terminal failed state that requires manual retry.
- [x] **AC5: Uncertain acknowledgement**: Client-generated UUIDs enforce idempotency at the database layer. When a server write succeeds but the acknowledgement is dropped, the subsequent retry returns HTTP 200 with the existing record, avoiding duplicate server writes and reconciling the client outbox to `delivered`.
- [x] **Stretch Goal Completed**: The synchronization queue worker features a while-loop draining mechanism that seamlessly picks up and delivers new messages queued while synchronization is actively in progress.

---

### Verification Benchmark

Run the automated verification benchmark with:
```bash
cd Frontend/SafeTrack
npm run benchmark
```

#### Observed Result (Actual Run Output)
```text
========================================================================
  SAFE TRACK - PROBLEM 2 VERIFICATION BENCHMARK
  Offline-Capable Mobile Conversation Synchronization
========================================================================
  ℹ Live backend detected at http://localhost:5000. Running benchmark against live server.

[STEP 1] Queue 10 Messages Offline in Durable Outbox
======================================================================
  [+] Queued: bench_msg_001 | Created: 16:39:31 | State: pending
  [+] Queued: bench_msg_002 | Created: 16:39:32 | State: pending
  [+] Queued: bench_msg_003 | Created: 16:39:33 | State: pending
  [+] Queued: bench_msg_004 | Created: 16:39:34 | State: pending
  [+] Queued: bench_msg_005 | Created: 16:39:35 | State: pending
  [+] Queued: bench_msg_006 | Created: 16:39:36 | State: pending
  [+] Queued: bench_msg_007 | Created: 16:39:37 | State: pending
  [+] Queued: bench_msg_008 | Created: 16:39:38 | State: pending
  [+] Queued: bench_msg_009 | Created: 16:39:39 | State: pending
  [+] Queued: bench_msg_010 | Created: 16:39:40 | State: pending
  ✓ Successfully queued 10 messages in durable local outbox with state 'pending'.

[STEP 2] Simulate Application Crash & Lifecycle Restart
======================================================================
  ℹ Simulating process kill while message 'bench_msg_001' was in-flight (state: 'sending')...
  ℹ Application starting up... running outbox crash recovery routine (resetSendingMessagesLocal)...
  ✓ Crash recovery complete: 1 in-flight message restored to 'pending'.
  ✓ All 10 messages restored durably from local storage across application restart.

[STEP 3] Simulate Temporary Failure (503) & Lost Acknowledgement
======================================================================
  ℹ Network connectivity returned. Starting sequential FIFO synchronization...
  ✓ Delivered: bench_msg_001 (Status: 201)
  ✓ Delivered: bench_msg_002 (Status: 201)
  ⚠ Temporary Failure (503): bench_msg_003 marked 'failed' (Attempt 1)
  ✓ Delivered: bench_msg_004 (Status: 201)
  ✓ Delivered: bench_msg_005 (Status: 201)
  ✓ Delivered: bench_msg_006 (Status: 201)
  ⚠ Lost Acknowledgement: bench_msg_007 saved on server, but client ack dropped!
  ✓ Delivered: bench_msg_008 (Status: 201)
  ✓ Delivered: bench_msg_009 (Status: 201)
  ✓ Delivered: bench_msg_010 (Status: 201)

[STEP 4] Reconnection & Idempotent Recovery Pass
======================================================================
  ℹ Retrying remaining failed/pending messages...
  ℹ Found 2 message(s) requiring retry: bench_msg_003, bench_msg_007
  ✓ Recovered: bench_msg_003 newly saved (201 Created)
  ✓ Idempotent Recovery: bench_msg_007 reconciled existing server record (200 OK - No duplicate!)

[STEP 5] Backend Verification: Exact Order & Idempotency
======================================================================
  Backend Message Count: 10 (Expected: 10)

  Backend Message Ordering Check:
  --------------------------------------------------------------------
  Pos | Client Message ID | Created Timestamp    | Content
  ----+-------------------+----------------------+--------------------
   1  | bench_msg_001     | 16:39:31             | Safety Observation #1: P... ✓
   2  | bench_msg_002     | 16:39:32             | Safety Observation #2: P... ✓
   3  | bench_msg_003     | 16:39:33             | Safety Observation #3: P... ✓
   4  | bench_msg_004     | 16:39:34             | Safety Observation #4: P... ✓
   5  | bench_msg_005     | 16:39:35             | Safety Observation #5: P... ✓
   6  | bench_msg_006     | 16:39:36             | Safety Observation #6: P... ✓
   7  | bench_msg_007     | 16:39:37             | Safety Observation #7: P... ✓
   8  | bench_msg_008     | 16:39:38             | Safety Observation #8: P... ✓
   9  | bench_msg_009     | 16:39:39             | Safety Observation #9: P... ✓
  10  | bench_msg_010     | 16:39:40             | Safety Observation #10: ... ✓
  ✓ Every logical message exists exactly ONCE on the backend in documented FIFO order.
  ✓ Local outbox fully reconciled: 10/10 messages marked as delivered.

========================================================================
  BENCHMARK COMPLETED SUCCESSFULLY (ALL ACCEPTANCE SCENARIOS PASSED)
========================================================================
  Total Messages Queued:         10
  Crash Recovery Validated:      Yes (in-flight 'sending' restored)
  Simulated Temporary Error (503): 1 recovered
  Simulated Lost Ack (AC5):       1 recovered idempotently (0 duplicates)
  Backend Verification:          10/10 present in exact FIFO order
  Execution Status:              PASS (Code 0)
```

---

## Architecture and data flow

The architecture decouples UI state, durable persistence, synchronization coordination, and server-side idempotency:

```
+-------------------------------------------------------------------+
|                     ConversationScreen.js                         |
|  - Renders chat list from SQLite queries                          |
|  - Delivery state badges: Pending, Sending, Failed, Delivered     |
|  - Reviewer Simulation Drawer (Offline, 503 error, Lost Ack)      |
+---------------------------------+---------------------------------+
                                  |
            1. User sends message | 2. Immediate local save
                                  v
+-------------------------------------------------------------------+
|               messageRepository.js / database.js                  |
|  - Durable SQLite outbox (table: messages)                        |
|  - State persistence across lifecycle restarts                    |
|  - Crash recovery handler: resetSendingMessagesLocal()            |
+---------------------------------+---------------------------------+
                                  |
            3. Queries pending    | 4. Updates state (sending -> del)
                                  v
+-------------------------------------------------------------------+
|                        SyncManager.js                             |
|  - NetInfo network connectivity listener                          |
|  - Mutex concurrency guard (isSyncing)                            |
|  - Sequential FIFO queue processor (createdAt ASC, id ASC)        |
|  - Bounded automatic retries (MAX_AUTO_RETRIES = 3)               |
+---------------------------------+---------------------------------+
                                  |
            5. HTTP POST /api/messages (clientMessageId)
                                  v
+-------------------------------------------------------------------+
|                    Backend (Express + MongoDB)                    |
|  - Unique index on clientMessageId                                |
|  - New message: HTTP 201 Created                                  |
|  - Duplicate key (code 11000): HTTP 200 OK (idempotent recovery)  |
+-------------------------------------------------------------------+
```

### Finite State Machine
- `pending` -> `sending` (claimed by SyncManager when online)
- `sending` -> `delivered` (HTTP 201 or idempotent HTTP 200 received)
- `sending` -> `failed` (network error or HTTP 5xx; retryCount incremented)
- `sending` -> `pending` (app crash recovery on startup)
- `failed` -> `sending` (auto-retry on reconnect if retryCount < 3)
- `failed` -> `pending` (manual retry button resets retryCount = 0)

---

## Technology choices

1. **Frontend: React Native (0.80.0) + React 19**:
   - *Why*: Enables rapid cross-platform native execution with direct access to SQLite native storage, background network listeners (`NetInfo`), and hardware lifecycle events.
   - *Alternatives Considered*: Flutter, pure native Kotlin/Swift. React Native was chosen to maintain shared JavaScript idioms across mobile client and Node backend.

2. **Durable Local Storage: SQLite (`react-native-sqlite-storage`)**:
   - *Why*: SQLite provides true ACID transactions, relational querying (`ORDER BY createdAt ASC, id ASC`), and durability across app termination and device restarts.
   - *Alternatives Considered*: `AsyncStorage` (unsuitable: key-value only, prone to serialization bottlenecks and lacks atomic transactional ordering) and `MMKV` (fast, but lacks complex SQL queue querying).

3. **Backend: Node.js / Express + MongoDB / Mongoose**:
   - *Why*: Minimal, transparent backend suitable for deterministic inspection. MongoDB unique indexes allow natural enforcement of idempotency via code `11000` duplicate key detection.

---

## Important decisions

1. **Durable Outbox Ownership in SQLite (Not React State)**:
   - *Decision*: The screen state does not own the outbox. Messages are written to SQLite *before* any network attempt is initiated.
   - *Rationale*: If the app crashes 5ms after user taps Send, the message is durably preserved in SQLite and recovered on next startup.

2. **Strict FIFO Ordering with Head-of-Line Blocking Trade-off**:
   - *Decision*: Messages are transmitted strictly in `createdAt ASC, id ASC` order, one at a time.
   - *Trade-off*: Preserves causality in safety-critical communications (e.g. "Shutdown" never arrives after "Start"). The accepted trade-off is temporary Head-of-Line blocking if message #1 fails, mitigated by bounding automatic retries to 3 attempts before pausing.

3. **Client-Generated UUIDs for Idempotent Deduplication**:
   - *Decision*: Every message generates a UUID `clientMessageId` at creation.
   - *Rationale*: Solves the classic two-generals / uncertain acknowledgement problem: when the client's network drops after the server commits the write, the client retries with the same ID. The backend recognizes the key, avoids duplicates, and returns HTTP 200.

---

## Assumptions and limitations

1. **Scope Boundaries**:
   - Authentication, multimedia attachments, voice messages, and push notifications were excluded per the prompt's out-of-scope boundaries.
2. **Foreground & Active Background Execution**:
   - Synchronization is coordinated while the app process is active in foreground or background. OS-level termination background workers (Android WorkManager / iOS BGAppRefreshTask) were omitted to adhere to the 6-8 hour prototype complexity limit.
3. **Single Active Conversation**:
   - The queue operates on a per-conversation FIFO basis (`factory-safety-room-1`).

---

## Production and scale

If advancing to production at significant scale, the following improvements would be prioritized:

1. **OS Background Synchronization**:
   - Integrate Android `WorkManager` and iOS `BGAppRefreshTask` to schedule background sync jobs constrained to network connectivity even when the user force-quits the app.
2. **Partitioned FIFO Queues**:
   - Partition message outboxes by `conversationId` so that a failing message in Room A never delays messages in Room B.
3. **Exponential Backoff with Jitter**:
   - Replace constant retries with exponential backoff and randomized jitter (`delay = base * 2^attempt + random_jitter`) to protect backend infrastructure from thundering-herd reconnects.
4. **Outbox Compaction**:
   - Implement scheduled pruning of messages marked `delivered` older than 30 days to bound local database size.

---

## AI usage

- **AI Tools Used**: Google Antigravity IDE (Advanced Agentic Pair Programming Assistant).
- **Contribution**:
  - Investigated React Native 0.80.0 Jest mock resolution issue.
  - Implemented the 5 required unit test suites covering the exact acceptance criteria.
  - Authored the repeatable `scripts/verificationBenchmark.js` verification benchmark script.
  - Constructed the Reviewer Simulation Panel and endpoint fallback logic.
- **Review and Validation**:
  - All generated code was thoroughly reviewed, verified with automated Jest runs (both Frontend and Backend), and validated end-to-end against live MongoDB via ADB USB reverse tunnel and terminal queries.

---

## Credibility note

- **Product / System Previously Shipped**: High-volume distributed event ingestion and offline field-reporting engine for mobile operations.
- **Problem Solved**: Field technicians operating in remote industrial environments with intermittent satellite/cellular connectivity frequently suffered lost inspection records and out-of-order equipment telemetry.
- **Personal Contribution**: Designed and implemented the client-side SQLite durable outbox, deterministic FIFO queue synchronization engine, and server-side idempotent ingestion APIs handling ~1.2M daily status events.
- **Scale / Complexity**: 15,000 active field devices; zero-data-loss requirement under battery drops and network timeouts.
- **Difficult Engineering Decision**: Choosing strict causal ordering versus optimistic parallel uploads. Selected per-asset partitioned FIFO queues, allowing independent pieces of machinery to upload in parallel while ensuring telemetry for any individual asset remained strictly chronological.
