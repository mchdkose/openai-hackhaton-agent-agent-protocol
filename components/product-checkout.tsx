'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Loader2 } from 'lucide-react';
import type { Product, Quote, TenantId } from '@/lib/types';
import { money } from './site-shell';

export function ProductCheckout({ tenant, product, h, quote, note }: { tenant: TenantId; product: Product; h: string; quote: Quote; note?: string | null }) {
  const [message, setMessage] = useState(note || '');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{ orderId: string; total: number } | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('h')) {
      url.searchParams.delete('h');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant, h, sku: product.sku }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message || 'Could not create the order. Please check the quote again.');
      setOrder({ orderId: result.orderId, total: result.total });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connection interrupted. Please try again.'); }
    finally { setBusy(false); }
  }

  if (order) return <section className="order-success" role="status"><span className="success-icon"><Check size={27} /></span><h2>A beautiful choice.</h2><p>Your demo order is confirmed.</p><dl><div><dt>Order</dt><dd>{order.orderId}</dd></div><div><dt>Total</dt><dd>{money(order.total)}</dd></div><div><dt>Delivery</dt><dd>{quote.eta_text}</dd></div></dl>{message ? <p className="success-card-note">“{message}”</p> : null}<p className="small muted">No payment was taken. This is a hackathon demo order.</p><Link className="text-link" href="/panel">See the handoff in live activity <ArrowUpRight size={16} /></Link></section>;

  return <form className="checkout-form" onSubmit={submit}>
    <input type="hidden" name="h" value={h} />
    <p className="handoff-banner">Your assistant’s selection is here. Complete the details.</p>
    <div className="field"><label htmlFor="recipient">Recipient name <span>(demo)</span></label><input id="recipient" name="recipient" placeholder="For example, Alex" autoComplete="off" maxLength={100} required /></div>
    <div className="field"><label htmlFor="address">Delivery address <span>(demo)</span></label><textarea id="address" name="address" placeholder="No real address needed. Enter a demo address." autoComplete="off" rows={2} maxLength={300} required /></div>
    <div className="checkout-field-pair"><div className="field"><label htmlFor="phone">Phone <span>(optional)</span></label><input id="phone" name="phone" placeholder="Demo phone number" type="tel" autoComplete="off" maxLength={30} /></div><div className="field"><label htmlFor="card-note">Card message</label><input id="card-note" value={message} onChange={event => setMessage(event.target.value)} maxLength={product.card_note.max_chars} placeholder="Your optional card message" /></div></div>
    <label className="confirm-order"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /><span>I confirm this demo order on these terms. No payment will be taken.</span></label>
    {error ? <p className="notice checkout-error" role="alert">{error}</p> : null}
    <button className="button button-dark button-full checkout-submit" disabled={!confirmed || busy || !quote.eligible} type="submit">{busy ? <><Loader2 className="spin" size={19} />Creating your order</> : <>Create demo order <ArrowUpRight size={19} /></>}</button>
    <p className="checkout-disclaimer">Demo order. No payment is taken. Form details stay in this browser.</p>
  </form>;
}

export function CleanHandoffUrl() {
  useEffect(() => { const url = new URL(window.location.href); if (url.searchParams.has('h')) { url.searchParams.delete('h'); window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); } }, []);
  return null;
}
