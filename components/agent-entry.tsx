import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function AgentEntry({ tenant, name }: { tenant: string; name: string }) {
  const example = 'Send at least 25 red roses to Kadikoy today by 20:00, under 1500 TRY including delivery. Can I add a card message?';
  return <aside className="agent-entry" aria-label="Assistant access">
    <div><h3>This shop speaks agent.</h3><p>Give your assistant this page. It can ask about stock, prices, and delivery, then bring you a prepared order.</p></div>
    <details><summary>For assistants & developers</summary><div className="agent-instructions"><p><strong>AskAgent v0.1 · {name}</strong></p><p>Start by reading <Link href={`/t/${tenant}/askagent`}>the discovery response</Link>. Ask a question using a GET request to <code>/t/{tenant}/askagent?ask=YOUR_URL_ENCODED_QUESTION</code>. Responses contain facts, availability, and next links. Follow the returned continuation links to preserve the conversation handle. Read the evidence and quote links to verify terms. Give the checkout link to the user for review; do not place an order.</p><Link className="text-link" href={`/t/${tenant}/askagent?ask=${encodeURIComponent(example)}`}>Ask this shop <ArrowUpRight size={14} /></Link></div></details>
  </aside>;
}
