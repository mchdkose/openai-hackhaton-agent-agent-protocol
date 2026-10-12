'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import type { PanelData, TenantId } from '@/lib/types';

const events: Record<string, string> = { ask: 'Question answered', quote: 'Quote prepared', checkout: 'Order link prepared', evidence: 'Sources opened', transcript: 'Conversation opened', handoff_view: 'Selection opened in shop', handoff_completed: 'Demo order confirmed', referee_demo: 'Synthetic referee check' };
const statuses: Record<string, string> = { yes: 'Exact match', no: 'Cannot meet request', partial: 'Alternative offered', needs_details: 'Clarification needed' };

function time(value: string) { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(value)); }

export function LiveActivity({ initial, tenant, full = false }: { initial: PanelData; tenant?: TenantId; full?: boolean }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refereeBusy, setRefereeBusy] = useState(false);
  const [referee, setReferee] = useState<{ claim: string; blocked: number; mode: string; fee: number } | null>(null);

  async function refresh() {
    setBusy(true); setError(null);
    try { const response = await fetch(`/api/panel${tenant ? `?tenant=${tenant}` : ''}`, { cache: 'no-store' }); if (!response.ok) throw new Error(); setData(await response.json()); }
    catch { setError('Could not refresh activity. Please try again.'); }
    finally { setBusy(false); }
  }

  async function checkReferee() {
    setRefereeBusy(true); setError(null);
    try { const response = await fetch('/api/referee-demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant: 'petal-atelier' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || 'Could not run the check.'); setReferee({ claim: result.claim, blocked: result.referee.dropped.length, mode: result.referee.mode, fee: result.correct_fact.value }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not run the check.'); }
    finally { setRefereeBusy(false); }
  }

  return <div className={`activity-surface ${full ? 'full-activity' : ''}`}>
    <div className="activity-heading"><h2>Live activity</h2><button className="button button-outline button-small" type="button" onClick={refresh} disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : full ? <RefreshCw size={15} /> : null}Refresh</button></div>
    {full ? <>
      <p className="activity-intro">The conversation leaves a trail. These are actual requests and handoffs from this demo.</p>
      <div className="metric-row">{[{ value: data.questions, label: 'Questions answered' }, { value: data.handoffs, label: 'Shop handoffs' }, { value: data.orders, label: 'Demo orders' }, { value: data.blockedClaims, label: 'Claims filtered' }].map(metric => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>
      <div className="activity-context"><span>Scenario clock: {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(data.scenarioClock))} · Istanbul</span><span>{data.modelCalls} model answers · {data.ruleCalls} catalog rule answers</span><span>{data.averageMs} ms average · {data.p95Ms} ms p95</span><span>{data.totalCostUsd === null ? 'Provider cost not reported' : `$${data.totalCostUsd.toFixed(5)} reported provider cost · ${data.callsWithReportedCost} calls`}</span></div>
    </> : null}
    {error ? <p className="notice" role="alert">{error}</p> : null}
    <div className="activity-table-wrap"><table className="activity-table"><thead><tr><th>Time</th><th>Shop</th><th>Event</th><th>Status</th>{full ? <th>Source / check</th> : null}</tr></thead><tbody>{data.recent.length ? data.recent.slice(0, full ? 30 : 6).map(log => <tr key={log.id} className={log.synthetic ? 'synthetic-row' : ''}><td>{time(log.ts)}</td><td><Link href={`/t/${log.tenant}`}>{data.tenants.find(shop => shop.id === log.tenant)?.name || log.tenant}</Link></td><td>{events[log.route] || log.route}{log.synthetic ? <span className="table-note">Deliberately injected claim</span> : null}</td><td>{log.referee?.verdict === 'filtered' ? 'Claim filtered' : log.status ? statuses[log.status] : log.route === 'handoff_completed' ? 'Confirmed · demo' : 'Recorded'}{log.ms ? <span className="table-note">{log.ms.toLocaleString()} ms</span> : null}</td>{full ? <td><span>{log.assistant.label === 'unknown' ? 'Unknown client' : log.assistant.label}</span><span className="table-note">{log.referee?.mode === 'model_and_rules' ? 'Second model + rules' : log.mode ? 'Catalog rules' : 'Site event'}</span></td> : null}</tr>) : <tr><td colSpan={full ? 5 : 4} className="activity-empty"><strong>No conversations yet.</strong><p>Start a request or open any shop link in ChatGPT.</p></td></tr>}</tbody></table></div>
    {!full ? <Link className="text-link small activity-more" href={tenant ? `/t/${tenant}/panel` : '/panel'}>Open the full activity view <ArrowUpRight size={14} /></Link> : <>
      <p className="activity-source-note">Assistant names are inferred from the request’s user agent and may be unknown or inaccurate. This public demo panel contains no questions, personal details, or session handles. {data.syntheticEvents} synthetic check{data.syntheticEvents === 1 ? '' : 's'} are explicitly labeled.</p>
      <section className="referee-demo"><div><ShieldCheck size={27} strokeWidth={1.5} /><h3>A second opinion.<br />Grounded in the catalog.</h3><p>Deliberately give the referee one false claim: “Petal Atelier offers free delivery to Kadikoy.” Watch it check the actual delivery fee.</p></div><div><button className="button button-dark" type="button" onClick={checkReferee} disabled={refereeBusy}>{refereeBusy ? <><Loader2 size={17} className="spin" />Checking the claim</> : <>Run synthetic check <ArrowUpRight size={17} /></>}</button>{referee ? <div className="referee-result" role="status"><strong>{referee.blocked ? 'False claim filtered.' : 'Check completed.'}</strong><p>“{referee.claim}”</p><p>The catalog says delivery costs {referee.fee} TRY.</p><span>{referee.mode === 'model_and_rules' ? 'Second model + catalog rules' : 'Catalog rules · model unavailable'} · synthetic demonstration</span></div> : <p className="small muted referee-demo-note">A synthetic test, clearly separated from customer traffic.</p>}</div></section>
    </>}
  </div>;
}
