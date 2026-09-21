# Product Engineering Challenge Submission

## Candidate

- **Name:** Maheshwari
- **Email:** maheshwari3044@gmail.com
- **GitHub:** https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge
- **Selected problem:** Problem 2 — Offline-Capable Mobile Conversation
- **Demo video:** Add your final demo video link

---

## Run the project

### Prerequisites

- Node.js 18+
- React Native development environment
- Android Studio / Android SDK
- Android emulator or physical Android device
- MongoDB

### Backend

From the repository root:

```powershell
cd backend
npm install
npm run dev
````

The backend runs on port `5000`.

### Mobile

From the repository root:

```powershell
npm install
npm start
```

In another terminal:

```powershell
npx react-native run-android
```

For a physical Android device, configure the mobile API URL to use the development machine's local network IP address instead of `localhost`.

### Environment Variables

Create a `.env` file inside the `backend` directory:

```env
MONGODB_URI=<your-mongodb-connection-string>
PORT=5000
```

Do not commit `.env` or any secret values.

### Successful scenario

1. Start MongoDB.
2. Start the Node.js backend.
3. Start the React Native application.
4. Open the Factory Safety conversation.
5. Send a message while online.
6. Disable network connectivity.
7. Send another message while offline.
8. Verify that the message appears immediately.
9. Verify that the message is stored locally as pending.
10. Restore network connectivity.
11. Verify that the Sync Manager synchronizes the pending message.
12. Verify that the message becomes delivered.

### Failure and recovery scenario

1. Disable network connectivity.
2. Send a message.
3. Verify that the message is stored locally.
4. Trigger a temporary synchronization/backend failure.
5. Verify that the message enters the failed state.
6. Restore the required network/backend condition.
7. Retry the failed message.
8. Verify that synchronization succeeds and the message becomes delivered.

---

## Run the tests

### Mobile

From the repository root:

```powershell
npm test -- --runInBand
```

### Backend

```powershell
cd backend
npm test
```

Record the actual test results before submission.

Example:

```text
Mobile tests: <actual result>
Backend tests: <actual result>
```

---

## Acceptance scenarios and verification

### AC1 — Offline send

1. Disable network connectivity.
2. Open the Factory Safety conversation.
3. Send a safety message.
4. Verify that the message appears immediately.
5. Verify that the message is persisted in SQLite.
6. Verify that its delivery state is `pending`.

The message is stored locally before synchronization, so the user can continue working while offline.

### AC2 — Force-close durability

1. Disable network connectivity.
2. Send a message.
3. Verify that the message is pending.
4. Force-close the application.
5. Reopen the application.
6. Open the Factory Safety conversation.
7. Verify that the previously created message is still available.

The message remains available because it is persisted in SQLite rather than only being held in application memory.

### AC3 — Reconnection sync

1. Create one or more messages while offline.
2. Verify that the messages are pending.
3. Restore network connectivity.
4. NetInfo detects the connectivity change.
5. The Sync Manager retrieves pending messages from SQLite.
6. Messages are sent to the backend.
7. The backend persists the messages in MongoDB.
8. Successfully synchronized messages are marked as delivered.

Queued messages are processed sequentially according to their local creation order.

### AC4 — Temporary failure and retry

1. Create a message while offline.
2. Restore connectivity while the backend is unavailable, or otherwise simulate a synchronization failure.
3. Attempt synchronization.
4. Verify that the message enters the failed state.
5. Verify that the message remains locally available.
6. Restore backend/network availability.
7. Manually retry the failed message.
8. Verify that synchronization succeeds.
9. Verify that the message becomes delivered.

Only claim automatic retry behavior if it is actually implemented in the submitted code.

### AC5 — Uncertain acknowledgement and idempotency

Each outgoing message receives a stable client-generated `clientMessageId` before synchronization.

The same `clientMessageId` is reused when a message is retried.

If the backend receives the same logical message again with the same `clientMessageId`, it identifies the existing message instead of creating another server-side record.

This prevents duplicate messages when a request is retried after an uncertain network acknowledgement.

---

## Verification benchmark

The benchmark should verify durability, synchronization, recovery, ordering, and idempotency.

### Steps

1. Disable network connectivity.
2. Queue at least 10 messages.
3. Verify that all messages are stored locally.
4. Restart the application before synchronization.
5. Verify that all queued messages remain available.
6. Restore network connectivity.
7. Allow synchronization to complete.
8. Verify the resulting backend records.
9. Repeat a request using an existing `clientMessageId`.
10. Verify that no duplicate server-side message is created.

### Observed results

Complete this section after actually running the benchmark:

```text
Messages queued:
Messages remaining after restart:
Messages synchronized:
Messages failed:
Duplicate requests tested:
Duplicate records created:
Final result:
```

Do not add results that have not been observed.

### Failure/recovery scenario demonstrated in the video

The demo demonstrates:

1. Creating a message while offline.
2. Persisting the message locally.
3. Showing the pending state.
4. Triggering a temporary synchronization failure.
5. Showing the failed state.
6. Restoring the required network/backend condition.
7. Retrying the message.
8. Successfully synchronizing the message.

A reviewer can reproduce the scenario using the steps described in AC4.

---

## Architecture and data flow

```text
React Native
    ↓
Conversation Screen
    ↓
Message Repository
    ↓
SQLite Local Outbox
    ↓
SyncManager
    ↓
Node.js / Express API
    ↓
MongoDB
```

### Conversation Screen

Responsible for:

* Displaying the factory safety conversation
* Creating messages
* Displaying messages immediately
* Showing delivery state
* Providing retry actions for failed messages

### Message Repository

Provides the interface between the application and SQLite.

It manages:

* Creating local messages
* Reading messages
* Finding pending messages
* Updating delivery state
* Updating retry information

### SQLite Local Outbox

SQLite provides durable local persistence for outgoing messages.

Messages are stored locally before synchronization so they survive network loss and application restart.

### SyncManager

The Sync Manager coordinates synchronization between the local outbox and backend.

It handles:

* Connectivity changes
* Pending message retrieval
* Synchronization
* Delivery-state updates
* Failure handling
* Retry handling
* Queue ordering

### Node.js / Express API

The backend receives messages from the mobile application and persists them in MongoDB.

It also handles idempotent message ingestion using `clientMessageId`.

### MongoDB

MongoDB stores synchronized server-side messages.

The client-generated `clientMessageId` is used to prevent duplicate records.

### Message data flow

```text
User creates message
        ↓
Generate clientMessageId
        ↓
Save to SQLite
        ↓
PENDING
        ↓
SyncManager
        ↓
POST /api/messages
        ↓
Node.js / Express
        ↓
MongoDB
        ↓
Successful response
        ↓
DELIVERED
```

On failure:

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

## Technology choices

### React Native

Used for the mobile application and Android implementation required by the challenge.

### SQLite

Used for durable local storage.

The application needs messages to survive application termination, so an in-memory state store alone would not be sufficient.

### NetInfo

Used to monitor network connectivity and trigger synchronization when connectivity returns.

### UUID

Used to generate stable client-side message identifiers before a message is sent to the backend.

### Node.js + Express

Used for a lightweight REST backend suitable for the challenge.

### MongoDB + Mongoose

Used for server-side persistence and data modeling.

MongoDB also supports the uniqueness requirement used for idempotent message ingestion.

### Trade-offs

The implementation favors a simple and understandable architecture over a more distributed system.

Sequential synchronization is easier to reason about and provides deterministic queue processing, although parallel synchronization could provide higher throughput for a much larger queue.

---

## Important decisions

### 1. Durable local outbox

SQLite is used as the durable local outbox for outgoing messages.

The message is persisted locally before synchronization.

This prevents message loss when:

* The device is offline
* The network changes
* The backend is temporarily unavailable
* The application is restarted

### 2. Stable client-generated identifiers

The client generates `clientMessageId` before synchronization.

The identifier remains unchanged during retries.

This allows the backend to recognize repeated requests representing the same logical message.

It also prevents duplicate server-side messages when a synchronization request is retried.

### 3. Synchronization and ordering

Pending messages are retrieved according to their local creation order.

The ordering policy is:

```sql
ORDER BY createdAt ASC, id ASC
```

The Sync Manager processes queued messages sequentially.

This provides deterministic ordering for messages created while offline.

The trade-off is that sequential processing can be slower than parallel processing for a very large queue. For this challenge, predictable ordering and simpler failure handling were prioritized.

---

## Assumptions and limitations

* Authentication and authorization are outside the scope of the challenge.
* User profiles are outside the current scope.
* Incoming real-time messages are outside the current implementation.
* Attachments such as images, audio, and video are not supported.
* The backend is intended as a challenge prototype rather than a production deployment.
* The current development configuration uses a local backend address.
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
* Authentication
* Authorization
* Secure credential handling
* Input validation
* Rate limiting

### Synchronization

* Background synchronization
* Exponential backoff with jitter
* Stronger acknowledgement handling
* More robust handling of prolonged offline periods
* Conflict resolution if bidirectional synchronization is introduced

### Backend scalability

* Database indexing
* Pagination
* Connection pooling
* Horizontal backend scaling
* Queue-based processing where appropriate
* Production database monitoring

### Observability

* Structured logging
* Metrics
* Distributed tracing
* Error tracking
* Synchronization monitoring
* Alerting

### Testing and delivery

* Integration tests
* End-to-end tests
* Failure-injection tests
* Device-level testing
* CI/CD automation

These are proposed production improvements and are not presented as functionality already implemented in the submitted challenge version.

---

## AI usage

AI tools were used during development for:

* Understanding the challenge requirements
* Discussing architecture and implementation approaches
* Debugging development issues
* Reviewing implementation details
* Assisting with code and documentation

AI-generated suggestions were reviewed and adapted during implementation.

Application behavior was manually tested during development.

---

## Credibility note

### Previous project

**Project:** FoodApp Vendor

- **Problem solved:**  
  A mobile application for food vendors to manage customer orders and related vendor operations.

- **Personal contribution:**  
  I worked on the React Native application, including UI development, API integration, order-related functionality, and debugging application issues.

- **Scale / operational complexity:**  
  The application involved communication between the mobile application and backend APIs for vendor and order-related operations. I worked with asynchronous API responses and different application states such as loading, success, and error states.

- **Difficult engineering/product decision:**  
  One of the challenges was keeping the mobile application's UI state consistent with asynchronous backend API responses. I handled API communication and UI state updates separately so that loading, success, and error states could be managed more reliably.

- **Public link/evidence:**  
  The project is not publicly available on GitHub, so source code cannot be provided as public evidence.

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
