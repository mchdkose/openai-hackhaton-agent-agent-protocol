# AskAgent

A link-based conversation between your assistant and a website's own **real LLM agent**, using ordinary HTTPS requests without MCP installation or client-specific tool registration. Three independent demo flower shops inspect their own business tools, generate their own answers, and pass a selection into a human-confirmed shop page.

The public entry point is [AskAgent's protocol document](https://askagent-hackathon-demo.pages.dev). Its “Test this scenario” section supplies the native ChatGPT prompt and published question link.

## The demonstration

Ask for at least 25 red roses, delivered to Kadikoy by 20:00, for under 1,500 TRY including delivery. The expected catalog outcome is Rose & Stem: **1,370 TRY** with delivery; Petal Atelier: unable to deliver today; Tulip House: a **25-pink-rose alternative**, requiring explicit acceptance of the different color. The agent must inspect the tools and explain the actual conditions rather than replay this example.

There are **24 products across the three catalogs: eight products per merchant, with six delivery districts per merchant**. Each catalog includes stock, stem count, color, price, card-message options, delivery fees, cutoff times, and business policies.

All products, availability, delivery promises and orders are fictional demo data. The displayed scenario clock is fixed to 12 October 2026 at 17:00 in Istanbul. Session expiry and request limits use actual time. The application never charges a payment.

The merchant interface appears at the final handoff with the selected product, delivery-inclusive total, and saved card message. The final **GPT-6 Luna production Queue job passed** for a different request: white roses to Besiktas tomorrow, within 800 TRY, with a card message, vase-fee question, and replacement-policy question. It made **ten actual provider calls**; four generated claims passed the independent check. It selected a 590 TRY bouquet + 120 TRY delivery = **710 TRY**, and omitted the 250 TRY vase to respect the budget.

Native ChatGPT completed the final queued Luna flow, verified the actual model usage, and followed checkout to the **710 TRY product page with the correct visible saved note**. The in-app browser also confirmed the prefilled input. No order was placed in this final verification. Current sanitized evidence is recorded in `artifacts/production-verification.json`. Earlier template, synchronous, or storefront-reading results do not certify this release.

## How a question runs

1. A question GET stores a private task in D1 and sends only its opaque ID to Cloudflare Queue. It immediately returns HTTP 200 with `kind: "pending"` and a full status URL. This contains no merchant verdict, price, or fabricated answer.
2. The durable Queue consumer invokes the merchant agent through an authenticated internal Worker service call. The agent reads the complete catalog and delivery policy, evaluates customer requirements, and can prepare a deterministic proposal through its tools.
3. The model generates its own English answer with fact references. An independent model checks the generated claims. Provider failures retry through Queue; exhaustion returns an explicit error. **Production never substitutes a catalog/template answer.**
4. The assistant follows the returned status links until completion. Pending links increment an `attempt` parameter to distinguish subsequent retrievals. The completed response contains the actual agent answer and full continuation, evidence, quote, and handoff URLs.
5. A human reviews the shop page and explicitly confirms a simulated order through POST. Question, status, quote, and checkout GETs never create orders.

There is **no two-second or other overall model-completion budget**. Individual provider requests retain a normal configurable network timeout (`AGENT_MODEL_TIMEOUT_MS`, default 60 seconds). The tool agent may make multiple requests; Queue keeps that work independent of the short public HTTP request.

## Local development

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENROUTER_API_KEY` to run merchant questions. Without a working provider, the service reports an error rather than a template answer. Generate a random `SESSION_HMAC_SECRET`; the public origin belongs in `BASE_URL` and `NEXT_PUBLIC_SITE_URL`. Credentials belong only in server-side environment variables. `.env.local`, `.data` and local tooling are excluded from Git.

```sh
npm run typecheck
npm test
npm run build
```

Local development runs jobs in the long-lived Node process; production requires the durable Cloudflare Queue. Unit tests use injected model fixtures or the test-only offline path. They verify behavior without claiming production model execution. The older `artifacts/smoke-result.json` records the preceding local synchronous checks and is not proof of the current queued real-agent flow.

## Conversation endpoints

The protocol discovery is `/askagent`; the machine-readable registry is `/.well-known/askagent.json`. Each shop supports the same paths under `/t/<shop>/askagent`:

| Path | Purpose |
| --- | --- |
| `?ask=<question>&h=<optional-handle>` | Queue a real-agent question; return pending status and a full poll URL |
| `/status?job=<opaque-id>&attempt=N` | Return pending status, the completed actual answer, or an explicit error |
| `/transcript?h=...` | Conversation summary for continuation in another assistant |
| `/evidence?h=...&sku=...` | Catalog facts with source references |
| `/quote?h=...&sku=...&zone=...` | A deterministic, delivery-inclusive proposal |
| `/checkout?h=...&sku=...` | Verify a proposal from saved requirements and return the human review page |

Responses support markdown, HTML with `?format=html`, and JSON with `?format=json`. Session and task responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. The root question endpoint queues each merchant independently and returns its separate status link. Conversation handles and job IDs are access tokens with a 30-minute lifetime; do not send personal information.

## Models and truth

The verified final configuration uses `openai/gpt-6-luna` for the tool-calling merchant agent and `openai/gpt-6.1-sol` for the independent judge. Model IDs are configurable through server environment variables. The same agent interprets requirements, chooses tools, and generates the customer answer; it does not select canned factual sentences.

The final verified job used 33,207 input tokens, about 87% fewer than the earlier 253,536-token public run. It still used ten model calls; the token reduction is not a guaranteed latency claim.

Deterministic tools own stock eligibility, delivery feasibility, and every price. Generated claims must cite the returned facts and pass rule checks plus the independent model judge. Responses report actual model IDs and provider-reported usage where available. Completed jobs store that actual answer rather than recomputing or substituting a template.

Quotes are recalculated before checkout and order confirmation. An unavailable or changed proposal cannot be silently accepted, and an ineligible selection remains unorderable.

## Deployment and storage

The public `*.pages.dev` domain proxies the OpenNext application Worker through a service binding. Cloudflare D1 provides shared persisted state with versioned compare-and-swap transactions, including private jobs that expire after 30 minutes. Cloudflare Queue `askagent-questions` uses producer binding `ASKAGENT_JOBS`; its consumer processes individual jobs with up to three processing attempts. Queue messages carry no question, handle, or credential.

The consumer calls `/api/internal/agent-job` through `WORKER_SELF_REFERENCE`, authenticated with the existing server-only administrator token and validated origin. Models run outside D1 transaction callbacks. Deploy secrets separately with Wrangler; never place `.env.local` in public assets or a source archive. Local development retains the private file store.

The read-only activity panel shows real audit events. Synthetic false-claim checks are explicitly labelled and counted separately. Administrator-only catalog mutations require a server token and validated origin. Browsing GET requests do not create orders; the user explicitly confirms a simulated order through POST.

## Further reading

- [Architecture decisions](docs/architecture.md)
- [Native-assistant demo script](docs/demo-script.md)
- [Design specification](docs/design/design-spec.md)
- [Visual verification ledger](docs/design/fidelity-ledger.md)

The current business adapter is a florist catalog. The transport contract, continuation, evidence and handoff pattern are the foundation for additional website adapters; the demo does not claim universal compatibility with every assistant or existing website.
