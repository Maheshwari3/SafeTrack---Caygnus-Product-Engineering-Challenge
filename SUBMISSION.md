# Product Engineering Challenge Submission

## Candidate

- **Name:** Maheshwari
- **Email:** maheshwari3044@gmail.com
- **GitHub:** https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge
- **Selected problem:** Problem 2 — Offline-Capable Mobile Conversation
- **Demo video:** [Link to Demo Video](https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge)

---

## Run the project

### Prerequisites
* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher
* **Android Studio & Android SDK**: Configured with Android platform tools
* **Android device / Emulator**: Physical device connected via USB with USB debugging enabled, or an Android Virtual Device (AVD)
* **MongoDB**: Running locally on port `27017`

### 1. Start MongoDB & Backend Server
From the repository root:
```powershell
cd backend
npm install
```

Ensure `backend/.env` is configured:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/safetrack
NODE_ENV=development
```

Start the backend:
```powershell
npm run dev
```
The server listens at `http://localhost:5000`.

### 2. Configure Network & Launch Mobile Application

The mobile app supports both **Debug Development builds** and **Standalone Release APK builds** via automatic environment switching (`__DEV__`) in `src/config.js`.

#### Option A: Debug Development Build (via Metro & USB)
From the `Frontend/SafeTrack` directory:
```powershell
# Port forward so Android communicates directly over USB (bypassing firewall blocks):
adb reverse tcp:5000 tcp:5000

# Install dependencies:
npm install

# Start Metro Bundler:
npm start

# In a second terminal, build and install onto Android:
npx react-native run-android
```

#### Option B: Standalone Release APK Build
In a release APK, `__DEV__` is false, and the app connects to `PROD_API_URL` in `src/config.js` (e.g., local Wi-Fi IP `http://10.102.115.9:5000`, HTTPS tunnel via `npx localtunnel --port 5000`, or deployed cloud backend):
```powershell
cd android
./gradlew assembleRelease
```
The APK is generated at `android/app/build/outputs/apk/release/app-release.apk` for standalone installation on any Android device.

### Reviewer Testing & Failure Scenarios
The application includes an in-app **Reviewer Simulation Drawer** accessible by tapping the top-right sliders icon on the Conversation Screen:
- **Trigger Successful Scenario**: With switches set to Normal, type a safety message and tap Send. The message appears instantly with an amber `🕒 Pending` badge, transitions to `🚀 Sending`, and resolves to green `✓ Delivered` upon server confirmation.
- **Trigger Failure Scenario (AC4)**: In the Reviewer Simulation Drawer, toggle **"Simulate 503 Temp Error"** ON. Send a message. The server returns HTTP 503 Service Unavailable, and the message transitions to red `⚠️ Failed (Attempt 1/3)`. Bounded retries stop after 3 attempts.
- **Trigger Recovery**: Toggle the simulation switch OFF, and tap the **"Retry"** button on the failed message bubble. The message re-enters the outbox and delivers successfully (`✓ Delivered`).
- **Trigger Lost Acknowledgement / Idempotency (AC5)**: Toggle **"Simulate Lost Ack"** ON. Send a message. The server writes to MongoDB but drops the HTTP response. The app marks the message as `Failed`. Tap **"Retry"**: the exact same `clientMessageId` is transmitted. MongoDB intercepts duplicate key error `11000`, returns HTTP 200 with the existing record, and the UI transitions to `✓ Delivered` with **zero duplicate records** in MongoDB.

---

## Run the tests

### Mobile Automated Tests
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

### Backend Automated Tests
From `backend`:
```powershell
cd backend
npm test
```
**Observed Result:**
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

---

## Acceptance scenarios and verification

### Completed Scenarios
1. **AC1 — Offline Send**: Fully completed. Messages are immediately stored in SQLite (`messages` table) with UUID `clientMessageId` and state `pending`. The UI renders the message optimistically with an amber badge without blocking the user.
2. **AC2 — Force-Close Durability**: Fully completed. Process kills and Metro reloads restore all pending messages and delivery states from SQLite. In-flight messages (`sending`) are recovered to `pending` via `resetSendingMessagesLocal()` on startup.
3. **AC3 — Reconnection Sync**: Fully completed. NetInfo connectivity listener detects network restoration, and `SyncManager` drains the queue sequentially in deterministic local FIFO order (`ORDER BY createdAt ASC, id ASC`).
4. **AC4 — Temporary Failure and Retry**: Fully completed. 503 errors or timeouts transition messages to `failed` after `MAX_AUTO_RETRIES = 3`. User can tap the inline "Retry" button to re-queue.
5. **AC5 — Idempotency**: Fully completed. MongoDB enforces a unique index on `clientMessageId`. Repeated requests catch duplicate key code `11000` and return HTTP 200 with the existing document, resulting in zero duplicates.

### Problem-Specific Verification Benchmark
The challenge includes a repeatable automated script validating all 5 scenarios end-to-end:
```powershell
npm run benchmark
```

### Observed Result
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

## Key architectural decisions

### 1. State Machine & Local Outbox Pattern
Messages transition through explicit states: `pending` -> `sending` -> `delivered` or `failed`. SQLite is the durable source of truth; React state merely reflects database contents.

### 2. FIFO Ordering vs. Head-of-Line Blocking Trade-off
To preserve conversational coherence, messages are sent strictly in order (`createdAt ASC, id ASC`). To prevent a single permanent error from blocking the queue, retries are bounded to 3 attempts. When exhausted, the error is isolated to that message bubble, enabling manual recovery.

### 3. Idempotency via Client-Generated UUIDs
Client generates `clientMessageId` at creation. The server uses a unique index `{ clientMessageId: 1 }` and catches code `11000` to return `200 OK`, making every retry completely idempotent.

### 4. Crash Recovery Supervisor
On app mount, `resetSendingMessagesLocal()` inspects SQLite for any messages stranded in `sending` state due to process termination and restores them to `pending`.

### 5. Dynamic Queue Draining (Stretch Goal)
Messages added while synchronization is actively underway are dynamically picked up by a `while (hasPending)` loop and synchronized in proper sequence.

---

## Assumptions and Limitations

* Authentication and authorization are outside the scope of the challenge.
* User profiles are outside the current scope.
* Incoming real-time messages are outside the current implementation.
* Attachments such as images, audio, and video are not supported.
* The backend is intended as a challenge prototype running locally or via public tunnel/cloud host.
* Network endpoints use environment-aware routing (`__DEV__` in `src/config.js`): Debug builds use `localhost:5000` via `adb reverse`, while Release APKs use `PROD_API_URL` (configurable for local Wi-Fi IP, HTTPS tunnel, or deployed cloud backend).
* Background synchronization while the application is completely terminated is not implemented.
* Production deployment would require HTTPS.
* Production deployment would require additional security controls.
* Production monitoring and observability are not implemented as a full production system.
* The current implementation focuses on outgoing offline messages and their synchronization lifecycle.

---

## Production and scale

The submitted implementation focuses on the core challenge requirements:
* Offline persistence
* Durable local outbox
* Connectivity-aware synchronization
* Failure handling
* Retry/recovery
* Ordering
* Idempotent message ingestion

For production or significantly greater scale, I would consider the following improvements.

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

## AI usage

AI tools were used during development for:
* Understanding challenge requirements
* Discussing architecture and implementation approaches
* Debugging development issues
* Reviewing implementation details
* Assisting with code and documentation

AI-generated suggestions were reviewed and adapted during implementation. Application behavior was manually tested during development.

---

## Credibility note

### Previous project

**Project:** BiteBox — Customer, Vendor & Delivery Partner Applications

- **Problem solved:**  
  BiteBox is a grocery ordering and delivery platform that connects customers, grocery vendors, and delivery partners. The platform supports the complete grocery order lifecycle, from customers placing orders, to vendors processing orders, to delivery partners handling and completing deliveries.

- **Personal contribution:**  
  I worked on the mobile application development across the Customer, Vendor, and Delivery Partner applications. My work included developing and maintaining React Native screens, integrating backend APIs, handling application state, implementing order-related workflows, managing API responses and errors, and debugging issues across the applications.

- **Scale / operational complexity:**  
  The platform involved three different user roles with different workflows:
  - **Customer:** Browse grocery products, manage the cart, place orders, and track order status.
  - **Vendor:** Manage grocery products, receive and process customer orders, and update order status.
  - **Delivery Partner:** View assigned deliveries, manage delivery status, and complete the delivery workflow.
  
  The main engineering complexity involved coordinating the different user applications with backend APIs and keeping order information consistent across the Customer, Vendor, and Delivery Partner workflows.

- **Difficult engineering/product decision:**  
  One important engineering challenge was handling different order states across the Customer, Vendor, and Delivery Partner applications. I worked with asynchronous API responses and application state so that each user role could see the appropriate information and perform the correct actions based on the current order status. I also handled loading and error states for API operations.

- **Public link/evidence:**  
  The BiteBox project is not publicly available on GitHub, so the source code cannot be provided as public evidence. The project experience can be discussed during the technical discussion if required.

---

## Demo

The final demo should demonstrate the complete offline-to-online lifecycle:

1. Open the SafeTrack Factory Safety conversation.
2. Send a message while online.
3. Disable network connectivity.
4. Send a message while offline.
5. Show that the message appears immediately.
6. Show the pending delivery state.
7. Force-close the application.
8. Reopen the application.
9. Show that the message remains available.
10. Restore network connectivity.
11. Show synchronization.
12. Show the message becoming delivered.
13. Demonstrate a temporary synchronization failure.
14. Show the failed state.
15. Retry the message.
16. Show successful synchronization.
17. Demonstrate duplicate prevention using the same `clientMessageId`.
