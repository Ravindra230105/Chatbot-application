# Ollive - Inference Logging and Ingestion System

A chatbot that streams replies, plus a logging pipeline around it. Every LLM call goes
through a small SDK that records latency, tokens, status and errors. The SDK posts that
to an ingestion API, the API validates it and puts it on a Redis queue, and a worker
saves it to MySQL. A dashboard reads it back.

Built with Node.js, Express, Sequelize, MySQL, Redis (BullMQ), React and Vite.

![Dashboard](screenshots/dashboard.png)

![Chat](screenshots/chat.png)

## Setup

You need at least one API key. Groq and Gemini are both free and do not ask for a card.
Groq keys come from https://console.groq.com/keys and Gemini keys from
https://aistudio.google.com/apikey.

Set either `GROQ_API_KEY` or `GEMINI_API_KEY` in `server/.env`, or both, and then pick
the provider from the dropdown in the app. OpenAI and Anthropic are implemented too, but
they stay unavailable until a key is added.

Groq is the better one for a demo. It replies in about 150 to 330ms and sends many small
chunks, so you can clearly see the text stream in. Gemini takes 1 to 3 seconds and sends
fewer, larger chunks.

### With Docker

```bash
cp server/.env.example server/.env
# in server/.env set DB_PASSWORD to anything, and add a provider key

docker compose --env-file server/.env up --build
```

Open http://localhost:3000.

`DB_PASSWORD` can be any value you like. Docker creates a fresh MySQL container with
it, so it does not have to match anything you already have. Compose stops with a clear
error if it is left blank.

The `--env-file` flag is needed because compose reads the app settings from
`server/.env`. Without it the MySQL container and the server end up with different
passwords.

### Without Docker

You need Node 20+, MySQL 8+ and Redis running on your machine.

```bash
cd server
cp .env.example .env      # set DB_PASSWORD and a provider key
npm install
npm run db:sync           # creates the database and tables
npm run dev               # API on port 5000
npm run worker:dev        # in a second terminal
```

```bash
cd client
npm install
npm run dev               # http://localhost:5173
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

Two things happen when you send a message.

The chat service saves the conversation, calls the provider, and streams the reply to
the browser over SSE. This is the part the user waits for.

At the same time the SDK measures that call and posts a log. It does not wait for the
response, so if the logging pipeline is slow or down the chat still works. Both sides
are linked by a `requestId` that is created before the call and saved on the assistant
message row.

That is why there are two processes. `server.js` runs the API and `worker.js` reads the
queue, so they can be restarted or scaled separately.

Each log has the provider, model, status, latency, time to first token, prompt and
completion tokens, input and output previews, error details, and the conversation and
session ids. If a provider does not send token usage the SDK estimates it and marks
`metadata.tokenSource` as `estimated`, so an estimate is never confused with a real
number. A cancelled stream is saved as `cancelled` and not as an error, but the partial
reply and the tokens that were used are still kept.

Emails, phone numbers, card numbers, Aadhaar, PAN and API keys are masked before the log
leaves the process, and masked again in the ingestion service. Chat messages are stored
as the user typed them, because that is what they expect to see when they open the
conversation again.

More detail is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Folders

```
server/     Express API, ingestion API and the queue worker
client/     React app (chat and dashboard)
k8s/        Kubernetes manifests
```

Inside `server/src` each feature is its own module with routes, controller, service and
validation: `chat`, `conversation`, `logs` and `metrics`. Shared code sits in `config`,
`constants`, `models`, `middlewares`, `providers`, `sdk`, `queue` and `utils`.

## API

All routes start with `/api`.

- `GET /providers` - providers, models, and which ones have keys
- `POST /conversations` - create a conversation
- `GET /conversations` - list conversations
- `GET /conversations/:uuid` - conversation with all messages
- `POST /conversations/:uuid/cancel` - cancel a conversation
- `POST /conversations/:uuid/messages` - send a message, reply streams over SSE
- `POST /logs` - ingestion endpoint, needs `x-api-key`
- `GET /metrics/overview` - totals, error rate, p95, tokens
- `GET /metrics/timeseries` - per minute points for the charts
- `GET /metrics/logs` - recent inference logs

The SSE stream sends four events: `meta`, `delta`, `done` and `error`. To stop a reply
the client just aborts the request. The server sees the response close, aborts the
provider call, and saves the partial message as cancelled.

## Schema and design decisions

There are four tables, defined as Sequelize models in `server/src/models`.

`conversations` holds the thread with its title, status, provider, model, message count
and token total. `messages` holds each user and assistant message with its status and
token count. `inference_logs` holds one row per LLM call with all the metadata above.
`failed_logs` holds payloads that could not be saved, with the reason.

A few notes on the choices:

Tables use an auto increment id internally but the API only returns UUIDs, so numeric
ids are never exposed.

`inference_logs` has no foreign key to conversations or messages. Logs arrive
asynchronously and can arrive late, so a foreign key would either fail the insert or
force logging into the chat transaction. It stores the uuids as plain references
instead. `messages` does have a real foreign key to `conversations`, because that write
is synchronous.

`requestId` is unique. A queue can deliver the same job twice, for example if the worker
dies after writing but before acknowledging. The unique key plus a check before insert
means a repeat delivery does nothing. BullMQ also uses it as the job id.

`metadata` is a JSON column. Fields like `tokenSource` change often and JSON avoids a
migration each time. Anything that needs filtering, like status or latency, is a real
column.

Previews are limited to 512 characters while message content is TEXT. The log keeps
enough to debug a request and no more.

## Tradeoffs

MySQL was chosen over Postgres. Postgres has better JSON indexing and built in
percentile functions, but MySQL was the more familiar option here and p95 is easy enough
to work out in the service layer.

BullMQ was used instead of Kafka. It gives retries, backoff and job dedupe out of the
box and only needs Redis. Kafka would make sense at much higher volume.

The ingestion API sits in the same Express app as the chat API. The SDK talks to it over
HTTP so it can be moved out later without changing the SDK. A separate deployment now
would not add anything at this size.

The SDK is an explicit wrapper instead of a patch on `fetch`. Patching fetch would need
no changes at the call site, but it is hard to debug when it goes wrong.

`sequelize.sync()` is used instead of migration files, which is faster for a project
this size. A real deployment needs migrations because sync cannot rename columns safely.

Metrics are calculated from the raw logs on every request. It is simple and correct but
it scans the window each time.

Logs are sent one at a time instead of in batches. Simpler and closer to real time, but
at high traffic this should be batched.

Model ids come from env vars. The ids that were hardcoded first had already been
retired, and Gemini still listed models in its models endpoint that returned 404 when
used.

Output token limits are per provider. Gemini needs a high limit because its reasoning
tokens count against it, but Groq reserves the requested `max_tokens` against its tokens
per minute quota, so a single shared value throttled it after two requests.

## What could be improved with more time

Tests. There is nothing automated yet. The first targets would be the SDK payload
builder, the redaction rules and the duplicate check in the worker.

A per minute summary table written by the worker, so the dashboard does not read raw
logs as the table grows.

Batched log delivery with a small retry buffer in the SDK, so a restart cannot lose logs
that are in flight.

Proper migrations with sequelize-cli, and a retention policy on `inference_logs`.

Login. Right now conversations are grouped by a session id in localStorage, which is
fine for a demo but not for real users. The column and index are already there so it
would become a `user_id` foreign key.

A screen to retry rows in `failed_logs`, and rate limiting on the ingestion endpoint.

## Kubernetes

This was tested on a local k3s cluster.

```bash
docker build -t ollive/server:latest ./server
docker build -t ollive/client:latest ./client

kubectl apply -f k8s/infra.yaml
kubectl apply -f k8s/app.yaml
kubectl -n ollive get pods
```

Set the real values in the `app-secrets` secret before you apply it.

`infra.yaml` has the namespace, config, secret, MySQL with a volume and Redis.
`app.yaml` has the server, the worker with an autoscaler, the client and an ingress.

Three things were needed to make it run. The server runs `npm run db:sync` as an init
container so the tables exist before the app starts. Every container needs
`imagePullPolicy: IfNotPresent`, otherwise a `latest` tag makes Kubernetes try to pull
from Docker Hub. And the ingress expects nginx with buffering off for SSE, so on k3s,
which ships Traefik, use `kubectl -n ollive port-forward svc/client 8080:80`.

![Kubernetes dashboard](screenshots/kubernetes-dashboard.png)
