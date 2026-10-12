# Architecture decisions

The primary demonstration is three fictional Istanbul florists. It makes the counterpart's value immediately visible: only the merchant knows its current catalog, delivery zones and promises. The same conversational contract carries the request, independent answer, evidence, proposal and human handoff.

The jury starts in native ChatGPT with a public website URL. The application is a normal website and HTTP endpoint; it requires no connector or MCP installation. Native assistant behavior is a compatibility question to measure, not a universal guarantee.

## Stack

Next.js 16.4 App Router, React 19.3, TypeScript, Zod 4.6 and OpenRouter. Claude Haiku 5.5 extracts constrained requirements; Claude Sonnet 5.5 selects presentation; GPT-6.1 Sol supplies a separate provider's check. Model IDs were verified against OpenRouter's live public catalog. Responses identify whether the model path or deterministic fallback was actually used.

## Truth boundary

Code selects eligible catalog items and computes price, delivery fee, add-ons and totals. Budget includes delivery. Out-of-stock or late products cannot become a successful match. Models cannot write authoritative numeric fields. The independent model judge supplements deterministic validation; it is not a guarantee of correctness or an injection detector.

## Sessions and freshness

Each merchant mints a random 128-bit handle with 30-minute real-time expiry. Sessions cannot cross merchant boundaries. Cached model decisions contain no session handle, links, card message or rendered response. Delivery feasibility uses an explicitly labelled fixed fictional scenario clock; session expiry and rate limits use real time. Quotes are recalculated against the current catalog before handoff and order confirmation.

The initial product request renders the conversation block server-side. Browser history removes only the handle parameter afterwards. No redirect or identity cookie is needed. A clean-URL refresh deliberately returns the standard product page. The card message is temporary and does not appear in audit records.

## Transactions and audit

GET can read, converse and prepare a nonbinding proposal. It cannot buy, decrement stock, allocate delivery capacity or create an order. The simulated order is an explicit, same-origin POST from the merchant page with current-quote validation and idempotency.

Audit entries contain bounded requirement summaries, HMAC session pseudonyms, provider/check status, source references, elapsed time and reported model cost. They do not contain raw questions, addresses, IPs, session handles, API credentials or full user agents. User-agent labels are heuristic and may remain unknown. Public demo activity is read-only. A seeded false-claim test is clearly isolated from actual merchant conversations.

## Storage and deployment

Local development uses a private `.data` store. Cloudflare Workers use Cloudflare D1 with versioned compare-and-swap transactions so separate requests share sessions, audit events and idempotent orders. The bounded demo state is stored in one JSON document; this is a prototype storage layout, rather than a production-scale data model. Optional Upstash remains another hosted storage path. Secrets stay in server-only environment variables; the public origin contains no credentials.

The demo catalogs and payment are fictional. No conversion-lift result is claimed.
