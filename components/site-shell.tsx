import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function SiteHeader({ active }: { active?: 'demo' | 'activity' | 'protocol' }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="AskAgent home">AskAgent</Link>
      <nav aria-label="Main navigation">
        <Link href="/#demo" aria-current={active === 'demo' ? 'page' : undefined}>The demo</Link>
        <Link href="/panel" aria-current={active === 'activity' ? 'page' : undefined}>Live activity</Link>
        <Link href="/protocol" aria-current={active === 'protocol' ? 'page' : undefined}>Protocol</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="wordmark" href="/">AskAgent</Link>
      <p>A conversation is the new front door.</p>
      <Link className="text-link" href="/protocol">Read the protocol <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </footer>
  );
}

export function money(value: number, currency: string = 'TRY') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 0 }).format(value);
}
