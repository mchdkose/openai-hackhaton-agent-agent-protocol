# Cloudflare deployment

AskAgent runs on Cloudflare Workers through OpenNext, with durable protocol state
in the `ASKAGENT_DB` D1 binding. Local `next dev` continues to use the private
`.data/` file store. No Cloudflare credentials belong in the repository.

Stable demo: https://askagent-hackathon-demo.pages.dev

The public Pages application is a minimal service-binding proxy to the Next.js
Worker `askagent-demo`. It forwards all methods and assets internally. Provider
credentials remain only on that Worker. Both domains are Cloudflare-provided;
no custom domain is configured.

## Publish updates

1. Confirm the account with `npx wrangler whoami`; use `npx wrangler login` if needed.
2. Apply schema changes with `npm run cf:migrate`.
3. Run `npm run typecheck` and `npm test`.
4. Run `npm run build:cloudflare`.
5. Run `npm run deploy:cloudflare`; run `npm run deploy:pages` when the proxy changes.
6. Run `npm run cf:secrets` when local server credentials change.
7. Run `SMOKE_ORIGIN=https://askagent-hackathon-demo.pages.dev npm run smoke`.

`BASE_URL` and `NEXT_PUBLIC_SITE_URL` must match the public origin during the
build and in `wrangler.jsonc`. Runtime API credentials, the HMAC secret and the
demo administrator token are uploaded from `.env.local` through stdin by
`cf:secrets`. The uploader prints secret names only. FAL assets are already
generated; no FAL credential is needed in the deployed Worker.

The build script removes OpenNext's copy of local environment values and checks
public assets for provider credentials. Production values come from Worker
bindings and secrets. Merchant state persists in D1 using optimistic concurrency
checks; the singleton JSON row is appropriate for this hackathon prototype.

This deployment uses no paid R2 bucket. Dynamic routes do not use an ISR cache.
The demo clock is fixed at 17:00 Istanbul time on October 12, 2026 so that delivery
cutoffs remain reproducible during judging. Orders are explicitly simulated.

The build applies a narrow OpenNext 1.20.10 compatibility fix: Next 16.4 now
loads `server/preview-props.json`, which the adapter manifest glob omits. The
script adds that generated server manifest to the existing inliner. A local
Workers preview verifies the adapter can initialize dynamic routes.
