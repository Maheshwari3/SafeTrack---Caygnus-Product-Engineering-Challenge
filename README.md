# Product Engineering Challenge Submission

## Candidate

- **Name:** Maheshwari
- **Email:** maheshwari3044@gmail.com
- **GitHub:** https://github.com/Maheshwari3/SafeTrack---Caygnus-Product-Engineering-Challenge
- **Selected problem:** Problem 2 — Offline-Capable Mobile Conversation
- **Demo video:** Add your video link

---

## Run the project

### Prerequisites

* Node.js 18+
* React Native development environment
* Android Studio / Android SDK
* Android emulator or physical Android device
* MongoDB

### Backend

```
cd backend
npm install
npm run dev
```

### Mobile

```
npm install
npm start
npx react-native run-android
```

### Environment Variables

```
MONGODB_URI=<your-mongodb-connection-string>
PORT=5000
```

Explain how the reviewer can trigger the successful scenario and the required failure or recovery scenario.

---

## Run the tests

```
cd backend
npm test
```

---

## Acceptance scenarios and verification

### AC1 — Offline send

```
Disable network connectivity.
Open the Factory Safety conversation.
Send a safety message.
Verify that the message appears immediately in the conversation.
Verify that the message is stored in the local SQLite outbox.
Verify that its delivery state is shown as pending.

The message is not lost when there is no network connection because SQLite provides durable local storage.
```

### AC2 — Force-close durability

```
Disable network connectivity.
Send a message.
Verify that the message is pending.
Force-close the application.
Reopen the application.
Open the Factory Safety conversation.
Verify that the previously created message is still available.

The message remains available because it was persisted in SQLite rather than only being held in React component state.
```

### AC3 — Reconnection sync

```
Create one or more messages while offline.
Verify that the messages are pending.
Restore network connectivity.
NetInfo detects the connectivity change.
The Sync Manager retrieves pending messages from the local outbox.
Messages are sent to the backend.
Successfully synchronized messages are marked as delivered.
Verify the corresponding messages in the backend.

Queued messages are processed sequentially according to their local creation order.
```

### AC4 — Temporary failure and retry

```
Temporary failure and retry
Create a message while offline.
Restore connectivity while the backend is unavailable or simulate a synchronization failure.
Attempt synchronization.
Verify that the message enters the failed state.
Verify that the error information and retry count are retained.
Restore the backend/connectivity condition.
Manually retry the failed message.
Verify that synchronization succeeds.
Verify that the message becomes delivered.

The retry behavior is bounded according to the application's configured retry policy.
```

### AC5 — Uncertain acknowledgement and idempotency

```
Temporary failure and retry
Create a message while offline.
Restore connectivity while the backend is unavailable or simulate a synchronization failure.
Attempt synchronization.
Verify that the message enters the failed state.
Verify that the error information and retry count are retained.
Restore the backend/connectivity condition.
Manually retry the failed message.
Verify that synchronization succeeds.
Verify that the message becomes delivered.

The retry behavior is bounded according to the application's configured retry policy.
```

### Verification benchmark

```
The intended benchmark is:

Disable network connectivity.
Queue at least 10 messages.
Verify that all messages are stored locally.
Restart the application.
Verify that all queued messages remain available.
Restore connectivity.
Allow synchronization to complete.
Verify the resulting backend records.
Repeat a request using an existing clientMessageId.
Verify that no duplicate server-side message is created.
```

Describe the failure or recovery scenario demonstrated in the video and how a reviewer can reproduce it.

---

## Architecture and data flow

```
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

Describe the main components, their responsibilities, and how data moves between them.

---

## Technology choices

```text
Explain the selected technologies, alternatives considered,
and the trade-offs accepted.
```

---

## Important decisions

### 1. Durable local outbox

```text
Describe the decision and reasoning.
```

### 2. Stable client-generated identifiers

```text
Describe the decision and reasoning.
```

### 3. Synchronization and ordering

```text
Describe the decision, ordering policy, and trade-offs.
```

---

## Assumptions and limitations

```text
List assumptions, known limitations, and deliberately unfinished work.
```

---

## Production and scale

```text
Describe what would be changed for production or significantly
greater scale, and why.

Clearly distinguish the submitted implementation from proposed improvements.
```

---

## AI usage

```text
List any AI tools used, how they contributed,
and how their output was reviewed or tested.

If no AI tools were used, state that clearly.
```

---

## Credibility note

```text
Describe one product or system previously helped ship:

- The problem it solved
- Personal contribution
- Scale or operational complexity
- One difficult engineering or product decision
- Public link or other evidence, when available

Confidential details may be anonymized and figures may be approximate.
```
