import {submitAgentQuestion} from '@/lib/agent-jobs';
import {respond} from '@/lib/render';
import {protocolFailure} from '@/lib/http';
import {ProtocolError} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}) {
  const {tenant}=await params,url=new URL(request.url);
  try{return respond(await submitAgentQuestion(tenant,url.searchParams.get('ask')||'',url.searchParams.get('h'),url.origin,request.headers),request);}
  catch(error){return protocolFailure(error,tenant,request);}
}
// POST keeps a longer natural-language request out of access-log URLs.
// It queues the same read/proposal operation as GET; it cannot create an order.
export async function POST(request:Request,{params}:{params:Promise<{tenant:string}>}) {
  const {tenant}=await params,url=new URL(request.url);
  try{
    if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ProtocolError('json_required','Send an application/json request.',415);
    const text=await request.text();
    if(text.length>12000)throw new ProtocolError('request_too_large','The request body is too large.',413);
    let body:Record<string,unknown>;
    try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{throw new ProtocolError('invalid_json','Send a JSON object with ask and an optional h.');}
    if(typeof body.ask!=='string'||!body.ask.trim()||(body.h!==undefined&&body.h!==null&&typeof body.h!=='string')||Object.keys(body).some(key=>!['ask','h'].includes(key)))throw new ProtocolError('invalid_request','Send ask as a non-empty string and h as an optional conversation handle.');
    return respond(await submitAgentQuestion(tenant,body.ask,body.h as string|null|undefined,url.origin,request.headers),request);
  }catch(error){return protocolFailure(error,tenant,request);}
}
export function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Accept','Access-Control-Max-Age':'86400'}});}
