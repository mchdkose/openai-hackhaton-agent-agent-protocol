import {createDemoOrder} from '@/lib/service';
import {jsonResult,readObject,verifyOrigin} from '@/lib/http';
import {ProtocolError} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request) {
  try{
    verifyOrigin(request);const body=await readObject(request);
    if(typeof body.tenant!=='string'||typeof body.h!=='string'||typeof body.sku!=='string')throw new ProtocolError('invalid_request','A shop, conversation and product are required.');
    return jsonResult(await createDemoOrder({tenant:body.tenant,h:body.h,sku:body.sku}));
  }catch(error){const known=error instanceof ProtocolError;return jsonResult({ok:false,error:{code:known?error.code:'service_unavailable',message:known?error.message:'The service is temporarily unavailable.'}},known?error.status:503);}
}
