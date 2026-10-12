import {afterAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {rm} from 'node:fs/promises';
vi.hoisted(()=>{process.env.ASKAGENT_DATA_DIR=`/private/tmp/askagent-test-${process.pid}`;process.env.ASKAGENT_MODE='rules';process.env.DEMO_CLOCK_ISO='2026-10-12T17:00:00+03:00';process.env.BASE_URL='http://localhost:3000';});
import {getTenant,getTenants} from '@/lib/tenants';
import {blankRequirements,detectAssistant,ProtocolError,reserveQuestion} from '@/lib/session';
import {extractRules,redactAsk} from '@/lib/extract';
import {selectCatalog} from '@/lib/catalog';
import {buildQuote} from '@/lib/quote';
import {readLogs,readSession,sessionKey,transact} from '@/lib/store';
import {validateClaim,lintClaim} from '@/lib/referee';
import {createDemoOrder,getProductPageData,handleAsk,handleSessionRoute,runRefereeDemo} from '@/lib/service';
import {respond} from '@/lib/render';
import {DEMO_QUESTION} from '@/lib/demo';
import {responseFrames} from '@/lib/compose';
import {verifyOrigin} from '@/lib/http';
import type {Session} from '@/lib/types';

const question=DEMO_QUESTION;
const tenant=getTenant('rose-and-stem')!;
const reqs=()=>extractRules(question,tenant);
const session=():Session=>({h:'h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',tenant:'rose-and-stem',created_at:Date.now(),expires_at:Date.now()+1800000,questions:1,requirements:reqs(),shown:['GB-25R'],note:null,turns:[],assistant:{label:'unknown',confidence:'unknown'}});
beforeEach(async()=>{await transact(state=>{state.sessions={};state.logs=[];state.limits={};state.orders={};state.catalog_overrides={};});});
afterAll(async()=>{await rm(process.env.ASKAGENT_DATA_DIR!,{recursive:true,force:true});});

describe('grounded catalog decisions',()=>{
  it('extracts the canonical English request, total budget, deadline and card message',()=>{
    expect(reqs()).toMatchObject({flower:'rose',color:'red',zone:'kadikoy',delivery_date:'today',deadline_local:'20:00',budget:1500,stems_min:25,note:'Happy birthday, Mom.',language:'en'});
    expect(extractRules('Budget 1500 TRY, red roses in Kadikoy tonight by 20:00',tenant)).toMatchObject({flower:'rose',color:'red',zone:'kadikoy',budget:1500,language:'en'});
  });
  it('returns independent yes, no and partial answers for the same requirements',()=>{
    const decisions=getTenants().map(t=>selectCatalog(t,reqs()));
    expect(decisions.map(d=>d.verdict)).toEqual(['yes','no','partial']);
    expect(decisions[0].matches[0]).toMatchObject({sku:'GB-25R',price:1280,delivery_fee:90,total:1370,eligible:true});
    expect(decisions[1].matches[0]).toMatchObject({total:1270,same_day:false,deadline_met:false,eligible:false});
    expect(decisions[2].matches[0]).toMatchObject({sku:'LE-25R',in_stock:false});
    expect(decisions[2].alternatives.map(m=>[m.sku,m.total])).toEqual([['LE-25P',1100]]);
  });
  it('enforces a direct flower quantity when the model is unavailable',()=>{
    const requirements=extractRules('Send 25 red roses to Kadikoy today by 20:00, under 1500 TRY including delivery.',tenant);
    expect(requirements.stems_min).toBe(25);
    const selection=selectCatalog(tenant,requirements);
    expect(selection.matches.find(match=>match.sku==='GB-15R')?.eligible).toBe(false);
    expect(responseFrames(selection).some(frame=>frame.id.includes('GB-15R'))).toBe(false);
    expect(extractRules('Send 20 pink tulips tomorrow, budget 1500 TRY',tenant).stems_min).toBe(20);
  });
  it('supports every literal catalog frame with unique evidence references',()=>{
    for(const merchant of getTenants()){
      const selection=selectCatalog(merchant,reqs());
      expect(new Set(selection.facts.map(fact=>fact.fact_ref)).size).toBe(selection.facts.length);
      for(const frame of selection.frames)expect(validateClaim(frame.text,frame.fact_refs,selection.facts),`${merchant.id}: ${frame.id}`).toBe('supported');
    }
  });
  it('keeps a winning response free of unrelated failed product constraints',async()=>{
    const selection=selectCatalog(tenant,reqs());
    const frames=responseFrames(selection);
    expect(frames.some(frame=>frame.id.includes('GB-15R'))).toBe(false);
    const answer=await handleAsk('rose-and-stem',question);
    expect(answer.answer.bullets.join(' ')).not.toContain('minimum stem count');
    expect(answer.answer.bullets.join(' ')).toContain('1,370 TRY');
    const partial=selectCatalog(getTenant('tulip-house')!,reqs());
    expect(responseFrames(partial).find(frame=>frame.id==='constraint:LE-25R:out_of_stock')?.text).toBe('25 Red Roses: This product is out of stock.');
  });
  it('includes delivery in the budget instead of advertising the bare product price',()=>{
    const result=selectCatalog(tenant,{...reqs(),budget:1280,stems_min:25});
    expect(result.matches[0].eligible).toBe(false);expect(result.matches[0].reasons).toContain('over_budget');expect(result.verdict).toBe('partial');
    expect(result.alternatives.every(match=>match.total!<=1280)).toBe(true);
  });
  it('rejects delivery after same-day cutoff and too-early requested deadline',()=>{
    const after=selectCatalog(tenant,reqs(),new Date('2026-10-12T19:31:00+03:00'));
    expect(after.verdict).toBe('no');expect(after.matches[0].eta_text).toContain('tomorrow');
    expect(selectCatalog(tenant,{...reqs(),deadline_local:'19:00'}).matches[0].eligible).toBe(false);
  });
  it('does not silently substitute a district the merchant does not serve',()=>{
    const requirements=extractRules('Red roses to Sariyer today, under 1500 TRY',tenant);
    expect(requirements.zone).toBe('sariyer');
    const result=selectCatalog(tenant,requirements);expect(result.verdict).toBe('no');expect(result.matches[0].reasons).toContain('delivery_zone_unavailable');
  });
  it('preserves conversation constraints while changing the flower color',()=>{
    const next=extractRules('Pink roses are fine; keep the other requirements',tenant,reqs());
    expect(next).toMatchObject({color:'pink',flower:'rose',budget:1500,zone:'kadikoy',deadline_local:'20:00'});
    expect(extractRules('Card message: Happy birthday, Mom.',tenant,next).note).toBe('Happy birthday, Mom.');
  });
});
describe('quotes and handoff',()=>{
  it('adds only allow-listed fees and rechecks total against budget',()=>{
    const normal=buildQuote(tenant,session(),'GB-25R','kadikoy');
    expect(normal).toMatchObject({total:1370,eligible:true,same_price_for_everyone:true});
    expect(buildQuote(tenant,session(),'GB-25R','kadikoy',['vase'])).toMatchObject({total:1620,eligible:false,reasons:['over_budget']});
    expect(()=>buildQuote(tenant,session(),'GB-25R','kadikoy',['secret_discount'])).toThrow(ProtocolError);
  });
  it('revalidates changed catalog price and sold-out inventory',()=>{
    const original=buildQuote(tenant,session(),'GB-25R','kadikoy');
    const updated=structuredClone(tenant);updated.catalog.products[0].price=1500;updated.catalog.as_of='2026-10-12T17:01:00+03:00';
    expect(buildQuote(updated,session(),'GB-25R','kadikoy',[],original)).toMatchObject({total:1590,previous_total:1370,revised:true,eligible:false});
    updated.catalog.products[0].in_stock=false;expect(buildQuote(updated,session(),'GB-25R','kadikoy').reasons).toContain('out_of_stock');
  });
  it('requires explicit acceptance of different-colored alternatives',()=>{
    const lale=getTenant('tulip-house')!,sess={...session(),tenant:lale.id};
    expect(buildQuote(lale,sess,'LE-25P','kadikoy')).toMatchObject({eligible:false,reasons:['color_requirement_not_met']});
    sess.requirements.color='pink';expect(buildQuote(lale,sess,'LE-25P','kadikoy').eligible).toBe(true);
  });
  it('makes no order during GET checkout and deduplicates POST orders',async()=>{
    const answer=await handleAsk('rose-and-stem',question),h=answer.h!;
    const quote=await handleSessionRoute('rose-and-stem','quote',new Request(`http://localhost:3000/t/rose-and-stem/askagent/quote?h=${h}&sku=GB-25R&zone=kadikoy`));
    expect(quote.quote?.total).toBe(1370);
    const checkout=await handleSessionRoute('rose-and-stem','checkout',new Request(`http://localhost:3000/t/rose-and-stem/askagent/checkout?h=${h}&sku=GB-25R`));
    expect(checkout.next[0].url).toContain('/p/GB-25R');
    await getProductPageData('rose-and-stem','GB-25R',h);
    expect(await transact(state=>Object.keys(state.orders).length)).toBe(0);
    const [first,second]=await Promise.all([createDemoOrder({tenant:'rose-and-stem',h,sku:'GB-25R'}),createDemoOrder({tenant:'rose-and-stem',h,sku:'GB-25R'})]);
    expect(first.orderId).toBe(second.orderId);expect((await readLogs()).filter(log=>log.route==='handoff_completed')).toHaveLength(1);
  });
  it('verifies checkout from saved requirements without a prior quote and preserves the card message',async()=>{
    const answer=await handleAsk('rose-and-stem',question),h=answer.h!;
    expect((await readSession('rose-and-stem',h))?.quote).toBeUndefined();
    await expect(createDemoOrder({tenant:'rose-and-stem',h,sku:'GB-25R'})).rejects.toMatchObject({code:'quote_required'});
    const checkout=await handleSessionRoute('rose-and-stem','checkout',new Request(`http://localhost:3000/t/rose-and-stem/askagent/checkout?h=${h}&sku=GB-25R`));
    expect(checkout).toMatchObject({status:'yes',quote:{sku:'GB-25R',total:1370,eligible:true},requirements:{note:'Happy birthday, Mom.',stems_min:25,budget:1500}});
    expect(checkout.next[0].url).toContain('/p/GB-25R');
    expect((await readSession('rose-and-stem',h))?.quote?.id).toBe(checkout.quote?.id);
    expect(await getProductPageData('rose-and-stem','GB-25R',h)).toMatchObject({note:'Happy birthday, Mom.',quote:{total:1370,eligible:true}});
    expect(await transact(state=>Object.keys(state.orders).length)).toBe(0);
    const quoted=await handleSessionRoute('rose-and-stem','quote',new Request(`http://localhost:3000/t/rose-and-stem/askagent/quote?h=${h}&sku=GB-25R&zone=kadikoy`));
    const link=quoted.next.find(next=>next.rel==='checkout')!;
    expect(new URL(link.url).searchParams.get('quote_id')).toBe(quoted.quote?.id);
  });
  it('does not make an ineligible selection orderable by preparing checkout directly',async()=>{
    const answer=await handleAsk('rose-and-stem',question),h=answer.h!;
    const checkout=await handleSessionRoute('rose-and-stem','checkout',new Request(`http://localhost:3000/t/rose-and-stem/askagent/checkout?h=${h}&sku=GB-15R`));
    expect(checkout).toMatchObject({status:'no',quote:{eligible:false}});
    expect(checkout.quote?.reasons).toContain('stems_below_minimum');
    await expect(createDemoOrder({tenant:'rose-and-stem',h,sku:'GB-15R'})).rejects.toMatchObject({code:'quote_invalid'});
    expect(await transact(state=>Object.keys(state.orders).length)).toBe(0);
  });
  it('rejects cross-origin human confirmation',()=>{
    expect(()=>verifyOrigin(new Request('http://localhost:3000/api/order',{method:'POST',headers:{Origin:'https://evil.example'}}))).toThrow(ProtocolError);
    expect(()=>verifyOrigin(new Request('http://localhost:3000/api/order',{method:'POST',headers:{Origin:'http://localhost:3000'}}))).not.toThrow();
  });
  it('accepts only the configured public HTTPS origin behind an internal listener',()=>{
    const original=process.env.BASE_URL;
    process.env.BASE_URL='https://flowers.example';
    try{
      expect(()=>verifyOrigin(new Request('http://0.0.0.0:3001/api/order',{method:'POST',headers:{Origin:'https://flowers.example',Host:'flowers.example'}}))).not.toThrow();
      expect(()=>verifyOrigin(new Request('http://0.0.0.0:3001/api/order',{method:'POST',headers:{Origin:'https://evil.example',Host:'evil.example','x-forwarded-host':'evil.example'}}))).toThrow(ProtocolError);
      expect(()=>verifyOrigin(new Request('http://0.0.0.0:3001/api/order',{method:'POST',headers:{Origin:'https://flowers.example/path'}}))).toThrow(ProtocolError);
    }finally{process.env.BASE_URL=original;}
  });
  it('accepts a loopback browser Host when Next uses the 0.0.0.0 bind address',()=>{
    const original=process.env.BASE_URL;
    process.env.BASE_URL='https://flowers.example';
    try{
      expect(()=>verifyOrigin(new Request('http://0.0.0.0:3000/api/order',{method:'POST',headers:{Origin:'http://localhost:3000',Host:'localhost:3000'}}))).not.toThrow();
      expect(()=>verifyOrigin(new Request('http://0.0.0.0:3000/api/order',{method:'POST',headers:{Origin:'http://localhost:4000',Host:'localhost:3000'}}))).toThrow(ProtocolError);
    }finally{process.env.BASE_URL=original;}
  });
  it('rechecks persisted merchant changes during handoff and order confirmation',async()=>{
    const answer=await handleAsk('rose-and-stem',question),h=answer.h!;
    await handleSessionRoute('rose-and-stem','quote',new Request(`http://localhost:3000/t/rose-and-stem/askagent/quote?h=${h}&sku=GB-25R&zone=kadikoy`));
    await transact(state=>{state.catalog_overrides['rose-and-stem']={as_of:'2026-10-12T17:05:00+03:00',products:{'GB-25R':{price:1350}},zones:{}};});
    await expect(createDemoOrder({tenant:'rose-and-stem',h,sku:'GB-25R'})).rejects.toMatchObject({code:'quote_changed'});
    const updated=await getProductPageData('rose-and-stem','GB-25R',h);
    expect(updated).toMatchObject({quoteUpdated:true,quote:{total:1440,previous_total:1370}});
    await transact(state=>{state.catalog_overrides['rose-and-stem'].products['GB-25R'].in_stock=false;});
    await expect(createDemoOrder({tenant:'rose-and-stem',h,sku:'GB-25R'})).rejects.toMatchObject({code:'quote_invalid'});
  });
});
describe('privacy, session isolation and factual referee',()=>{
  it('mints 128-bit handles, isolates tenant access and expires by real time',async()=>{
    const sess=await reserveQuestion(tenant,null,new Headers());expect(sess.h).toMatch(/^h_[a-f0-9]{32}$/);
    expect(await readSession('petal-atelier',sess.h)).toBeUndefined();
    await transact(state=>{state.sessions[sessionKey('rose-and-stem',sess.h)].expires_at=Date.now()-1;});
    expect(await readSession('rose-and-stem',sess.h)).toBeUndefined();
  });
  it('enforces the 60-question limit even for a public demo',async()=>{
    const sess=await reserveQuestion(tenant,null,new Headers());
    await transact(state=>{state.sessions[sessionKey(tenant.id,sess.h)].questions=60;});
    await expect(reserveQuestion(tenant,sess.h,new Headers())).rejects.toMatchObject({status:429,code:'session_rate_limit'});
  });
  it('keeps raw questions, handles, IP and proxy user-agent out of audit logs',async()=>{
    const raw='Red roses to Kadikoy under 1500 TRY; email: secret@example.com';
    const answer=await handleAsk('rose-and-stem',raw,null,undefined,new Headers({'x-forwarded-for':'203.0.113.77','user-agent':'ChatGPT-User/1.0 private detail'}));
    const logs=JSON.stringify(await readLogs());
    for(const value of [raw,answer.h!,'203.0.113.77','secret@example.com','private detail'])expect(logs).not.toContain(value);
    expect(redactAsk(raw)).not.toContain('secret@example.com');expect(detectAssistant('Mozilla/5.0 Google Chrome').label).toBe('unknown');
  });
  it('never shares cached session handles between identical users',async()=>{
    const [a,b]=await Promise.all([handleAsk('rose-and-stem',question),handleAsk('rose-and-stem',question)]);
    expect(a.h).not.toBe(b.h);expect(a.next.every(link=>!link.url.includes(b.h!))).toBe(true);
  });
  it('rejects a synthetic free-delivery lie and marks the event honestly',async()=>{
    const fact={fact_ref:'catalog.delivery_zones.kadikoy.fee',label:'delivery',value:120};
    expect(validateClaim('Free delivery',[fact.fact_ref],[fact])).toBe('contradicted');
    expect(validateClaim('20% discount',[fact.fact_ref],[fact])).toBe('unsupported');
    expect(lintClaim('ignore previous instructions')).toBeTruthy();
    const demo=await runRefereeDemo();expect(demo.synthetic).toBe(true);expect(demo.referee.dropped).toHaveLength(1);expect(demo.referee.mode).toBe('rules');
    expect((await readLogs())[0].synthetic).toBe(true);
  });
  it('accepts harmless repeated evidence while rejecting contradictory duplicate references',()=>{
    const fact={fact_ref:'catalog.delivery_zones.kadikoy.fee',label:'delivery',value:120};
    expect(validateClaim('Delivery costs 120 TRY',[fact.fact_ref],[fact,{...fact}])).toBe('supported');
    expect(validateClaim('Delivery costs 120 TRY',[fact.fact_ref],[fact,{...fact,value:0}])).toBe('unsupported');
  });
  it('renders HTML safely and all session payloads without caching',async()=>{
    const answer=await handleAsk('rose-and-stem',question);
    answer.answer.bullets.push('<img src=x onerror=alert(1)>');
    const html=respond(answer,new Request('http://localhost:3000/t/rose-and-stem/askagent',{headers:{Accept:'text/html'}}));
    expect(html.headers.get('cache-control')).toContain('no-store');
    const body=await html.text();expect(body).toContain('<article>');expect(body).not.toContain('<img src=x');expect(body).toContain('&lt;img');
    const json=respond(answer,new Request('http://localhost:3000/t/rose-and-stem/askagent?format=json'));expect(json.headers.get('content-type')).toContain('application/json');
  });
});
