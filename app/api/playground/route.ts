import {handleAsk,errorEnvelope} from '@/lib/service';
import {jsonResult,readObject} from '@/lib/http';
import {ProtocolError} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request) {
  let tenant='rose-and-stem';
  try{
    const body=await readObject(request);
    if(typeof body.tenant!=='string'||typeof body.ask!=='string')throw new ProtocolError('invalid_request','A shop and question are required.');
    tenant=body.tenant;
    if(body.h!==undefined&&typeof body.h!=='string')throw new ProtocolError('invalid_handle','The conversation handle is invalid.');
    const result=await handleAsk(tenant,body.ask,body.h as string|undefined,new URL(request.url).origin,request.headers);
    return jsonResult(result);
  }catch(error){const known=error instanceof ProtocolError;return jsonResult(errorEnvelope(tenant,known?error.code:'service_unavailable',known?error.message:'The service is temporarily unavailable.',new URL(request.url).origin),known?error.status:503);}
}
