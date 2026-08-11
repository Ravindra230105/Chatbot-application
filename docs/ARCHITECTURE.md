# Architecture Notes

## 1. Ingestion flow

Step by step for one chat message:

1. **Client sends the message.** `POST /api/conversations/:uuid/messages`. The
   controller creates an `AbortController` and listens for the response closing, so
   a disconnect can stop the provider call.

2. **Chat service prepares the turn.** It loads the conversation, rejects it if the
   status is not `active`, resolves the provider and model, saves the user message,
   and loads the last 10 messages as context.

3. **Assistant placeholder is saved.** A `requestId` is generated and an assistant
   message is inserted with status `streaming` and empty content. This row is what
   links the chat data to the log later.

4. **Streaming starts.** The provider returns an async generator. The service loops
   over it, appends each chunk to the answer, and writes it to the client as an SSE
   `delta` event. `tracker.markFirstToken()` is called on the first chunk to record
   time to first token.

5. **Stream finishes.** The assistant message is updated with the full answer and
   status `complete`. Then `tracker.finish()` is called.

6. **The SDK builds the log.** Tokens come from the provider if it reported usage,
   otherwise they are estimated. Cost is calculated from the price table. Input and
   output previews are truncated to 500 characters and redacted. The request path
   ends here, because the POST to the ingestion API is not awaited.

7. **Ingestion API receives it.** `POST /api/logs` checks `x-api-key`, then Joi
   validates the body. An invalid payload is rejected with 422 and never reaches the
   queue.

8. **Job is queued.** The payload is added to the BullMQ queue with
   `jobId = requestId`, which means a duplicate delivery becomes the same job
   instead of a second one. The API responds 202 straight away.

9. **Worker stores it.** `worker.js` picks up the job, adds derived fields
   (`totalTokens`, `tokensPerSecond`), redacts previews a second time, checks
   whether that `requestId` already exists, inserts the row, then updates
   `messages.tokenCount` and increments `conversations.totalTokens`.

10. **Dashboard reads it.** The metrics module queries `inference_logs` and returns
    the summary, per minute points, per model breakdown and recent rows.

## 2. Logging strategy

**The SDK wraps the call instead of the developer logging by hand.** The chat
service says "this started", "the first token arrived", "this is how it ended". All
the measurement, token accounting, redaction and delivery is inside
`startInference()`. Nothing about timing or payload shape is duplicated at the call
site, so a second feature that calls an LLM only has to use the same tracker.

**Logging never blocks the response.** `tracker.finish()` fires the HTTP POST
without awaiting it and catches its own errors. If the ingestion API is down the
user still gets their reply, and a warning is logged.

**All three outcomes are recorded.** Success, error and cancelled are separate
statuses. Cancelled deliberately does not count towards the error rate, but the
partial output and real token usage are kept.

**Estimates are labelled.** When a provider does not return usage,
`metadata.tokenSource` is set to `estimated`. A number nobody can trace is a number
nobody will act on.

**Validation happens at the ingestion boundary, not in the SDK.** The SDK sends what
it measured; the API decides what is acceptable. That keeps the rules in one place
even if more services start sending logs.

**Queue between the API and the database.** The ingestion endpoint only validates
and enqueues, so it stays fast and does not depend on the database being available
at that moment.

## 3. Scaling considerations

**What is stateless.** The Express server and the worker hold no state, so both can
run multiple replicas. The worker count is the main throughput lever, since BullMQ
distributes jobs across all connected workers automatically.

**Where it would break first.** The metrics queries. `getSummary` loads the
`latencyMs` column for the whole window to calculate p95, so a busy hour means a
large result set in memory. The fix is a per minute summary table written by the
worker, so the dashboard reads pre-aggregated rows instead of raw logs. That is the
first thing I would change if traffic grew.

**The logs table grows fastest.** One row per LLM call, and it is only ever queried
by time window. It should be partitioned by day with old partitions dropped on a
retention policy, so deleting old data does not mean a huge `DELETE`.

**Redis is a single point.** BullMQ needs it. Losing Redis means logs are dropped
(the SDK's POST fails and it moves on), but chat keeps working. Redis with
persistence and a replica would be the next step.

**Streaming changes how you size the API.** Each active reply holds an open SSE
connection, so the limit is concurrent streams rather than requests per second.
Response buffering has to be off in nginx and in the ingress, otherwise the proxy
holds the chunks and the streaming effect is lost.

**Sending one log per call** is fine at this volume but is one HTTP request per LLM
call. Batching every 20 events or every second would cut that significantly.

## 4. Failure handling

The assumption behind all of this: **losing a log is acceptable, losing a chat
message is not.** Chat data is written synchronously; logs travel the async path.

| What fails | What happens |
|---|---|
| Ingestion API is down | The SDK's POST fails, it logs a warning and moves on. The chat reply is unaffected. That log is lost. |
| Payload is invalid | Joi rejects it with 422 before it is queued, so bad data never reaches the queue or the table. |
| Redis is down | Chat is unaffected and still streams normally. The log delivery call times out after `INGESTION_TIMEOUT_MS` and the SDK logs a warning, so that log is lost but nothing blocks. The dashboard still loads: the queue counts read is bounded by a 3s timeout and degrades to `queue: null` rather than hanging. |
| Worker crashes mid job | The job was never acknowledged, so BullMQ retries it (3 attempts, exponential backoff). |
| Job keeps failing | After 3 attempts the `failed` handler writes it to `failed_logs` with the reason, so it is not lost silently and one bad job cannot block the queue. |
| Duplicate delivery | The job id is the `requestId`, and the worker also checks for an existing row before inserting. Either way only one row is written. |
| MySQL is down | The worker's insert throws, the job is retried, and jobs pile up in Redis until the database comes back. |
| Provider errors | Logged with the provider's status and message, sent to the client as an SSE `error` event, and the assistant message is marked `failed`. There is no automatic retry, because half a streamed answer cannot be retried without either repeating text the user already saw or throwing it away. |
| User cancels | The browser aborts the request, the server sees the response close and aborts the provider call, the partial message is saved as `cancelled`, and the log records real partial usage. |
| Server or worker restarts | Both handle SIGTERM. The server stops accepting connections and closes; the worker calls `worker.close()` so it finishes the job it is on before exiting. |

One detail worth writing down: the disconnect listener is on the **response**
(`res.on('close')`), not the request. In Node 20 the request's `close` event fires as
soon as the body has been read, which is immediately after `express.json()` runs, so
listening on the request makes every single stream look like an instant disconnect.
I hit exactly that while building this.

**Known gaps.** Logs in flight are lost if the API process is killed, since there is
no local buffer. The ingestion endpoint accepts everything regardless of queue
depth, so there is no backpressure. Rows in `failed_logs` have to be retried
manually.
