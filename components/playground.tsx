'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check, CornerDownLeft, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { AskEnvelope, TenantId } from '@/lib/types';
import { DEFAULT_ASK } from './chatgpt-launch';
import { money } from './site-shell';

type Shop = { id: TenantId; name: string; role: 'yes' | 'no' | 'partial' };
type Reply = { shop: Shop; envelope?: AskEnvelope; error?: string };
const labels: Record<string, string> = { yes: 'A perfect match', no: 'Not this time', partial: 'Another possibility', needs_details: 'One more detail' };

export function Playground({ tenants, siteOrigin, selectedTenant }: { tenants: Shop[]; siteOrigin?: string; selectedTenant?: TenantId }) {
  const [ask, setAsk] = useState(DEFAULT_ASK);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [busy, setBusy] = useState(false);
  const [followups, setFollowups] = useState<Record<string, string>>({});
  const [loadingShop, setLoadingShop] = useState<string | null>(null);
  const [preparingShop, setPreparingShop] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<TenantId[]>(selectedTenant ? [selectedTenant] : tenants.map(shop => shop.id));
  const [showRequest, setShowRequest] = useState(false);

  async function request(shop: Shop, question: string, h?: string): Promise<Reply> {
    try {
      const response = await fetch('/api/playground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant: shop.id, ask: question, ...(h ? { h } : {}) }) });
      const envelope = await response.json() as AskEnvelope;
      if (!response.ok || envelope.kind === 'error') return { shop, error: envelope.error?.message || envelope.answer?.title || 'The shop could not answer this request.' };
      return { shop, envelope };
    } catch {
      return { shop, error: 'Connection interrupted. Please try this request again.' };
    }
  }

  async function compare(event: React.FormEvent) {
    event.preventDefault();
    if (!ask.trim() || busy) return;
    setBusy(true);
    const shops = tenants.filter(shop => selected.includes(shop.id));
    setReplies(shops.map(shop => ({ shop })));
    await Promise.all(shops.map(async shop => {
      const result = await request(shop, ask);
      setReplies(current => current.map(reply => reply.shop.id === shop.id ? result : reply));
    }));
    setBusy(false);
  }

  async function continueConversation(reply: Reply) {
    const question = followups[reply.shop.id]?.trim();
    const h = reply.envelope?.h || reply.envelope?.session?.h;
    if (!question || !h || loadingShop) return;
    setLoadingShop(reply.shop.id);
    const result = await request(reply.shop, question, h);
    if (result.error) setActionErrors(current => ({ ...current, [reply.shop.id]: result.error! }));
    else {
      setReplies(current => current.map(item => item.shop.id === reply.shop.id ? result : item));
      setFollowups(current => ({ ...current, [reply.shop.id]: '' }));
      setActionErrors(current => ({ ...current, [reply.shop.id]: '' }));
    }
    setLoadingShop(null);
  }

  function localLink(href: string, format?: 'json') {
    const url = new URL(href, window.location.origin);
    if (format) url.searchParams.set('format', format);
    return `${url.pathname}${url.search}`;
  }

  async function prepareOrder(reply: Reply, acceptAlternative: boolean) {
    if (preparingShop || !reply.envelope) return;
    setPreparingShop(reply.shop.id);
    setActionErrors(current => ({ ...current, [reply.shop.id]: '' }));
    try {
      let envelope = reply.envelope;
      if (acceptAlternative) {
        const alternative = envelope.alternatives?.find(match => match.eligible);
        if (!alternative) throw new Error('The shop needs a follow-up before it can prepare this alternative.');
        const acceptance = alternative.name.toLowerCase().includes('pink') ? 'Pink roses are fine; keep the other requirements.' : `I accept the alternative: ${alternative.name}. Keep all other requirements the same.`;
        const accepted = await request(reply.shop, acceptance, envelope.h || envelope.session?.h);
        if (accepted.error || !accepted.envelope) throw new Error(accepted.error || 'Could not confirm the alternative.');
        envelope = accepted.envelope;
        setReplies(current => current.map(item => item.shop.id === reply.shop.id ? accepted : item));
      }
      const quoteLink = envelope.next.find(link => link.rel === 'quote');
      if (!quoteLink) throw new Error('The shop needs a delivery area before it can prepare an order.');
      const quoteResponse = await fetch(localLink(quoteLink.url, 'json'), { headers: { Accept: 'application/json' } });
      const quoted = await quoteResponse.json() as AskEnvelope;
      if (!quoteResponse.ok || quoted.kind === 'error') throw new Error(quoted.error?.message || 'Could not prepare the quote.');
      if (!quoted.quote?.eligible) throw new Error('This selection does not meet the current request. Continue the conversation to choose an eligible option.');
      const checkoutLink = quoted.next.find(link => link.rel === 'checkout');
      if (!checkoutLink) throw new Error('The shop could not prepare an order link.');
      const checkoutResponse = await fetch(localLink(checkoutLink.url, 'json'), { headers: { Accept: 'application/json' } });
      const checkout = await checkoutResponse.json() as AskEnvelope;
      if (!checkoutResponse.ok || checkout.kind === 'error') throw new Error(checkout.error?.message || 'Could not prepare the handoff.');
      const productLink = checkout.next.find(link => link.rel === 'checkout' && new URL(link.url, window.location.origin).pathname.includes('/p/'));
      if (!productLink) throw new Error('The shop could not prepare the product page.');
      window.location.assign(localLink(productLink.url));
    } catch (reason) { setActionErrors(current => ({ ...current, [reply.shop.id]: reason instanceof Error ? reason.message : 'Could not open the prepared order.' })); }
    finally { setPreparingShop(null); }
  }

  return <div className="playground">
    <div className="composer-grid">
    <div className="playground-heading"><h2>A request worth making.</h2><p>Tell the shops what you need.<br />Watch the conversation happen.</p><div className="example-request"><span>Example request</span><blockquote>“My mother’s birthday is tonight. Send at least 25 red roses to Kadikoy by 20:00, under 1,500 TRY including delivery. Add the card message ‘Happy birthday, Mom.’”</blockquote></div></div>
    <form className="request-form" onSubmit={compare}>
      <label htmlFor="request">Your request</label>
      <textarea id="request" value={ask} onChange={event => setAsk(event.target.value)} rows={3} maxLength={500} required />
      <fieldset className="shop-switch"><legend>Shops to compare</legend>{tenants.map(shop => <label key={shop.id}><input type="checkbox" checked={selected.includes(shop.id)} onChange={event => setSelected(current => event.target.checked ? [...current, shop.id] : current.filter(id => id !== shop.id))} /><span className="custom-checkbox" aria-hidden="true">{selected.includes(shop.id) ? <Check size={18} /> : null}</span>{shop.name}</label>)}</fieldset>
      <button className="button button-dark" disabled={busy || !ask.trim() || selected.length === 0} type="submit">{busy ? <><Loader2 className="spin" size={18} /> Shops are checking</> : <>Compare the shops <ArrowUpRight size={18} /></>}</button>
      <p className="request-disclaimer">A demo request. No payment is taken.</p>
    </form>
    </div>
    <div className="playground-note"><span>LIVE PLAYGROUND</span><p>This calls the same merchant agents as the public links. Inventory, prices, and orders are demo data.</p><button type="button" onClick={() => setShowRequest(value => !value)} className="text-link small">{showRequest ? 'Hide' : 'View'} the request {showRequest ? <Minus size={14} /> : <Plus size={14} />}</button></div>
    {showRequest ? <pre className="request-code">{selected.map(id => `POST /api/playground\n${JSON.stringify({ tenant: id, ask }, null, 2)}`).join('\n\n')}</pre> : null}
    {replies.length ? <div className={`reply-grid ${replies.length === 1 ? 'one-reply' : ''}`} aria-live="polite">{replies.map(reply => {
      const { envelope, shop } = reply;
      const h = envelope?.h || envelope?.session?.h;
      const products = envelope?.matches?.filter(match => match.eligible) || [];
      const alternatives = envelope?.alternatives?.filter(match => match.eligible) || [];
      const shown = products.length ? products : alternatives;
      const verdict = envelope?.status || 'needs_details';
      const handoff = envelope?.next.find(link => link.rel === 'checkout');
      return <article key={shop.id} className={`reply-column verdict-${verdict}`}>
        <div className="reply-shop"><Link href={`/t/${shop.id}`}>{shop.name}</Link><ArrowUpRight size={17} /></div>
        {!envelope && !reply.error ? <div className="shop-loading"><Loader2 className="spin" size={22} /><p>Checking stock, delivery, and budget…</p></div> : reply.error ? <div className="reply-error"><h3>Couldn’t reach the shop.</h3><p>{reply.error}</p><button className="text-link" onClick={() => void request(shop, ask).then(result => setReplies(current => current.map(item => item.shop.id === shop.id ? result : item)))}><RotateCcw size={15} />Try again</button></div> : envelope ? <>
          <div className="verdict"><span className="verdict-dot">{verdict === 'yes' ? <Check size={14} /> : verdict === 'no' ? <Minus size={14} /> : <Plus size={14} />}</span>{labels[verdict]}</div>
          <h3>{envelope.answer.title}</h3>
          <ul className="reply-facts">{envelope.answer.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>
          {shown[0] ? <div className="matched-product"><img src={shown[0].image} alt={shown[0].name} /><div><strong>{shown[0].name}</strong><p>{money(shown[0].total ?? shown[0].price)}<span>{shown[0].total !== null ? ' including delivery' : ''}</span></p></div></div> : null}
          {envelope.answer.question ? <p className="shop-question">{envelope.answer.question}</p> : null}
          {handoff && shown[0] && (verdict === 'yes' || verdict === 'partial') ? <button className="button button-outline button-full" onClick={() => void prepareOrder(reply, verdict === 'partial')} disabled={preparingShop !== null}>{preparingShop === shop.id ? <><Loader2 className="spin" size={17} />Preparing your order</> : <>{verdict === 'partial' ? 'Choose this alternative' : 'View prepared order'}<ArrowUpRight size={17} /></>}</button> : null}
          {actionErrors[shop.id] ? <p className="notice reply-action-error" role="alert">{actionErrors[shop.id]}</p> : null}
          {h ? <form className="followup-form" onSubmit={event => { event.preventDefault(); void continueConversation(reply); }}><label htmlFor={`followup-${shop.id}`}>Continue with {shop.name}</label><div><input id={`followup-${shop.id}`} value={followups[shop.id] || ''} onChange={event => setFollowups(current => ({ ...current, [shop.id]: event.target.value }))} placeholder="Ask a follow-up…" maxLength={500} /><button aria-label={`Send follow-up to ${shop.name}`} type="submit" disabled={!followups[shop.id]?.trim() || loadingShop === shop.id}>{loadingShop === shop.id ? <Loader2 className="spin" size={17} /> : <CornerDownLeft size={17} />}</button></div></form> : null}
          <div className="answer-proof"><span>{envelope.referee?.mode === 'model_and_rules' ? 'Second-model + rule verification' : 'Catalog rule verification'}</span><Link href={envelope.next.find(link => link.rel === 'evidence')?.url || `/t/${shop.id}/askagent/evidence`}>Sources <ArrowUpRight size={13} /></Link></div>
          {envelope.mode?.fallback_reason ? <p className="mode-note">Model unavailable. This answer uses catalog rules.</p> : null}
        </> : null}
      </article>;
    })}</div> : <div className="empty-comparison"><span>01</span><p>A match when every condition holds.</p><span>02</span><p>A clear no when it doesn’t.</p><span>03</span><p>An alternative you can actually accept.</p></div>}
  </div>;
}
