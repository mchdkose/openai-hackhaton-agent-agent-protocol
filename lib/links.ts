import type {NextLink,Session,Tenant} from './types';
export function baseURL(origin?:string):string {
  for(const candidate of [process.env.BASE_URL,origin,'http://localhost:3000']){
    if(!candidate)continue;
    try{const parsed=new URL(candidate.trim());if(parsed.protocol==='http:'||parsed.protocol==='https:')return parsed.origin;}catch{/* Try the known request origin. */}
  }
  return 'http://localhost:3000';
}
export function endpoint(tenant:Tenant,route='',params:Record<string,string|undefined>={},origin?:string):string {
  const url=new URL(`/t/${tenant.id}/askagent${route?`/${route}`:''}`,baseURL(origin));
  for(const [key,value] of Object.entries(params))if(value!==undefined)url.searchParams.set(key,value);
  return url.toString();
}
export function nextLinks(tenant:Tenant,session?:Session,origin?:string,sku?:string):NextLink[] {
  if(!session)return [{rel:'discovery',label:'Discover the shop agent',url:endpoint(tenant,'',{},origin),method:'GET'}];
  const h=session.h,product=sku||session.quote?.sku||session.shown[0],zone=session.requirements.zone;
  const links:NextLink[]=[{rel:'continue',label:'Continue this conversation',url:endpoint(tenant,'',{h,ask:'Please review my current request without changing it.',format:'html'},origin),method:'GET'}, {rel:'transcript',label:'Open this conversation in another assistant',url:endpoint(tenant,'transcript',{h,format:'html'},origin),method:'GET'}];
  if(product){links.push({rel:'evidence',label:'Catalog evidence',url:endpoint(tenant,'evidence',{h,sku:product},origin),method:'GET'});if(zone)links.push({rel:'quote',label:'Verified quote',url:endpoint(tenant,'quote',{h,sku:product,zone},origin),method:'GET'});links.push({rel:'checkout',label:'Open the selection in the shop',url:endpoint(tenant,'checkout',{h,sku:product,quote_id:session.quote?.sku===product?session.quote.id:undefined},origin),method:'GET'});}
  return links;
}
