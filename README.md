# Product Engineering Challenge Submission

## Candidate

* **Name:**
* **Email:**
* **GitHub:**
* **Selected problem:**
* **Demo video:**

---

## Run the project

### Prerequisites

* Node.js 18+
* React Native development environment
* Android Studio / Android SDK
* Android emulator or physical Android device
* MongoDB

### Backend

```text
Add backend setup and run commands here.
```

### Mobile

```text
Add mobile setup and run commands here.
```

### Environment Variables

```text
Add required environment-variable names here.

Do not commit secret values.
```

Explain how the reviewer can trigger the successful scenario and the required failure or recovery scenario.

---

## Run the tests

```text
Add test commands here.
```

---

## Acceptance scenarios and verification

### AC1 — Offline send

```text
Describe how to send a message while offline and verify the pending state.
```

### AC2 — Force-close durability

```text
Describe how to create a message offline, force-close the app,
reopen it, and verify that the message remains available.
```

### AC3 — Reconnection sync

```text
Describe how to restore connectivity and verify pending messages
are synchronized and marked as delivered.
```

### AC4 — Temporary failure and retry

```text
Describe how to simulate a temporary failure, verify the failed state,
automatic retry behaviour, and manual retry.
```

### AC5 — Uncertain acknowledgement and idempotency

```text
Describe how repeated requests using the same clientMessageId
are prevented from creating duplicate server-side messages.
```

### Verification benchmark

```text
Add the exact steps/commands used for the benchmark.

Include the observed result, counts, final states, and any mismatches.
```

Describe the failure or recovery scenario demonstrated in the video and how a reviewer can reproduce it.

---

## Architecture and data flow

```text
Add architecture diagram or explanation here.
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
