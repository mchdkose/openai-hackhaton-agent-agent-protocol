import {localMinutes,scenarioNow,timeMinutes} from './clock';
import type {DeliveryZone,Fact,Match,Product,Requirements,Selection,Tenant} from './types';

export const money = (value:number):string => `${new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(value)} TRY`;
export function deliveryAvailability(tenant:Tenant,zone:DeliveryZone,requirements:Requirements,now=scenarioNow()):{same_day:boolean;deadline_met:boolean;eta_text:string;reasons:string[]} {
  const sameDay=zone.same_day && !!zone.cutoff_local && localMinutes(now,tenant.timezone)<timeMinutes(zone.cutoff_local);
  const tomorrow=requirements.delivery_date==='tomorrow';
  const eta=tomorrow||!sameDay?`tomorrow from ${zone.next_day_from}`:`today by ${zone.cutoff_local}`;
  const deadlineMet=tomorrow ? !requirements.deadline_local || timeMinutes(zone.next_day_from)<=timeMinutes(requirements.deadline_local) : (requirements.delivery_date==='today'||!!requirements.deadline_local) ? sameDay && (!requirements.deadline_local || timeMinutes(zone.cutoff_local!)<=timeMinutes(requirements.deadline_local)) : true;
  const reasons:string[]=[];
  if(!deadlineMet)reasons.push(!sameDay&&!tomorrow?'today_delivery_unavailable':'deadline_not_met');
  return {same_day:sameDay&&!tomorrow,deadline_met:deadlineMet,eta_text:eta,reasons};
}
export function evaluateProduct(tenant:Tenant,product:Product,requirements:Requirements,kind:Match['kind']='exact',now=scenarioNow()):Match {
  const zone=tenant.catalog.delivery_zones.find(z=>z.zone===requirements.zone);
  const delivery=zone?deliveryAvailability(tenant,zone,requirements,now):{same_day:false,deadline_met:false,eta_text:'Delivery district not selected',reasons:[requirements.zone?'delivery_zone_unavailable':'delivery_zone_required']};
  const total=zone?product.price+zone.fee:null;
  const reasons=[...delivery.reasons];
  if(!product.in_stock||product.stock_qty<=0)reasons.push('out_of_stock');
  if(requirements.budget!==null&&total!==null&&total>requirements.budget)reasons.push('over_budget');
  if(requirements.stems_min!==null&&product.stems<requirements.stems_min)reasons.push('stems_below_minimum');
  return {sku:product.sku,name:product.name,image:product.image,price:product.price,currency:tenant.currency,in_stock:product.in_stock&&product.stock_qty>0,zone:zone?.zone||null,delivery_fee:zone?.fee??null,total,same_day:delivery.same_day,deadline_met:delivery.deadline_met,eta_text:delivery.eta_text,kind,eligible:reasons.length===0,reasons};
}
const reasonText: Record<string,string> = {
  out_of_stock: 'This product is out of stock.',
  over_budget: 'The product and delivery total exceed your budget.',
  today_delivery_unavailable: 'Same-day delivery to this district is unavailable.',
  deadline_not_met: 'The requested delivery deadline cannot be met.',
  delivery_zone_unavailable: 'We do not deliver to this district.',
  delivery_zone_required: 'A delivery district is required.',
  stems_below_minimum: 'This product does not meet the minimum stem count.',
  flower_requirement_not_met: 'Confirm the different flower before ordering this alternative.',
  color_requirement_not_met: 'Confirm the different color before ordering this alternative.',
  quote_expired: 'This quote expired. Request a new quote.',
};
export const explainReason = (reason:string, _language?: 'en'):string => reasonText[reason] || reason;
export function selectCatalog(tenant:Tenant,requirements:Requirements,now=scenarioNow()):Selection {
  const products=tenant.catalog.products;
  const exact=products.filter(product=>(!requirements.flower||product.flower===requirements.flower)&&(!requirements.color||product.color===requirements.color));
  const matches=exact.map(product=>evaluateProduct(tenant,product,requirements,'exact',now));
  const substituteIds=new Set(exact.flatMap(p=>p.substitutes));
  const alternatives=products.filter(p=>!exact.some(e=>e.sku===p.sku)&&(substituteIds.has(p.sku)||!!requirements.flower||!!requirements.color)).map(p=>evaluateProduct(tenant,p,requirements,'alternative',now)).filter(p=>p.eligible);
  const eligible=matches.filter(p=>p.eligible);
  const verdict=!requirements.zone?'needs_details':eligible.length?'yes':alternatives.length?'partial':'no';
  const reasons=[...new Set(matches.flatMap(m=>m.reasons))];
  const facts:Fact[]=[];
  const frames:Selection['frames']=[];
  const factIndex=new Map<string,Fact>();
  const add=(fact_ref:string,label:string,value:Fact['value'])=>{
    const existing=factIndex.get(fact_ref);
    if(existing){if(existing.value!==value)throw new Error(`Conflicting catalog fact: ${fact_ref}`);return fact_ref;}
    const fact={fact_ref,label,value};factIndex.set(fact_ref,fact);facts.push(fact);return fact_ref;
  };
  const zone=tenant.catalog.delivery_zones.find(z=>z.zone===requirements.zone);
  for(const match of [...matches,...alternatives]){
    const product=products.find(p=>p.sku===match.sku)!;
    const prefix=`catalog.products.${product.sku}`;
    const refs=[add(`${prefix}.name`,'Product',product.name),add(`${prefix}.price`,'Product price (TRY)',product.price),add(`${prefix}.in_stock`,'In stock',match.in_stock),add(`${prefix}.stems`,'Stem count',product.stems),add(`computed.${product.sku}.match_kind`,'Match classification',match.kind)];
    const stock=match.in_stock?'in stock':'out of stock';
    frames.push({id:`product:${product.sku}`,text:`${product.name} — ${money(product.price)} · ${stock}${match.kind==='alternative'?' · alternative':''}.`,fact_refs:refs});
    if(zone){
      const zoneRefs=[add(`catalog.delivery_zones.${zone.zone}.label`,'District',zone.label),add(`catalog.delivery_zones.${zone.zone}.fee`,'Delivery fee (TRY)',zone.fee),add(`computed.${product.sku}.${zone.zone}.total`,'Product + delivery (TRY)',match.total!),add(`computed.${product.sku}.${zone.zone}.eta_text`,'Delivery window',match.eta_text),add(`computed.${product.sku}.${zone.zone}.deadline_met`,'Deadline met',match.deadline_met)];
      frames.push({id:`delivery:${product.sku}`,text:`${zone.label}: ${match.eta_text}. Delivery ${money(zone.fee)}; total ${money(match.total!)}.`,fact_refs:zoneRefs});
    }
    for(const reason of match.reasons){const text=`${product.name}: ${explainReason(reason,requirements.language)}`;const ref=add(`computed.${product.sku}.${reason}`,'Evaluated product constraint',text);frames.push({id:`constraint:${product.sku}:${reason}`,text,fact_refs:[`${prefix}.name`,ref]});}
  }
  const primary=eligible[0]||alternatives[0]||matches[0];
  if(primary){const product=products.find(p=>p.sku===primary.sku)!;if(product.card_note.available){const ref=add(`catalog.products.${product.sku}.card_note.fee`,'Card note fee (TRY)',product.card_note.fee);frames.push({id:'card_note',text:`Card message: ${money(product.card_note.fee)}.`,fact_refs:[ref]});}}
  if(!exact.length){const ref=add('computed.no_exact_match','Requested product available',false);frames.unshift({id:'no_exact_match',text:'The exact requested flower is not in this catalog.',fact_refs:[ref]});}
  const question=!requirements.zone?'Which delivery district?':null;
  return {verdict,matches,alternatives,facts,frames,question,reasons};
}
