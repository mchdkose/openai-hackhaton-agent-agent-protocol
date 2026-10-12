import {createHash,randomBytes} from 'node:crypto';
import {DEMO_CLOCK_ISO} from './clock';
import {DEMO_QUESTION} from './demo';
import {applyCatalogOverride,getCurrentTenant,getTenant,getTenants} from './tenants';
import {selectCatalog,money,explainReason} from './catalog';
import {extractRequirements,requirementsSummary} from './extract';
import {compose} from './compose';
import {baseURL,endpoint,nextLinks} from './links';
import {buildQuote} from './quote';
import {detectAssistant,guardRead,ProtocolError,reserveQuestion} from './session';
import {privacyHash,readLogs,readSession,recordLog,sessionKey,storageMode,transact,writeSession} from './store';
import {judgeFrames} from './referee';
import {currentModelUsage,withModelUsage} from './models';
import type {AskEnvelope,PanelData,Requirements,Session,Tenant} from './types';

function requireTenant(id:string):Tenant {const tenant=getTenant(id);if(!tenant)throw new ProtocolError('unknown_tenant','Shop not found.',404);return tenant;}
async function requireCurrentTenant(id:string):Promise<Tenant>{const tenant=await getCurrentTenant(id);if(!tenant)throw new ProtocolError('unknown_tenant','Shop not found.',404);return tenant;}
function envelope(tenant:Tenant,kind:AskEnvelope['kind'],session?:Session):AskEnvelope {
  return {protocol:'askagent',version:'0.1',kind,tenant:{id:tenant.id,name:tenant.name},scenario:{demo:true,clock:DEMO_CLOCK_ISO,timezone:tenant.timezone,catalog_as_of:tenant.catalog.as_of},...(session?{h:session.h,session:{h:session.h,expires_at:new Date(session.expires_at).toISOString()}}:{}),answer:{title:tenant.name,bullets:[],question:null},next:[]};
}
export function errorEnvelope(tenantId:string,code:string,message:string,origin?:string):AskEnvelope {
  const tenant=getTenant(tenantId)||getTenants()[0];
  return {...envelope(tenant,'error'),answer:{title:message,bullets:[],question:null},error:{code,message},next:nextLinks(tenant,undefined,origin)};
}
export function discovery(tenantId:string,origin?:string):AskEnvelope {
  const tenant=requireTenant(tenantId),body=envelope(tenant,'discovery');
  body.answer={title:`${tenant.name} — AskAgent`,bullets:[`${tenant.name} answers from its own catalog, delivery districts and published prices.`, 'This HTTP endpoint supports questions, continuing conversations, catalog evidence, quotes and human-confirmed demo order handoffs.','No MCP installation or client-specific tool registration is required.','Do not send personal information. A conversation link is an access token and expires after 30 minutes.','The demo scenario clock is fixed. Orders are demonstrations and no payment is taken.',`Example question link: ${endpoint(tenant,'',{ask:DEMO_QUESTION},origin)}`],question:null};
  body.capabilities=['catalog.answer','conversation.continue','conversation.transcript','catalog.evidence','offer.quote','checkout.handoff'];
  body.next=nextLinks(tenant,undefined,origin);
  return body;
}
export async function handleAsk(tenantId:string,ask:string,h?:string|null,origin?:string,headers=new Headers()):Promise<AskEnvelope> {
  return withModelUsage(()=>askWithUsage(tenantId,ask,h,origin,headers));
}
async function askWithUsage(tenantId:string,ask:string,h:string|null|undefined,origin:string|undefined,headers:Headers):Promise<AskEnvelope> {
  const started=performance.now(),tenant=await requireCurrentTenant(tenantId);
  if(!ask.trim())return discovery(tenantId,origin);
  if(ask.length>500)throw new ProtocolError('query_too_long','Your question must be no longer than 500 characters.');
  const session=await reserveQuestion(tenant,h||null,headers);
  const extraction=await extractRequirements(ask,tenant,session.requirements);
  session.requirements=extraction.requirements;session.note=extraction.requirements.note;
  const selection=selectCatalog(tenant,session.requirements);
  const composed=await compose(tenant,selection,session.requirements,extraction.mode);
  const label={yes:'Yes — exact match',no:'Cannot meet these requirements',partial:'An alternative is available',needs_details:'One detail is missing'}[selection.verdict];
  const title=`${tenant.name} — ${label}`;
  const body:AskEnvelope={...envelope(tenant,'answer',session),status:selection.verdict,answer:{title,bullets:composed.bullets,question:selection.question},requirements:session.requirements,matches:selection.matches,alternatives:selection.alternatives,facts:selection.facts,mode:composed.mode,referee:composed.referee,next:[]};
  session.shown=[...selection.matches.filter(item=>item.eligible),...selection.alternatives,...selection.matches].map(item=>item.sku).filter((sku,index,all)=>all.indexOf(sku)===index);
  session.turns.push({at:new Date().toISOString(),summary:requirementsSummary(session.requirements),answer:[title,...body.answer.bullets].join('\n'),answer_hash:createHash('sha256').update(JSON.stringify(body.answer)).digest('hex')});
  session.turns=session.turns.slice(-60);
  if(session.quote){session.quote=buildQuote(tenant,session,session.quote.sku,session.quote.zone,session.quote.addons,session.quote);body.quote=session.quote;}
  await writeSession(session);
  body.next=nextLinks(tenant,session,origin);composed.mode.usage=currentModelUsage();
  await recordLog({tenant:tenant.id,route:'ask',session_hash:privacyHash(session.h),assistant:session.assistant,skus:session.shown,status:selection.verdict,referee:composed.referee,mode:composed.mode,ms:Math.round(performance.now()-started)});
  return body;
}
async function requireSession(tenant:Tenant,h:string|null):Promise<Session>{const session=await readSession(tenant.id,h);if(!session)throw new ProtocolError('session_expired','The conversation was not found or has expired. Start again with a new question link.',410);return session;}
export async function handleSessionRoute(tenantId:string,route:'transcript'|'evidence'|'quote'|'checkout',request:Request):Promise<AskEnvelope> {
  const started=performance.now(),tenant=await requireCurrentTenant(tenantId),url=new URL(request.url),origin=url.origin;
  await guardRead(request.headers);
  const session=await requireSession(tenant,url.searchParams.get('h'));
  const sku=url.searchParams.get('sku')||session.quote?.sku||session.shown[0];
  const body=envelope(tenant,route,session);body.requirements=session.requirements;body.next=nextLinks(tenant,session,origin,sku);
  if(route==='transcript'){
    if(session.quote){session.quote=buildQuote(tenant,session,session.quote.sku,session.quote.zone,session.quote.addons,session.quote);await writeSession(session);body.quote=session.quote;}
    body.transcript=session.turns;
    body.answer={title:`${tenant.name} — conversation handoff`,bullets:[...session.turns.map((turn,index)=>`${index+1}. ${turn.summary}\n${turn.answer}`),...(session.note?[`Card message: ${session.note}`]:[]),...(session.quote?[`Current quote: ${money(session.quote.total)} · ${session.quote.eta_text}${session.quote.revised?' · Quote updated.':''}`]:[])],question:null};
  }else{
    if(!sku||!tenant.catalog.products.some(p=>p.sku===sku))throw new ProtocolError('unknown_product','This product is not in the catalog.',404);
    if(route==='evidence'){
      const selection=selectCatalog(tenant,{...session.requirements,flower:null,color:null});
      const facts=selection.facts.filter(f=>f.fact_ref.includes(`.${sku}.`)||f.fact_ref.startsWith('catalog.delivery_zones.'));
      body.facts=facts;body.answer={title:`${tenant.name} — ${sku} catalog evidence`,bullets:facts.map(f=>`${f.fact_ref}: ${f.value}`),question:null};
    }else if(route==='quote'){
      const zone=url.searchParams.get('zone')||session.requirements.zone;
      if(!zone)throw new ProtocolError('zone_required','Which delivery district?');
      const addons=(url.searchParams.get('addons')||'').split(',').filter(Boolean);
      session.quote=buildQuote(tenant,session,sku,zone,addons,session.quote);await writeSession(session);body.quote=session.quote;
      body.status=session.quote.eligible?'yes':'no';
      body.answer={title:`${tenant.name} — ${session.quote.eligible?'verified quote':'requirements not met'}`,bullets:[`Product ${money(session.quote.product_price)} + delivery ${money(session.quote.delivery_fee)} + add-ons ${money(session.quote.addon_total)} = ${money(session.quote.total)}.`,session.quote.eta_text,'Everyone receives the same published price.',...session.quote.reasons.map(reason=>explainReason(reason,session.requirements.language))],question:null};
    }else{
      if(!session.quote||session.quote.sku!==sku){body.answer={title:`${tenant.name} — request a quote first`,bullets:['Open the quote link to verify current price and delivery before transferring your selection to the shop.'],question:null};}
      else{
        session.quote=buildQuote(tenant,session,sku,session.quote.zone,session.quote.addons,session.quote);await writeSession(session);body.quote=session.quote;
        const handoff=new URL(`/t/${tenant.id}/p/${sku}`,baseURL(origin));handoff.searchParams.set('h',session.h);
        body.answer={title:`${tenant.name} — your selection is ready in the shop`,bullets:[`${money(session.quote.total)} · ${session.quote.eta_text}`,...(session.quote.eligible?[]:session.quote.reasons.map(reason=>explainReason(reason,session.requirements.language))),'Only a human-confirmed POST creates a demo order. A GET request never creates an order.'],question:null};
        body.next=[{rel:'checkout',label:'Product page and demo order confirmation',url:handoff.toString(),method:'GET'},...body.next.filter(link=>link.rel!=='checkout')];
      }
    }
  }
  await recordLog({tenant:tenant.id,route,session_hash:privacyHash(session.h),assistant:detectAssistant(request.headers.get('user-agent')),skus:sku?[sku]:[],ms:Math.round(performance.now()-started)});
  return body;
}
export type ProductPageData={tenant:Tenant;product:Tenant['catalog']['products'][number];session?:{h:string;expires_at:string};quote?:Session['quote'];quoteUpdated:boolean;requirements?:Requirements;note?:string|null;handoff:boolean};
export async function getProductPageData(tenantId:string,sku:string,h?:string|null,origin?:string):Promise<ProductPageData|undefined> {
  const tenant=await getCurrentTenant(tenantId),product=tenant?.catalog.products.find(p=>p.sku===sku);if(!tenant||!product)return undefined;
  const session=await readSession(tenantId,h);
  const data:ProductPageData={tenant,product,quoteUpdated:false,handoff:!!session};
  if(!session)return data;
  data.session={h:session.h,expires_at:new Date(session.expires_at).toISOString()};data.requirements=session.requirements;data.note=session.note;
  if(session.quote?.sku===sku){session.quote=buildQuote(tenant,session,sku,session.quote.zone,session.quote.addons,session.quote);data.quote=session.quote;data.quoteUpdated=!!session.quote.revised;await writeSession(session);}
  await recordLog({tenant:tenant.id,route:'handoff_view',session_hash:privacyHash(session.h),assistant:{label:'unknown',confidence:'unknown'},skus:[sku],ms:0});
  void origin;
  return data;
}
export async function createDemoOrder(input:{tenant:string;h:string;sku:string}):Promise<{ok:true;orderId:string;total:number;currency:'TRY';demo:true}> {
  const original=requireTenant(input.tenant);
  return transact(state=>{
    const tenant=applyCatalogOverride(structuredClone(original),state.catalog_overrides[input.tenant]);
    const session=state.sessions[sessionKey(tenant.id,input.h)];
    if(!session||session.expires_at<=Date.now())throw new ProtocolError('session_expired','The conversation has expired. Request a new quote.',410);
    if(!session.quote||session.quote.sku!==input.sku)throw new ProtocolError('quote_required','Request a quote for this product first.');
    const quote=buildQuote(tenant,session,input.sku,session.quote.zone,session.quote.addons,session.quote);
    if(!quote.eligible)throw new ProtocolError('quote_invalid',`The demo order could not be created: ${quote.reasons.map(reason=>explainReason(reason)).join(' ')}`,409);
    if(quote.id!==session.quote.id)throw new ProtocolError('quote_changed','The quote has changed. Review the current price on the shop page and confirm again.',409);
    const key=sessionKey(tenant.id,input.h),previous=state.orders[key];
    if(previous)return {ok:true,orderId:previous.id,total:previous.total,currency:'TRY',demo:true};
    const orderId=`DEMO-${randomBytes(4).toString('hex').toUpperCase()}`;
    state.orders[key]={id:orderId,total:quote.total,created_at:Date.now()};
    state.logs.push({id:randomBytes(8).toString('hex'),ts:new Date().toISOString(),tenant:tenant.id,route:'handoff_completed',session_hash:privacyHash(session.h),assistant:{label:'unknown',confidence:'unknown'},skus:[input.sku],ms:0});
    return {ok:true,orderId,total:quote.total,currency:'TRY',demo:true};
  });
}
export async function getPanelData(tenantId?:string):Promise<PanelData> {
  const logs=(await readLogs()).filter(log=>!tenantId||log.tenant===tenantId),durations=logs.map(log=>log.ms).sort((a,b)=>a-b);
  const count=(route:string)=>logs.filter(log=>log.route===route).length;
  const names=['chatgpt','claude','gemini','perplexity','unknown'];
  const costs=logs.map(log=>(log.usage||log.mode?.usage)?.cost_usd).filter((cost):cost is number=>typeof cost==='number');
  return {totalCalls:logs.length,questions:count('ask'),handoffs:count('handoff_view'),orders:count('handoff_completed'),quotes:count('quote'),blockedClaims:logs.reduce((sum,log)=>sum+(log.referee?.dropped.length||0),0),averageMs:durations.length?Math.round(durations.reduce((sum,value)=>sum+value,0)/durations.length):0,p95Ms:durations.length?durations[Math.min(durations.length-1,Math.ceil(durations.length*.95)-1)]:0,modelCalls:logs.filter(log=>log.mode?.composition==='model').length,ruleCalls:logs.filter(log=>log.mode?.composition==='template').length,totalCostUsd:costs.length?costs.reduce((sum,cost)=>sum+cost,0):null,callsWithReportedCost:costs.length,tenants:getTenants().map(tenant=>({id:tenant.id,name:tenant.name,calls:logs.filter(log=>log.tenant===tenant.id).length,questions:logs.filter(log=>log.tenant===tenant.id&&log.route==='ask').length,handoffs:logs.filter(log=>log.tenant===tenant.id&&log.route==='handoff_view').length,orders:logs.filter(log=>log.tenant===tenant.id&&log.route==='handoff_completed').length})),assistants:names.map(label=>({label,calls:logs.filter(log=>log.assistant.label===label).length,confidence:label==='unknown'?'unknown':'proxy_user_agent'})),recent:logs.slice(-30).reverse(),refereeEvents:logs.filter(log=>log.referee?.dropped.length).slice(-10).reverse(),storage:storageMode(),scenarioClock:DEMO_CLOCK_ISO,syntheticEvents:logs.filter(log=>log.synthetic).length};
}
export async function runRefereeDemo(tenantId='petal-atelier') {
  return withModelUsage(()=>refereeDemoWithUsage(tenantId));
}
async function refereeDemoWithUsage(tenantId:string) {
  const tenant=requireTenant(tenantId),zone=tenant.catalog.delivery_zones.find(z=>z.zone==='kadikoy')!;
  const claim='We offer free delivery to Kadikoy.';
  const fact={fact_ref:'catalog.delivery_zones.kadikoy.fee',label:'Delivery fee (TRY)',value:zone.fee};
  const referee=await judgeFrames([{id:'synthetic:free_delivery',text:claim,fact_refs:[fact.fact_ref]}],[fact]);referee.synthetic=true;
  await recordLog({tenant:tenant.id,route:'referee_demo',assistant:{label:'unknown',confidence:'unknown'},skus:[],ms:0,referee,synthetic:true,usage:currentModelUsage()});
  return {synthetic:true,claim,referee,correct_fact:fact,label:'Deliberately injected false claim — synthetic referee demonstration'};
}
