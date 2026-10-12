import {createHash} from 'node:crypto';
import {evaluateProduct} from './catalog';
import {ProtocolError} from './session';
import type {Quote,Session,Tenant} from './types';
export function buildQuote(tenant:Tenant,session:Session,sku:string,zoneId:string,addons:string[]=[],previous?:Quote):Quote {
  const product=tenant.catalog.products.find(p=>p.sku===sku),zone=tenant.catalog.delivery_zones.find(z=>z.zone===zoneId);
  if(!product)throw new ProtocolError('unknown_product','This product is not in the catalog.',404);
  if(!zone)throw new ProtocolError('unknown_zone','We do not deliver to this district.');
  const unique=[...new Set(addons)];
  if(unique.some(id=>!tenant.policy.menu.some(item=>item.id===id)))throw new ProtocolError('unknown_addon','This add-on is not in the published menu.');
  const fees=unique.map(id=>tenant.policy.menu.find(item=>item.id===id)!.fee);
  const addonTotal=fees.reduce((sum,fee)=>sum+fee,0);
  const total=product.price+zone.fee+addonTotal;
  const evaluation=evaluateProduct(tenant,product,{...session.requirements,zone:zoneId});
  const reasons=[...evaluation.reasons];
  if(session.requirements.flower&&session.requirements.flower!==product.flower)reasons.push('flower_requirement_not_met');
  if(session.requirements.color&&session.requirements.color!==product.color)reasons.push('color_requirement_not_met');
  if(session.requirements.budget!==null&&total>session.requirements.budget&&!reasons.includes('over_budget'))reasons.push('over_budget');
  const content={tenant:tenant.id,sku,zone:zoneId,addons:unique,total,catalog:tenant.catalog.as_of,requirements:{...session.requirements,note:null}};
  const id=`q_${createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0,24)}`;
  const same=previous?.id===id;
  const now=Date.now();
  const quote:Quote={id,sku,zone:zoneId,addons:unique,product_price:product.price,delivery_fee:zone.fee,addon_total:addonTotal,total,currency:tenant.currency,eta_text:evaluation.eta_text,issued_at:same?previous.issued_at:new Date(now).toISOString(),expires_at:same?previous.expires_at:new Date(Math.min(session.expires_at,now+tenant.policy.quote_ttl_minutes*60000)).toISOString(),catalog_as_of:tenant.catalog.as_of,same_price_for_everyone:true,eligible:reasons.length===0,reasons};
  if(previous&&(previous.total!==quote.total||previous.catalog_as_of!==quote.catalog_as_of||previous.eta_text!==quote.eta_text)){quote.revised=true;quote.previous_total=previous.total;}
  if(new Date(quote.expires_at).getTime()<=now){quote.eligible=false;quote.reasons.push('quote_expired');}
  return quote;
}
