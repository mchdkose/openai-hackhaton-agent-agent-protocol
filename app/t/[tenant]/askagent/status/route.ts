import {readAgentJobStatus} from '@/lib/agent-jobs';
import {protocolFailure} from '@/lib/http';
import {respond} from '@/lib/render';
import {guardRead} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params,url=new URL(request.url);
  try{await guardRead(request.headers);return respond(await readAgentJobStatus(tenant,url.searchParams.get('job')||'',Number(url.searchParams.get('attempt')||0),url.origin),request);}
  catch(error){return protocolFailure(error,tenant,request);}
}
