# Ollive - Inference Logging and Ingestion System

A streaming chatbot with a logging pipeline around it. Every LLM call is wrapped by a
small SDK that records latency, tokens, status and errors, and posts that to an
ingestion API. The API validates it and puts it on a Redis queue, a worker writes it to
MySQL, and a dashboard reads it back.

Stack: Node.js, Express, Sequelize, MySQL, Redis (BullMQ), React, Vite, Recharts.

![Dashboard](screenshots/dashboard.png)

![Chat](screenshots/chat.png)

## Setup

You need one free API key. Everything else has a default that works.

Get a Groq key from [console.groq.com/keys](https://console.groq.com/keys). It is free
and does not ask for a card. A Gemini key from
[Google AI Studio](https://aistudio.google.com/apikey) works too.

### With Docker

```bash
cp server/.env.example server/.env
# set GROQ_API_KEY=gsk_... in server/.env

docker compose --env-file server/.env up --build
```

Open http://localhost:3000.

Both steps are needed. `.env` is gitignored so it does not exist after a clone, and
compose reads the app config from it. The `--env-file` flag makes that same file the
source of truth for the MySQL container password, otherwise the server and the database
end up with different values.

Stop with `docker compose --env-file server/.env down`.

### Without Docker

Needs Node 20+, MySQL 8+ and Redis running locally.

```bash
cd server
cp .env.example .env          # set DB_PASSWORD and GROQ_API_KEY
npm install
npm run db:sync               # creates the database and tables
npm run dev                   # API on :5000
npm run worker:dev            # second terminal
```

```bash
cd client
npm install
npm run dev                   # http://localhost:5173
```

## Project structure

```
server/          Express API, ingestion API and the queue worker
client/          React app (chat + dashboard)
k8s/             Kubernetes manifests
docker-compose.yml
```

The server uses a module per feature, each with its own routes, controller, service and
validation:

```
server/
  server.js                  API process
  worker.js                  queue worker process
  src/
    app.js                   express setup
    config/                  env, sequelize, redis
    constants/               enums
    models/                  sequelize models
    middlewares/             validate, api key, session, error handler
    modules/
      chat/                  streaming chat
      conversation/          create, list, resume, cancel
      logs/                  ingestion API and storage
      metrics/               dashboard queries
    providers/               openai, groq, anthropic, gemini
    sdk/                     inference logger, PII redaction, pricing
    queue/                   BullMQ queue and worker
    utils/                   logger, api response, sse, helpers
```

## How it works

```
React client
    |  POST /api/conversations/:uuid/messages   (SSE response)
    v
chat service  ---------->  LLM provider (streaming)
    |                            |
    | saves conversation         | SDK measures the call
    | and messages to MySQL      v
    |                      POST /api/logs
    |                            |  validate with Joi
    |                            v
    |                      Redis queue (BullMQ)
    |                            |
    |                            v
    |                      worker.js  ->  MySQL inference_logs
    v
MySQL  <--------------------  dashboard queries
```

Two things happen on every message:

1. The chat service saves the conversation and streams tokens to the browser over SSE.
2. The SDK measures the same call and posts a log. This is not awaited, so a slow or
   broken logging pipeline cannot affect the chat.

The two sides are linked by a `requestId` that is generated before the call and stored
on the assistant message row.

There are two processes because of this split. `server.js` serves the API and
`worker.js` consumes the queue, so they can be scaled and restarted independently.

More detail in [ARCHITECTURE.md](ARCHITECTURE.md).

## What the SDK records

`server/src/sdk/inferenceLogger.js` wraps a call. The chat service only reports what
happened:

```js
const tracker = startInference({ requestId, conversationUuid, provider, model, inputText });

for await (const chunk of provider.streamChat({ model, messages, signal })) {
    tracker.markFirstToken();
    // stream the chunk to the browser
}

tracker.finish({ status: 'success', outputText, usage, chunkCount });
```

Each log has provider, model, status, latency, time to first token, prompt and
completion tokens, redacted input and output previews, error type and message, and the
conversation, session and message ids.

If a provider does not report token usage the SDK estimates it from text length and sets
`metadata.tokenSource` to `estimated`, so an estimate is never mistaken for a real
number.

A cancelled stream is stored as `cancelled`, not an error. The partial answer and the
tokens that were actually generated are still kept, because those tokens were spent.

## PII redaction

`server/src/sdk/redact.js` masks emails, phone numbers, card numbers, Aadhaar, PAN and
API keys. It runs twice: in the SDK before the log leaves the process, and again in the
ingestion service before storing. The second pass is there because the SDK is a library
another service could use with redaction turned off.

Chat messages themselves are stored as the user typed them, since that is what they
expect to see when they reopen a conversation. Redaction applies to the logging copy.

## API

All routes are under `/api`.

| Method | Route | Description |
|---|---|---|
| GET | `/providers` | Providers, models, and which have keys |
| POST | `/conversations` | Create a conversation |
| GET | `/conversations` | List conversations |
| GET | `/conversations/:uuid` | Conversation with messages (resume) |
| POST | `/conversations/:uuid/cancel` | Cancel a conversation |
| POST | `/conversations/:uuid/messages` | Send a message, reply streams over SSE |
| POST | `/logs` | Ingestion endpoint, needs `x-api-key` |
| GET | `/metrics/overview` | Totals, error rate, p95, tokens |
| GET | `/metrics/timeseries` | Per minute points for the charts |
| GET | `/metrics/logs` | Recent inference logs |

The SSE stream sends four events: `meta`, `delta`, `done` and `error`.

To cancel a running reply the client just aborts the request. The server sees the
response close, aborts the provider call, and saves the partial message as `cancelled`.

## Schema and design decisions

Four tables, defined as Sequelize models in `server/src/models`.

**conversations** - uuid, sessionId, title, status, provider, model, messageCount,
totalTokens, lastMessageAt.

**messages** - uuid, conversationId, seqNo, role, content, status, tokenCount,
requestId.

**inference_logs** - requestId, conversationUuid, messageUuid, sessionId, provider,
model, status, latencyMs, timeToFirstTokenMs, promptTokens, completionTokens,
totalTokens, errorType, errorMessage, inputPreview, outputPreview, piiRedacted,
metadata (JSON), startedAt, finishedAt.

**failed_logs** - payloads that could not be stored, with the reason.

Decisions worth explaining:

- **Auto increment ids internally, UUIDs in the API.** Joins use the integer id, but a
  numeric id is never returned to a client.
- **`inference_logs` has no foreign key to conversations or messages.** Logs arrive
  asynchronously and can arrive late, so a foreign key would either fail the insert or
  drag logging into the chat transaction. It keeps `conversationUuid` and `messageUuid`
  as plain references instead. `messages` does have a real foreign key to
  `conversations`, because that write is synchronous and owned by one service.
- **`requestId` is unique.** Queues deliver at least once, so if the worker dies after
  writing but before acknowledging, the job comes back. The unique key plus a check
  before insert makes a repeat delivery a no-op. BullMQ also uses it as the job id.
- **`metadata` is a JSON column.** Fields like `tokenSource` and `tokensPerSecond`
  change often and keeping them in JSON avoids a migration each time. Anything worth
  filtering on (status, latency, tokens, provider, model) is a real column.
- **Previews are capped at 512 characters** while message content is TEXT. The log keeps
  enough to debug and no more, which limits both table growth and how much sensitive
  text gets copied.

## Tradeoffs

- **MySQL instead of Postgres.** Postgres has better JSON indexing and native percentile
  functions. I picked MySQL because I know it well, and p95 is small enough to calculate
  in the service layer.
- **BullMQ instead of Kafka.** BullMQ gives retries, backoff, concurrency and job dedupe
  out of the box and only needs Redis. Kafka makes sense at higher volume or with
  several independent consumer groups.
- **The ingestion API lives in the same Express app as the chat API.** The SDK talks to
  it over HTTP, so it can be split out later without changing the SDK. Running it
  separately now would add a deployment for no benefit at this size.
- **An explicit SDK wrapper instead of patching `fetch`.** A `startInference()` and
  `finish()` pair is easy to read and debug. Patching fetch globally works and needs no
  call site changes, but it is invisible when it misbehaves.
- **`sequelize.sync()` instead of migration files.** Faster at this size. A real
  deployment needs migrations, because sync cannot do safe renames or backfills.
- **Metrics are calculated from raw logs on each request.** Simple and accurate, but it
  scans the window every time and loads latency values into the service to work out p95.
- **Logs are sent one at a time, not batched.** Simpler and closer to real time. At high
  traffic this should be batched.
- **Model ids come from env vars.** Every id I first hardcoded had already been retired,
  and Gemini's own models endpoint still listed models that returned 404 on use. Now a
  retired model is a one line change.
- **Output token limits are per provider.** Gemini needs a high ceiling because its
  reasoning tokens count against the limit, but Groq reserves the requested `max_tokens`
  against its tokens per minute quota, so one shared value throttled it after two
  requests. `MAX_OUTPUT_TOKENS` covers the OpenAI compatible providers and Anthropic,
  `GEMINI_MAX_OUTPUT_TOKENS` covers Gemini.

## What I would improve with more time

- **Tests.** Nothing is automated yet. I would start with the SDK payload builder, the
  redaction rules and the worker's duplicate check.
- **Pre-aggregated metrics.** A per minute summary table written by the worker would keep
  the dashboard fast as the logs table grows.
- **Batch the log delivery** and add a small retry buffer in the SDK, so a restart cannot
  lose logs that are in flight.
- **Proper migrations** with sequelize-cli.
- **Retention on `inference_logs`**, probably partitioning by day and dropping old
  partitions.
- **Auth.** There is no login. Conversations are grouped by a session id kept in
  localStorage, which is fine for a demo and not for real users. The column and its index
  are already there, so it would become a `user_id` foreign key.
- **A retry screen for `failed_logs`.** They are stored but reprocessing is manual.
- **Rate limiting** on the ingestion endpoint.

## Kubernetes

Deployed and tested on a local k3s cluster.

```bash
docker build -t ollive/server:latest ./server
docker build -t ollive/client:latest ./client

kubectl apply -f k8s/infra.yaml
kubectl apply -f k8s/app.yaml
kubectl -n ollive get pods
```

Set the real values in the `app-secrets` Secret before applying.

`k8s/infra.yaml` has the namespace, ConfigMap, Secret, MySQL with a PVC and Redis.
`k8s/app.yaml` has the server, the worker with an autoscaler, the client and an Ingress.

Three things were needed to make it work:

- The server Deployment runs `npm run db:sync` as an initContainer, so the tables exist
  before the app starts.
- `imagePullPolicy: IfNotPresent` everywhere, otherwise a `:latest` tag makes Kubernetes
  try to pull from Docker Hub and fail on locally built images.
- The Ingress expects an nginx ingress controller with response buffering off, which SSE
  needs. k3s ships Traefik instead, so on k3s reach it with
  `kubectl -n ollive port-forward svc/client 8080:80`, which is how this run was checked.

![Kubernetes dashboard](screenshots/kubernetes-dashboard.png)
