import {getTenant} from '@/lib/tenants';
import {jsonResult,readObject,verifyAdmin,verifyOrigin} from '@/lib/http';
import {ProtocolError} from '@/lib/session';
import {transact} from '@/lib/store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request){
  try{
    verifyOrigin(request);verifyAdmin(request);const body=await readObject(request);
    if(typeof body.tenant!=='string')throw new ProtocolError('invalid_patch','A shop is required.');
    const tenant=getTenant(body.tenant);if(!tenant)throw new ProtocolError('unknown_tenant','Shop not found.',404);
    if(!body.patch||typeof body.patch!=='object'||Array.isArray(body.patch))throw new ProtocolError('invalid_patch','A catalog patch is required.');
    const patch=body.patch as Record<string,unknown>;
    const sku=typeof body.sku==='string'?body.sku:undefined,zoneId=typeof body.zone==='string'?body.zone:undefined;
    if((!!sku)===(!!zoneId))throw new ProtocolError('invalid_patch','Select one product or one delivery district.');
    if(sku){
      if(!tenant.catalog.products.some(p=>p.sku===sku))throw new ProtocolError('unknown_product','This product is not in the catalog.',404);
      if(!Object.keys(patch).length||Object.keys(patch).some(key=>!['price','in_stock','stock_qty'].includes(key)))throw new ProtocolError('invalid_patch','Only product price and stock can be changed.');
      if(patch.price!==undefined&&(!Number.isSafeInteger(patch.price)||Number(patch.price)<1||Number(patch.price)>100000))throw new ProtocolError('invalid_price','A valid price is required.');
      if(patch.in_stock!==undefined&&typeof patch.in_stock!=='boolean')throw new ProtocolError('invalid_stock','Stock availability must be a boolean.');
      if(patch.stock_qty!==undefined&&(!Number.isSafeInteger(patch.stock_qty)||Number(patch.stock_qty)<0||Number(patch.stock_qty)>999))throw new ProtocolError('invalid_stock','A valid stock quantity is required.');
    }else{
      const zone=tenant.catalog.delivery_zones.find(z=>z.zone===zoneId);
      if(!zone)throw new ProtocolError('unknown_zone','This district is not in the catalog.');
      if(Object.keys(patch).length!==1||typeof patch.same_day!=='boolean')throw new ProtocolError('invalid_patch','Only same-day delivery availability can be changed.');
      if(patch.same_day&&!zone.cutoff_local)throw new ProtocolError('invalid_cutoff','Same-day delivery requires a published cutoff time.');
    }
    const asOf=new Date().toISOString();
    await transact(state=>{
      const current=state.catalog_overrides[tenant.id]||{as_of:asOf,products:{},zones:{}};
      current.as_of=asOf;
      if(sku){
        const base=tenant.catalog.products.find(p=>p.sku===sku)!;
        const changes={...current.products[sku],...patch} as {price?:number;in_stock?:boolean;stock_qty?:number};
        if(changes.in_stock===false)changes.stock_qty=0;
        if(patch.stock_qty!==undefined)changes.in_stock=Number(patch.stock_qty)>0;
        if(patch.in_stock===true&&!(changes.stock_qty??base.stock_qty))changes.stock_qty=1;
        current.products[sku]=changes;
      }else current.zones[zoneId!]={same_day:patch.same_day as boolean};
      state.catalog_overrides[tenant.id]=current;
    });
    return jsonResult({ok:true,tenant:tenant.id,catalog_as_of:asOf,changed:{...(sku?{sku}:{zone:zoneId}),patch},demo:true});
  }catch(error){const known=error instanceof ProtocolError;return jsonResult({ok:false,error:{code:known?error.code:'service_unavailable',message:known?error.message:'The service is temporarily unavailable.'}},known?error.status:503);}
}
