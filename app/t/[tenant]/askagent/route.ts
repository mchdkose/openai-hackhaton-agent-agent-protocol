import {handleAsk} from '@/lib/service';
import {respond} from '@/lib/render';
import {protocolFailure} from '@/lib/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}) {
  const {tenant}=await params,url=new URL(request.url);
  try{return respond(await handleAsk(tenant,url.searchParams.get('ask')||'',url.searchParams.get('h'),url.origin,request.headers),request);}
  catch(error){return protocolFailure(error,tenant,request);}
}
