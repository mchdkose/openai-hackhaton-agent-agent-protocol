# AskAgent

A link-based conversation between your assistant and a website's own agent. Three independent demo flower shops respond from their own catalog and delivery rules. The assistant compares their answers; a short-lived conversation link carries the choice into the shop's normal checkout page.

## The demonstration

Ask for at least 25 red roses, delivered to Kadikoy by 20:00, for under 1,500 TRY including delivery. Rose & Stem can fulfil the request for **1,370 TRY**. Petal Atelier cannot deliver today. Tulip House has a **25-pink-rose alternative**, requiring explicit acceptance of the different color.

All products, availability, delivery promises and orders are fictional demo data. The displayed scenario clock is fixed to 12 October 2026 at 17:00 in Istanbul. Session expiry and request limits use actual time. The application never charges a payment.

The public entry point is [the protocol document](https://askagent-hackathon-demo.pages.dev), with a “Test this scenario” section for trying the conversation in native ChatGPT. The homepage presents the HTTP contract; the merchant interface appears at the final purchase handoff with the selected product, delivery-inclusive total and carried card message. Native ChatGPT has read and compared the catalogs; the complete dynamic conversation still requires verification on the deployed URL. Browser and API tests alone do not establish it.

## Local development

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENROUTER_API_KEY` for the model path. Generate a random `SESSION_HMAC_SECRET`; the public origin belongs in `BASE_URL` and `NEXT_PUBLIC_SITE_URL`. Credentials belong only in server-side environment variables. `.env.local`, `.data` and local tooling are excluded from Git.

```sh
npm run typecheck
npm test
npm run build
npm run smoke
```

The smoke test uses the running local server. It exercises the three independent answers, delivery-inclusive quote, conversation continuity, card message, handoff, explicit simulated order, duplicate prevention and private audit records. Its persisted report contains no conversation handles.

## Conversation endpoints

The protocol discovery is `/askagent`; the machine-readable registry is `/.well-known/askagent.json`. Each shop supports the same paths under `/t/<shop>/askagent`:

| Path | Purpose |
| --- | --- |
| `?ask=<question>&h=<optional-handle>` | A source-backed answer and full next-step URLs |
| `/transcript?h=...` | Conversation summary for continuation in another assistant |
| `/evidence?h=...&sku=...` | Catalog facts with source references |
| `/quote?h=...&sku=...&zone=...` | A deterministic, delivery-inclusive proposal |
| `/checkout?h=...&sku=...` | The merchant page for human review and confirmation |

The response is markdown, minimal HTML when requested, or JSON with `?format=json`. Session responses are never HTTP-cached. The root question endpoint can collect the three merchant responses while preserving their separate handles and source links.

## Models and truth

OpenRouter routes requirement extraction to Claude Haiku 5.5, presentation selection to Claude Sonnet 5.5 and an independent check to GPT-6.1 Sol. Deterministic code owns stock eligibility, delivery feasibility and every price. The composer can select known factual frames; it cannot invent a price or delivery promise. The response reports the actual model/fallback path and available provider-reported usage.

Cached decisions contain no user handle or card message. Every request renders fresh links. Catalog changes invalidate the grounded decision cache. Quotes are recalculated before checkout and order confirmation; a changed or unavailable quote cannot be silently accepted.

## Deployment and storage

Cloudflare Workers deployment uses the OpenNext adapter. Cloudflare D1 provides shared persisted state with versioned compare-and-swap transactions; local development retains the private file store. The D1 binding and migration are described in the deployment files. Deploy secrets separately with Wrangler; never place `.env.local` in public assets or a source archive.

The read-only activity panel shows real audit events. Synthetic false-claim checks are explicitly labelled and counted separately. Administrator-only catalog mutations require a server token and validated origin. Browsing GET requests do not create orders; the user explicitly confirms a simulated order through POST.

## Further reading

- [Architecture decisions](docs/architecture.md)
- [Native-assistant demo script](docs/demo-script.md)
- [Design specification](docs/design/design-spec.md)
- [Visual verification ledger](docs/design/fidelity-ledger.md)

The current business adapter is a florist catalog. The transport contract, continuation, evidence and handoff pattern are the foundation for additional website adapters; the demo does not claim universal compatibility with every assistant or existing website.
