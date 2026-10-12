import { getTenants } from '@/lib/tenants';
import { handleAsk } from '@/lib/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const scenario = "My mother's birthday is tonight. Send at least 25 red roses to Kadikoy by 20:00, under 1,500 TRY including delivery. Which shop can fulfil this?";
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = (process.env.BASE_URL || url.origin).replace(/\/$/, '');
  const ask = url.searchParams.get('ask');
  const tenants = getTenants();
  const example = `${origin}/askagent?ask=${encodeURIComponent(scenario)}`;
  const discovery = {
    protocol: 'askagent/0.1',
    title: 'AskAgent — three independent flower shops',
    demo: true,
    scenario_time: process.env.DEMO_CLOCK_ISO || '2026-10-12T17:00:00+03:00',
    description: 'A read-only conversation with fictional merchants. Prices and delivery come from each merchant catalog. Orders require human confirmation on the merchant page.',
    merchants: tenants.map(tenant => ({ id: tenant.id, name: tenant.name, conversation: `${origin}/t/${tenant.id}/askagent`, storefront: `${origin}/t/${tenant.id}` })),
    example,
    privacy: 'Opaque conversation handles expire after 30 minutes. No payment, address or account information is accepted through this endpoint.'
  };
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };
  if (!ask) {
    if (url.searchParams.get('format') === 'json') return Response.json(discovery, { headers });
    const links = discovery.merchants.map(merchant => `<li><strong>${escape(merchant.name)}</strong> · <a href="${escape(merchant.conversation)}">Conversation endpoint</a> · <a href="${escape(merchant.storefront)}">Storefront</a></li>`).join('');
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(discovery.title)}</title><link rel="alternate" type="application/json" href="${origin}/.well-known/askagent.json"></head><body><article><h1>${escape(discovery.title)}</h1><p>${escape(discovery.description)}</p><p>Scenario time: ${escape(discovery.scenario_time)} (fictional demo).</p><h2>Merchants</h2><ul>${links}</ul><h2>Example conversation</h2><p>${escape(scenario)}</p><p><a href="${escape(example)}">Source-backed answers to the example request</a></p><p>A custom question is available at ${origin}/askagent?ask=QUESTION. Each merchant answer contains full follow-up, evidence, quote and handoff links.</p><p>${escape(discovery.privacy)}</p></article></body></html>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (ask.length > 500) return Response.json({ error: 'question_too_long', message: 'A question can contain at most 500 characters.' }, { status: 400, headers });
  const results = await Promise.allSettled(tenants.map(tenant => handleAsk(tenant.id, ask, undefined, origin, request.headers)));
  const answers = results.map((result, index) => result.status === 'fulfilled' ? { tenant: tenants[index].id, name: tenants[index].name, response: result.value } : { tenant: tenants[index].id, name: tenants[index].name, error: 'This merchant could not answer right now. Its direct conversation endpoint remains available.' });
  if (url.searchParams.get('format') === 'json') return Response.json({ ...discovery, question: ask, answers }, { headers });
  const body = answers.map(answer => {
    if ('response' in answer) {
      const response = answer.response!;
      const bullets = response.answer.bullets.map(bullet => `<li>${escape(bullet)}</li>`).join('');
      const next = response.next.map(link => `<li><a href="${escape(link.url)}">${escape(link.label)}</a></li>`).join('');
      const compact = { protocol: response.protocol, version: response.version, tenant: response.tenant, status: response.status, h: response.h, expires_at: response.session?.expires_at, matches: response.matches, alternatives: response.alternatives, mode: response.mode };
      return `<section><h2>${escape(response.answer.title)}</h2><ul>${bullets}</ul>${response.answer.question ? `<p>${escape(response.answer.question)}</p>` : ''}<pre style="white-space:pre-wrap">${escape(JSON.stringify(compact))}</pre><h3>Follow-up links · ${escape(answer.name)}</h3><ul>${next}</ul></section>`;
    }
    return `<section><h2>${escape(answer.name)}</h2><p>${escape(answer.error!)}</p><a href="${origin}/t/${answer.tenant}/askagent">Direct conversation</a></section>`;
  }).join('');
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AskAgent merchant answers</title></head><body><article><h1>Independent merchant answers</h1><p>${escape(ask)}</p><p>Fictional demo · ${escape(discovery.scenario_time)}</p>${body}</article></body></html>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}
