import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getCurrentTenant } from '@/lib/tenants';
import { ChatGPTLaunch } from '@/components/chatgpt-launch';
import { SiteHeader, SiteFooter, money } from '@/components/site-shell';
import { Playground } from '@/components/playground';
import { AgentEntry } from '@/components/agent-entry';

const shopCopy: Record<string, { heading: string; body: string }> = {
  'rose-and-stem': { heading: 'Some things deserve\nto arrive today.', body: 'Fresh flowers, thoughtfully arranged. From Kadikoy to the people you love.' },
  'petal-atelier': { heading: 'A little care.\nA beautiful gesture.', body: 'Flowers from Moda. Every bouquet has its moment. Every flower tells a story.' },
  'tulip-house': { heading: 'A different flower.\nThe same feeling.', body: 'When your first choice is unavailable, let us find another beautiful way to say it.' },
};

export const dynamic = 'force-dynamic';

export default async function ShopPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: id } = await params;
  const tenant = await getCurrentTenant(id);
  if (!tenant) notFound();
  const copy = shopCopy[tenant.id];
  const origin = process.env.BASE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const featured = tenant.catalog.products.find(product => product.in_stock) || tenant.catalog.products[0];
  return <>
    <SiteHeader />
    <main id="main" className="page-width">
      <div className="breadcrumb"><Link href="/">The florists</Link><span>/</span><span>{tenant.name}</span></div>
      <section className="merchant-hero">
        <div><p className="merchant-name">{tenant.name}</p><h1>{copy.heading.split('\n').map((line, i) => <span key={line}>{line}{i === 0 ? <br /> : null}</span>)}</h1><p className="merchant-description">{copy.body}</p><div className="hero-actions"><ChatGPTLaunch siteOrigin={origin} tenant={tenant.id} label="Ask this florist" /><a className="text-link" href="#bouquets">Browse bouquets <ArrowRight size={17} /></a></div></div>
        <div className="merchant-hero-photo"><img src={featured.image} alt={featured.name} fetchPriority="high" /></div>
      </section>
      <section className="merchant-benefits"><p><strong>From our own catalog.</strong> Stock and delivery checked before a recommendation.</p><p><strong>One price, for everyone.</strong> Your assistant sees the same published prices.</p><p><strong>You choose the final order.</strong> A conversation prepares it. You confirm it.</p></section>
      <section className="merchant-catalog" id="bouquets">
        <div className="section-topline"><h2>Made to make their day.</h2><span className="small muted">Demo catalog · TRY</span></div>
        <div className="product-grid">{tenant.catalog.products.map(product => <article className="catalog-product" key={product.sku}><Link className="catalog-image" href={`/t/${tenant.id}/p/${product.sku}`}><img src={product.image} alt={product.name} loading="lazy" />{!product.in_stock ? <span className="stock-label">Currently unavailable</span> : null}</Link><div className="catalog-product-line"><h3><Link href={`/t/${tenant.id}/p/${product.sku}`}>{product.name}</Link></h3><span>{money(product.price)}</span></div><p>{product.description}</p><Link className="text-link" href={`/t/${tenant.id}/p/${product.sku}`}>View bouquet <ArrowUpRight size={16} /></Link></article>)}</div>
      </section>
      <section className="merchant-delivery"><div><h2>Beautiful flowers.<br />Clear expectations.</h2><p>{tenant.catalog.returns}</p></div><div className="delivery-list">{tenant.catalog.delivery_zones.map(zone => <div key={zone.zone}><strong>{zone.label}</strong><p>{zone.eta_text}</p><span>{zone.fee === 0 ? 'Free delivery' : `${money(zone.fee)} delivery`}</span></div>)}</div></section>
      <section className="demo-section" id="demo"><Playground tenants={[{ id: tenant.id, name: tenant.name, role: tenant.role }]} selectedTenant={tenant.id} siteOrigin={origin} /></section>
      <AgentEntry tenant={tenant.id} name={tenant.name} />
    </main>
    <SiteFooter />
  </>;
}
