import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Check } from 'lucide-react';
import { getProductPageData } from '@/lib/service';
import { ChatGPTLaunch } from '@/components/chatgpt-launch';
import { money } from '@/components/site-shell';
import { ProductCheckout, CleanHandoffUrl } from '@/components/product-checkout';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params, searchParams }: { params: Promise<{ tenant: string; sku: string }>; searchParams: Promise<{ h?: string }> }) {
  const [{ tenant: id, sku }, { h }] = await Promise.all([params, searchParams]);
  const origin = process.env.BASE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const data = await getProductPageData(id, sku, h, origin);
  if (!data) notFound();
  const { tenant, product, quote, requirements, session, note, handoff, quoteUpdated } = data;
  const zone = tenant.catalog.delivery_zones.find(zone => zone.zone === quote?.zone);
  return <>
    <header className="site-header merchant-header"><Link className="wordmark" href={`/t/${tenant.id}`}>{tenant.name}</Link><Link className="text-link" href="/">Back to AskAgent <ArrowUpRight size={17} /></Link></header>
    <main id="main" className="page-width product-page" lang="en">
      <div className="product-main-photo"><img src={product.image} alt={product.name} fetchPriority="high" /></div>
      <div className="product-main-details">
        <h1>{product.name}</h1>
        <p className="product-location">{zone?.label || 'Istanbul'}</p>
        <p className="product-price">{money(quote?.total ?? product.price)}</p>
        <p className="product-description">{product.description} {quote ? quote.eta_text : null}</p>
        {h && !session ? <p className="notice expired-handoff" role="status">This conversation link has expired or is invalid. You are viewing the product catalog. Ask the shop agent again for a current delivery quote.</p> : null}
        {quote ? <>
          <dl className="price-breakdown"><div><dt>Product</dt><dd>{money(quote.product_price)}</dd></div>{quote.addon_total ? <div><dt>Add-ons</dt><dd>{money(quote.addon_total)}</dd></div> : null}<div><dt>Delivery</dt><dd>{quote.delivery_fee === 0 ? 'Free' : money(quote.delivery_fee)}</dd></div><div className="total-row"><dt>Total</dt><dd>{money(quote.total)}</dd></div></dl>
          {quoteUpdated ? <p className="notice">Your quote has changed. Previous total: {money(quote.previous_total || 0)}. Current total: {money(quote.total)}. Please review the new terms.</p> : null}
          {!quote.eligible ? <p className="notice" role="alert">This quote cannot be ordered on the current terms. Ask your assistant to find an eligible option.</p> : session ? <ProductCheckout tenant={tenant.id} product={product} h={session.h} quote={quote} note={note} /> : null}
        </> : <div className="product-standard"><p className={`availability ${product.in_stock ? '' : 'out-of-stock'}`}>{product.in_stock ? `${product.stock_qty} bouquets in stock` : 'Currently unavailable'}</p><p>Share your delivery area and timing with your assistant. Our shop agent will check the current total and prepare your order.</p><ChatGPTLaunch siteOrigin={origin} tenant={tenant.id} label="Ask this florist" ask={`Get a delivery-inclusive quote for ${product.name}. Check stock, delivery areas, and the total price.`} /><Link className="text-link" href={`/t/${tenant.id}#demo`}>Try the shop agent here <ArrowUpRight size={16} /></Link></div>}
        <details className="product-care"><summary>About the flowers and delivery</summary><p>{tenant.catalog.returns}</p><p>The same published price applies to everyone. Demo catalog updated: {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: tenant.timezone }).format(new Date(tenant.catalog.as_of))}.</p></details>
      </div>
      {handoff && requirements ? <section className="selection-reasons"><h2>Your conversation became your selection.</h2><p>The requirements your assistant shared came with this order.</p><ul>{requirements.stems_min ? <li><Check size={16} />At least {requirements.stems_min} stems</li> : null}{requirements.budget ? <li><Check size={16} />{money(requirements.budget)} total budget</li> : null}{requirements.zone ? <li><Check size={16} />Delivery to {zone?.label || requirements.zone}</li> : null}{requirements.deadline_local ? <li><Check size={16} />Requested delivery by {requirements.deadline_local}</li> : null}{note ? <li><Check size={16} />Your card message came with the selection</li> : null}</ul><p className="small muted">The conversation handle was removed from the address bar. Your session is valid for 30 minutes. No real payment or delivery takes place.</p></section> : null}
      <CleanHandoffUrl />
    </main>
  </>;
}
