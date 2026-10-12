import { getTenants } from '@/lib/tenants';
export function GET(request: Request) {
  const origin = (process.env.BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const text = `# AskAgent\n\nFictional flower merchants with source-backed conversational endpoints. Each endpoint supplies its own full next-step links and a short-lived conversation handle.\n\n- [Protocol discovery](${origin}/askagent)\n- [Machine-readable registry](${origin}/.well-known/askagent.json)\n${getTenants().map(tenant => `- [${tenant.name}](${origin}/t/${tenant.id}/askagent)`).join('\n')}\n\nQuotes are proposals. Orders require human confirmation on a merchant page.\n`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
