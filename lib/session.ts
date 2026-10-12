import {randomBytes} from 'node:crypto';
import {privacyHash,sessionKey,transact,validHandle} from './store';
import type {AssistantIdentity, Requirements, Session, Tenant} from './types';

export const blankRequirements = (): Requirements => ({flower:null,color:null,zone:null,deadline_local:null,delivery_date:null,budget:null,stems_min:null,note:null,language:'en'});
export class ProtocolError extends Error { constructor(public code: string,message: string, public status=400){super(message);} }
export function detectAssistant(userAgent: string|null): AssistantIdentity {
  const ua=userAgent||'';
  // A proxy user-agent is evidence about the fetch client, never proof of the person's assistant.
  const label = /ChatGPT-User/i.test(ua)?'chatgpt':/Claude-User/i.test(ua)?'claude':/Gemini-Deep-Research/i.test(ua)?'gemini':/Perplexity-User/i.test(ua)?'perplexity':'unknown';
  return {label,confidence:label==='unknown'?'unknown':'proxy_user_agent'};
}
export async function reserveQuestion(tenant: Tenant,h: string|null,headers: Headers): Promise<Session> {
  const ip=headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  const assistant=detectAssistant(headers.get('user-agent'));
  return transact(state=>{
    const now=Date.now();
    const key=`ip:${privacyHash(ip)}`;
    const bucket=state.limits[key]||{count:0,expires:now+3600000};
    if(bucket.count >= Number(process.env.RATE_PER_IP_HOUR||300)) throw new ProtocolError('rate_limit','Too many requests. Please try again later.',429);
    let session=validHandle(h) ? state.sessions[sessionKey(tenant.id,h)] : undefined;
    if(session && session.questions>=tenant.policy.max_questions_per_session) throw new ProtocolError('session_rate_limit','This conversation has reached its question limit. Please try again after the session expires.',429);
    if(!session){session={h:`h_${randomBytes(16).toString('hex')}`,tenant:tenant.id,created_at:now,expires_at:now+tenant.policy.session_ttl_minutes*60000,questions:0,requirements:blankRequirements(),shown:[],note:null,turns:[],assistant};}
    bucket.count++; state.limits[key]=bucket; session.questions++; session.assistant=assistant;
    state.sessions[sessionKey(tenant.id,session.h)]=session;
    return structuredClone(session);
  });
}
export async function guardRead(headers: Headers): Promise<void> {
  const ip=headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  await transact(state=>{
    const key=`read:${privacyHash(ip)}`,now=Date.now();
    const bucket=state.limits[key]||{count:0,expires:now+60000};
    if(bucket.count>=120) throw new ProtocolError('rate_limit','Too many requests. Please try again in one minute.',429);
    bucket.count++;state.limits[key]=bucket;
  });
}
