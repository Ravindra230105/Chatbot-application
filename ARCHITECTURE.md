# Architecture Notes

## Project structure

```
server/
  server.js            API process
  worker.js            queue worker process
  src/
    app.js             express setup
    config/            env values, database, redis
    constants/         shared enums
    middlewares/       api key, validation, session, errors
    models/            sequelize models
    modules/           chat, conversation, logs, metrics
    providers/         openai, groq, anthropic, gemini
    queue/             queue producer and consumer
    sdk/               inference logger and PII redaction
    utils/             logger, api response, sse, helpers
```

```
client/
  index.html
  vite.config.js       dev server and the /api proxy
  nginx.conf           serves the build in Docker
  src/
    main.jsx           entry point and router
    App.jsx            routes
    api/               axios client and endpoint calls
    pages/             chat and dashboard screens
    components/        layout, sidebar, messages, charts, tables
    hooks/             conversation loading
    utils/             constants, formatting, session id
```

Every folder under `modules` holds its own routes, controller, service and validation.
Controllers only deal with HTTP, services hold the logic and are the only layer that
touches the models.

## Tech stack

- Node.js. Streaming responses and request cancellation are first class here, and the
  API, the worker and the SDK all share one language and one set of dependencies.
- Express. Small and unopinionated, which suits a project where the routing layer should
  stay out of the way of the pipeline.
- Sequelize. Gives the module structure a real model layer, and handles the JSON column,
  enums and timestamps without hand written SQL.
- MySQL. A well understood option for this shape of data, and nothing in the schema needs
  Postgres specific features. The one gap is percentiles, which are worked out in the
  service layer instead.
- Redis with BullMQ. The queue needs retries, backoff, concurrency and duplicate job
  detection, and BullMQ provides all four on top of Redis alone.
- Server Sent Events. Token streaming only travels from server to client, so SSE is
  enough and it stays plain HTTP that proxies and browsers already understand.
- Joi. Validation sits at the ingestion boundary and has to be declarative and return
  field level errors that can be stored with a rejected payload.
- React with Vite. Fast dev server, and the build is plain static files that nginx can
  serve directly, so no server side rendering is involved.
- Recharts. Composable React components, enough for the latency and throughput lines
  without pulling in a large charting library.
- Docker and Kubernetes. One image runs both the API and the worker with different
  commands, which keeps the local, Compose and cluster runs identical.

## 1. Ingestion flow

What happens for one chat message:

1. `POST /api/conversations/:uuid/messages`. The controller creates an
   `AbortController` and listens for the response closing, so a disconnect can stop the
   provider call.

2. The chat service loads the conversation, rejects it if the status is not `active`,
   resolves the provider and model, saves the user message, and loads the last 10
   messages as context.

3. A `requestId` is generated and an assistant message is saved with status `streaming`
   and empty content. That row is what links the chat data to the log later.

4. The provider returns an async generator. The service loops over it, appends each
   chunk to the answer and sends it to the client as an SSE `delta` event. The first
   chunk records time to first token.

5. When the stream ends, the assistant message is updated with the full answer and
   status `complete`.

6. The SDK builds the log. Tokens come from the provider if it reported usage,
   otherwise they are estimated. Previews are cut to 500 characters and redacted. The
   request path ends here, because the POST to the ingestion API is not awaited.

7. `POST /api/logs` checks `x-api-key`, then Joi validates the body. An invalid payload
   is rejected with 422 and never reaches the queue.

8. The payload goes on the BullMQ queue with `jobId = requestId`, so a duplicate
   delivery becomes the same job instead of a second one. The API responds 202 straight
   away.

9. The worker picks up the job, adds `totalTokens` and `tokensPerSecond`, redacts the
   previews again, checks whether that `requestId` already exists, inserts the row, and
   updates the token counts on the message and the conversation.

10. The dashboard queries `inference_logs` for the summary, per minute points, per model
    breakdown and recent rows.

## 2. Logging strategy

The SDK wraps the call instead of the developer logging by hand. The chat service only
reports that the call started, that the first token arrived, and how it ended. All the
timing, token accounting, redaction and delivery lives in `startInference()`.

Logging never blocks the response. `tracker.finish()` fires the POST without awaiting it
and catches its own errors, so if the ingestion API is down the user still gets a reply
and a warning is logged.

Success, error and cancelled are three separate statuses. Cancelled does not count
towards the error rate, but the partial output and the real token usage are still kept.

When a provider does not return usage, `metadata.tokenSource` is set to `estimated`, so
an estimated number is never read as a measured one.

Validation happens at the ingestion boundary rather than in the SDK. The SDK sends what
it measured and the API decides what is acceptable, which keeps the rules in one place if
more services start sending logs.

The queue sits between the API and the database. The ingestion endpoint only validates
and enqueues, so it stays fast and does not depend on the database being up at that
moment.

## 3. Scaling considerations

The server and the worker hold no state, so both can run multiple replicas. Worker count
is the main throughput lever because BullMQ spreads jobs across every connected worker.

The metrics queries would break first. `getSummary` loads the `latencyMs` column for the
whole window to work out p95, so a busy hour means a large result set in memory. The fix
is a per minute summary table written by the worker, so the dashboard reads
pre-aggregated rows instead of raw logs.

The logs table grows fastest, one row per call, and it is only queried by time window.
It should be partitioned by day with old partitions dropped, so clearing old data is not
a large `DELETE`.

Redis is a single point of failure. Losing it means logs are dropped while chat keeps
working. Redis with persistence and a replica would be the next step.

Streaming changes how the API is sized. Each active reply holds an open SSE connection,
so the limit is concurrent streams rather than requests per second. Response buffering
has to be off in nginx and in the ingress, otherwise the proxy holds the chunks and the
streaming effect is lost.

Logs are sent one per call, which is fine at this volume but means one HTTP request per
LLM call. Batching every 20 events or every second would cut that down.

## 4. Failure handling

The assumption behind all of it: losing a log is acceptable, losing a chat message is
not. Chat data is written synchronously and logs travel the async path.

- Ingestion API down: the POST fails, a warning is logged, the chat reply is unaffected
  and that log is lost.
- Invalid payload: Joi rejects it with 422 before it is queued, so bad data never
  reaches the queue or the table.
- Redis down: chat still streams. The log delivery times out after
  `INGESTION_TIMEOUT_MS` and logs a warning. The dashboard still loads because the queue
  counts read is bounded by a 3s timeout and falls back to `queue: null`.
- Worker crashes mid job: the job was never acknowledged, so BullMQ retries it three
  times with backoff.
- Job keeps failing: after three attempts it is written to `failed_logs` with the
  reason, so it is not lost silently and one bad job cannot block the queue.
- Duplicate delivery: the job id is the `requestId` and the worker also checks for an
  existing row, so only one row is written either way.
- MySQL down: the insert throws, the job is retried, and jobs wait in Redis until the
  database is back.
- Provider error: logged with the provider status and message, sent to the client as an
  SSE `error` event, and the assistant message is marked `failed`. There is no automatic
  retry, because half a streamed answer cannot be retried without either repeating text
  the user already saw or throwing it away.
- User cancels: the browser aborts the request, the server sees the response close and
  aborts the provider call, and the partial message is saved as `cancelled` with its real
  token usage.
- Restart: both processes handle SIGTERM. The server stops accepting connections and the
  worker finishes the job it is on before exiting.

The disconnect listener is on the response (`res.on('close')`) and not the request. In
Node 20 the request `close` event fires as soon as the body has been read, which is
right after `express.json()` runs, so listening on the request makes every stream look
like an instant disconnect.

Known gaps: logs in flight are lost if the API process is killed, since there is no
local buffer. The ingestion endpoint accepts everything regardless of queue depth, so
there is no backpressure. Rows in `failed_logs` have to be retried by hand.
