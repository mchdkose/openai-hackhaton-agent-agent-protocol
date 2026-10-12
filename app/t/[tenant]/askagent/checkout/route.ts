import {handleSessionRoute} from '@/lib/service';
import {respond} from '@/lib/render';
import {protocolFailure} from '@/lib/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}) {
  const {tenant}=await params;
  try{return respond(await handleSessionRoute(tenant,'checkout',request),request);}
  catch(error){return protocolFailure(error,tenant,request);}
}
