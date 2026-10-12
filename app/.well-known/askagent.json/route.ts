import { getTenants } from '@/lib/tenants';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const origin = (process.env.BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  return Response.json({
    protocol: 'askagent/0.1',
    transport: 'https',
    discovery: `${origin}/askagent`,
    representations: ['text/markdown', 'text/html', 'application/json'],
    capabilities: ['conversation', 'transcript', 'evidence', 'quote', 'human_handoff'],
    session: { parameter: 'h', ttl_seconds: 1800, issuer: 'merchant', scope: 'one merchant' },
    merchants: getTenants().map(tenant => ({ id: tenant.id, name: tenant.name, url: `${origin}/t/${tenant.id}/askagent` })),
    demo: true,
    transaction_policy: 'Read-only discovery and proposals. A human confirms a simulated order on the merchant page.'
  }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
