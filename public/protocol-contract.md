# AskAgent HTTP contract — 0.1

An assistant discovers a website's own agent, submits a natural-language
request, follows the returned completion links, and returns a human review
link. No MCP server, account registration, provider key or custom assistant
connector is required by the client. The website pays for and controls its agent.

## Separate the transport from the business adapter

The transport consists of discovery, question submission, pending/answer/error
envelopes, opaque continuation handles, evidence and labeled next links.
Catalog products, flower colors and delivery districts belong to this
demonstration's florist adapter. They are not mandatory concepts in the wire
schema. Another website must implement the contract and connect its own tools;
this prototype does not claim to control arbitrary unmodified websites.

## Discover

Read `/.well-known/askagent.json`. It advertises endpoints, methods, schemas,
capabilities, adapter identity and async processing. This installation's manifest
lists three fictional merchant agents sharing one deployment.

## Ask

Web-reading assistants can submit a URL-encoded question by GET:

```http
GET /t/rose-and-stem/askagent?ask=QUESTION&format=html
```

Software clients can avoid putting a question in the URL:

```http
POST /t/rose-and-stem/askagent
Content-Type: application/json
Accept: application/json

{"ask":"What is your replacement policy?","h":"OPTIONAL_EXISTING_HANDLE"}
```

Omit `h` for a new conversation. Actual handles match `h_` plus 32 lowercase
hexadecimal characters. Requests support up to 2,000 characters. Do not send
personal addresses, phone numbers, account or payment information. POST submits
a question; it cannot submit an order.

## Pending is not an answer

Question submission returns an envelope with `protocol: "askagent"`,
`version: "0.1"`, `kind: "pending"`, a private job lifetime and a `next` link
whose `rel` is `status` and method is GET. Follow the exact returned URL. Each
pending result returns a new attempt URL so web retrievers can distinguish it
from a previously fetched result. Polling does not restart the LLM job.

There is no two-second overall completion limit. The agent is durable and can
continue while the client polls. Clients can cancel their own wait with an
AbortSignal. Jobs and handles expire after 30 minutes. A model failure returns
an explicit error; a catalog template never replaces the merchant answer.

## Answer and continuation

A completed result has `kind: "answer"`, generated English prose, cited facts,
actual model execution/usage, and labeled next links. Adapter-specific fields
may include requirements, alternatives or an evaluated quote.

Preserve `h` for a follow-up. The server rejects an expired, malformed or
different-agent handle rather than silently dropping its requirements. The
provided continuation example asks to review the current request without
changing it. Replace its `ask` with the actual follow-up.

## Evidence and human review

Follow `evidence`, `quote` and `transcript` links as GETs. A checkout link prepares
a human review page; GET never creates an order. A changed or ineligible quote
cannot be silently accepted. This demo records an order only after a human
confirms the shop form's explicit POST. No payment or real delivery occurs.

## Small software client

Download `/askagent-client.mjs` and import it into a JavaScript runtime with fetch:

```js
import { AskAgentClient } from './askagent-client.mjs';

const client = new AskAgentClient();
const manifest = await client.discover('https://askagent-hackathon-demo.pages.dev');
const result = await client.ask(manifest.merchants[0].url,
  'Send 25 red roses to Kadikoy today before 20:00, under 1500 TRY.');
console.log(result.answer);
const quote = await client.follow(result, 'quote');
```

The client handles JSON POST, status polling, continuation handles, errors and
cancellation. It refuses a polling link to a different origin and never submits
a purchase. Browser clients use the public question endpoint's CORS support;
questions do not use cookies or client credentials.

Machine contracts are `/askagent-request.schema.json` and
`/askagent-response.schema.json`. Implement the envelope and link semantics to
add another business adapter; keep its policy and actions under that website's
control.
