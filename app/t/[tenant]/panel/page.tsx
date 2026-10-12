import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenant } from '@/lib/tenants';
import { getPanelData } from '@/lib/service';
import { LiveActivity } from '@/components/live-activity';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

export const dynamic = 'force-dynamic';

export default async function MerchantPanelPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: id } = await params;
  const tenant = getTenant(id); if (!tenant) notFound();
  const data = await getPanelData(id);
  return <><SiteHeader active="activity" /><main id="main" className="page-width panel-page"><div className="panel-shop-links"><Link href="/panel">All shops</Link>{data.tenants.map(shop => <Link className={shop.id === id ? 'selected' : ''} key={shop.id} href={`/t/${shop.id}/panel`}>{shop.name}</Link>)}</div><LiveActivity initial={data} tenant={tenant.id} full /></main><SiteFooter /></>;
}
