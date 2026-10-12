import Link from 'next/link';
import { getPanelData } from '@/lib/service';
import { LiveActivity } from '@/components/live-activity';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const data = await getPanelData();
  return <><SiteHeader active="activity" /><main id="main" className="page-width panel-page"><div className="panel-shop-links"><Link className="selected" href="/panel">All shops</Link>{data.tenants.map(tenant => <Link key={tenant.id} href={`/t/${tenant.id}/panel`}>{tenant.name}</Link>)}</div><LiveActivity initial={data} full /></main><SiteFooter /></>;
}
