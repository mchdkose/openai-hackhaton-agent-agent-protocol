import {randomBytes} from 'node:crypto';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {redactAsk} from './extract';
import {baseURL,endpoint} from './links';
import {discovery,errorEnvelope,handleAsk} from './service';
import {detectAssistant,guardRead,ProtocolError} from './session';
import {readSession,storageMode,transact,validHandle} from './store';
import {getTenant} from './tenants';
import type {AgentJob,AskEnvelope} from './types';

declare global {
  interface CloudflareEnv {
    ASKAGENT_JOBS?: {send(body:{jobId:string},options?:{contentType:'json'}):Promise<void>};
  }
}

const JOB_TTL_MS=30*60*1000;
const JOB_LEASE_MS=15*60*1000;
const MAX_ATTEMPTS=3;
const validJobId=(id:string)=>/^job_[a-f0-9]{32}$/.test(id);
const safeError={code:'agent_unavailable',message:'The real merchant agent could not finish this question. Please submit it again.'};

function pending(job:AgentJob,attempt:number,origin:string):AskEnvelope {
  const tenant=getTenant(job.tenant)!;
  return {...discovery(job.tenant,origin),kind:'pending',job:{id:job.id,status:job.status,expires_at:new Date(job.expires_at).toISOString()},answer:{title:`${tenant.name} — ${job.status==='queued'?'your question is queued':'the merchant agent is working'}`,bullets:['This is a pending task, not a merchant answer.',job.status==='queued'?'The question is queued for the real agent. Follow the status link for its completed answer.':'The real agent is processing your question. Follow the status link for its completed answer.','No order has been created.'],question:null},next:[{rel:'status',label:'Read the real merchant agent result',url:endpoint(tenant,'status',{job:job.id,attempt:String(Math.max(0,attempt)+1),format:'html'},origin),method:'GET'}]};
}

export async function submitAgentQuestion(tenantId:string,ask:string,h:string|null|undefined,origin:string,headers:Headers):Promise<AskEnvelope> {
  const tenant=getTenant(tenantId);
  if(!tenant)throw new ProtocolError('unknown_tenant','Shop not found.',404);
  if(!ask.trim())return discovery(tenantId,origin);
  if(ask.length>2000)throw new ProtocolError('query_too_long','Your question must be no longer than 2,000 characters.');
  await guardRead(headers);
  if(h){if(!validHandle(h))throw new ProtocolError('invalid_handle','The conversation handle is invalid.');if(!await readSession(tenant.id,h))throw new ProtocolError('session_expired','This conversation has expired or belongs to another agent. Start a new conversation.',410);}
  const assistant=detectAssistant(headers.get('user-agent')).label;
  const agentNames={chatgpt:'ChatGPT-User',claude:'Claude-User',gemini:'Gemini-Deep-Research',perplexity:'Perplexity-User',unknown:''};
  const now=Date.now();
  const job:AgentJob={id:`job_${randomBytes(16).toString('hex')}`,tenant:tenant.id,ask:redactAsk(ask).trim(),h:validHandle(h)?h:null,origin:baseURL(origin),user_agent:agentNames[assistant],created_at:now,expires_at:now+JOB_TTL_MS,status:'queued',attempts:0};
  await transact(state=>{state.jobs[job.id]=job;});
  try {
    if(storageMode()==='d1'){
      const {env}=await getCloudflareContext({async:true});
      if(!env.ASKAGENT_JOBS)throw new Error('The durable agent queue is not configured');
      // The durable queue contains only an opaque ID, never the question or handle.
      await env.ASKAGENT_JOBS.send({jobId:job.id},{contentType:'json'});
    }else if(process.env.NODE_ENV!=='test'){
      // Local development only: a long-lived Node process runs the same job.
      // Production Cloudflare requests always require the durable Queue above.
      void runLocalJob(job.id);
    }
  }catch{
    await transact(state=>{const stored=state.jobs[job.id];if(stored){stored.status='error';stored.error=safeError;}});
    throw new ProtocolError('agent_queue_unavailable','The merchant agent queue is temporarily unavailable. Please try again.',503);
  }
  return pending(job,0,job.origin);
}

export async function readAgentJobStatus(tenantId:string,jobId:string,attempt:number,origin:string):Promise<AskEnvelope> {
  if(!validJobId(jobId))throw new ProtocolError('job_not_found','This agent task was not found or has expired.',410);
  const job=await transact(state=>{const saved=state.jobs[jobId];return saved?.tenant===tenantId?structuredClone(saved):undefined;});
  if(!job)throw new ProtocolError('job_not_found','This agent task was not found or has expired.',410);
  if(job.status==='complete'&&job.result)return job.result;
  if(job.status==='error')return {...errorEnvelope(tenantId,safeError.code,safeError.message,origin),job:{id:job.id,status:'error',expires_at:new Date(job.expires_at).toISOString()}};
  return pending(job,Number.isSafeInteger(attempt)&&attempt>=0?attempt:0,origin);
}

type AgentRunner=typeof handleAsk;
export async function executeAgentJob(jobId:string,run:AgentRunner=handleAsk):Promise<{ok:true;status:'complete'|'error'|'expired'}> {
  if(!validJobId(jobId))return {ok:true,status:'expired'};
  const token=randomBytes(16).toString('hex');
  const claimed=await transact(state=>{
    const job=state.jobs[jobId];
    if(!job)return {status:'expired' as const};
    if(job.status==='complete'||job.status==='error')return {status:job.status};
    if(job.status==='running'&&(job.lease_until||0)>Date.now())throw new ProtocolError('job_running','This merchant agent is already processing the task.',503);
    if(job.attempts>=MAX_ATTEMPTS){job.status='error';job.error=safeError;return {status:'error' as const};}
    job.status='running';job.attempts++;job.lease_token=token;job.lease_until=Date.now()+JOB_LEASE_MS;
    return {status:'claimed' as const,job:structuredClone(job)};
  });
  if(claimed.status!=='claimed')return {ok:true,status:claimed.status};
  try {
    // Model I/O stays outside the D1 compare-and-swap transaction callback.
    const result=await run(claimed.job.tenant,claimed.job.ask,claimed.job.h,claimed.job.origin,new Headers(claimed.job.user_agent?{'user-agent':claimed.job.user_agent}:{}));
    if(result.kind!=='answer')throw new Error('The merchant agent did not return an answer');
    await transact(state=>{
      const job=state.jobs[jobId];
      if(job?.lease_token!==token)return;
      job.result=result;job.status='complete';delete job.lease_token;delete job.lease_until;delete job.error;
    });
    return {ok:true,status:'complete'};
  }catch(error){
    const terminal=await transact(state=>{
      const job=state.jobs[jobId];
      if(!job||job.lease_token!==token)return true;
      const permanent=error instanceof ProtocolError&&error.status<500&&error.status!==429;
      job.status=permanent||job.attempts>=MAX_ATTEMPTS?'error':'queued';job.error=safeError;
      delete job.lease_token;delete job.lease_until;
      return job.status==='error';
    });
    if(terminal)return {ok:true,status:'error'};
    throw new ProtocolError('agent_job_retry','The real merchant agent will retry this task.',503);
  }
}

async function runLocalJob(jobId:string):Promise<void>{
  for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++){
    try{await executeAgentJob(jobId);return;}catch{/* The local process retries; production retries are owned by Cloudflare Queue. */}
  }
}
