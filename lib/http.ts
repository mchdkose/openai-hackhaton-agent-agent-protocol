import {timingSafeEqual} from 'node:crypto';
import {errorEnvelope} from './service';
import {ProtocolError} from './session';
import {respond} from './render';
export function protocolFailure(error:unknown,tenant:string,request:Request):Response {
  const known=error instanceof ProtocolError;
  return respond(errorEnvelope(tenant,known?error.code:'service_unavailable',known?error.message:'The service is temporarily unavailable. Please try again.',new URL(request.url).origin),request,known?error.status:503);
}
export function verifyOrigin(request:Request):void {
  const origin=request.headers.get('origin');
  const reject=()=>{throw new ProtocolError('origin_required','Confirm this action from the shop page.',403);};
  if(!origin)reject();
  let incoming:URL;
  try{incoming=new URL(origin!);}catch{reject();return;}
  if(!['http:','https:'].includes(incoming.protocol)||incoming.origin!==origin)reject();
  // The public deployment origin is explicit. Next may construct request.url from
  // its internal HTTP listener even when the browser reaches an HTTPS tunnel.
  if(process.env.BASE_URL){
    try{const configured=new URL(process.env.BASE_URL.trim());if(['http:','https:'].includes(configured.protocol)&&configured.origin===incoming.origin)return;}catch{/* Invalid configuration never grants access. */}
  }
  const loopback=(hostname:string)=>['localhost','127.0.0.1','[::1]'].includes(hostname.toLowerCase());
  const internal=new URL(request.url);
  if(loopback(internal.hostname)&&internal.origin===incoming.origin)return;
  // A development server bound to 0.0.0.0 still receives Host: localhost:PORT.
  // Only loopback Host values can supplement BASE_URL; forwarded host headers
  // and arbitrary public Host values never expand the allowed origin set.
  const host=request.headers.get('host');
  if(host&&/^[a-z0-9.\[\]:-]+$/i.test(host)&&loopback(incoming.hostname)){
    try{const local=new URL(`${internal.protocol}//${host}`);if(loopback(local.hostname)&&local.host===incoming.host&&local.protocol===incoming.protocol)return;}catch{/* Reject malformed local hosts. */}
  }
  reject();
}
export function verifyAdmin(request:Request):void {
  const configured=process.env.DEMO_ADMIN_TOKEN;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!configured||!supplied||Buffer.byteLength(configured)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(configured),Buffer.from(supplied)))throw new ProtocolError('admin_required','Administrator access is required.',403);
}
export async function readObject(request:Request):Promise<Record<string,unknown>> {
  if(Number(request.headers.get('content-length')||0)>4000)throw new ProtocolError('request_too_large','The request is too large.',413);
  const text=await request.text();if(text.length>4000)throw new ProtocolError('request_too_large','The request is too large.',413);
  try{const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body as Record<string,unknown>;}catch{throw new ProtocolError('invalid_json','A valid JSON request is required.');}
}
export function jsonResult(value:unknown,status=200):Response{return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'}});}
