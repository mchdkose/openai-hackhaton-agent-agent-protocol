import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getTenants } from '@/lib/tenants';
import { SiteHeader, SiteFooter } from '@/components/site-shell';

export default function ProtocolPage() {
  const tenants = getTenants();
  return <><SiteHeader active="protocol" /><main id="main" className="page-width protocol-page">
    <section className="protocol-intro"><h1>The web already has links.<br />Now they can answer.</h1><p>AskAgent gives a business a conversational front door. An assistant with web access can discover the shop, ask a question, follow the conversation, and return a prepared order to its user.</p></section>
    <div className="protocol-url"><span>One ordinary HTTPS request</span><code>/t/rose-and-stem/askagent?ask=25%20red%20roses%20in%20Kadikoy</code><Link className="text-link" href="/t/rose-and-stem/askagent">Open discovery <ArrowUpRight size={17} /></Link></div>
    <section className="protocol-steps">{[
      ['Discover', 'The site publishes what its agent can do, its demo context, and a first question link.'],
      ['Ask', 'A GET question returns a readable answer backed by the merchant’s catalog, stock, delivery zones, and price rules.'],
      ['Continue', 'Returned links carry a short-lived opaque handle. The next assistant can read the transcript and continue the same request.'],
      ['Verify', 'Catalog evidence and quote links expose the facts behind a recommendation. Model answers are checked against those facts.'],
      ['Hand off', 'The assistant returns a prepared product page. The selection, delivery quote, and card note come with the conversation.'],
      ['Confirm', 'The human reviews the offer and explicitly confirms a demo order. Reading a link never places an order.'],
    ].map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section className="protocol-notes"><h2>Small enough to try.<br />Clear enough to trust.</h2><div><p>The prototype uses ordinary HTTP links. It requires no MCP server registration or custom ChatGPT connector. An assistant still needs working web access and must follow the site’s links; native ChatGPT compatibility has to be demonstrated in the actual account.</p><p>Every answer reports whether it used models or catalog rules. The second model adds an independent check; deterministic rules enforce stock, pricing, and eligibility. Assistant names in the activity view are user-agent hints.</p><p>Catalogs and orders are demonstration data. The scenario uses a fixed Istanbul time to make the delivery comparison repeatable. Conversation handles expire after 30 minutes and are removed from the product page URL after the handoff.</p></div></section>
    <section className="protocol-endpoints"><div className="section-topline"><h2>Meet the agents.</h2><p>Same protocol. Different business rules.</p></div>{tenants.map(tenant => <Link key={tenant.id} href={`/t/${tenant.id}/askagent`}><strong>{tenant.name}</strong><code>/t/{tenant.id}/askagent</code><ArrowRight size={21} /></Link>)}</section>
  </main><SiteFooter /></>;
}
