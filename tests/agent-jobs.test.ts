import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import {rm} from 'node:fs/promises';
const platform=vi.hoisted(()=>{
  process.env.ASKAGENT_DATA_DIR=`/private/tmp/askagent-jobs-test-${process.pid}`;
  process.env.BASE_URL='http://localhost:3000';
  return {context:null as null|{env:Record<string,unknown>}};
});
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:()=>{if(!platform.context)throw new Error('No Worker context');return platform.context;}}));
import {executeAgentJob,readAgentJobStatus,submitAgentQuestion} from '../lib/agent-jobs';
import {discovery} from '../lib/service';
import {transact,type D1DatabaseLike,type D1Statement} from '../lib/store';
import type {AskEnvelope,Session} from '../lib/types';
import {blankRequirements} from '../lib/session';
import {sessionKey} from '../lib/store';

beforeEach(async()=>{platform.context=null;await transact(state=>{state.jobs={};state.logs=[];state.limits={};});});
afterAll(async()=>{platform.context=null;await rm(process.env.ASKAGENT_DATA_DIR!,{recursive:true,force:true});});
const question='Send 25 red roses to Kadikoy tonight by 20:00 under 1500 TRY.';
const origin='http://localhost:3000';
const result=():AskEnvelope=>({...discovery('rose-and-stem',origin),kind:'answer',answer:{title:'Actual provider result fixture',bullets:['A completed model answer fixture.'],question:null},next:[]});

function database():D1DatabaseLike{
  let row:{version:number;state_json:string}|undefined;
  return {prepare(query:string):D1Statement{
    let values:unknown[]=[];
    const statement:D1Statement={bind(...next){values=next;return statement;},async first<T>():Promise<T|null>{
      if(query.startsWith('SELECT'))return row?{...row} as T:null;
      if(query.startsWith('UPDATE')){if(!row||row.version!==values[2])return null;row={version:row.version+1,state_json:String(values[0])};return {version:row.version} as T;}
      throw new Error('Unexpected query');
    },async run(){if(!row)row={version:0,state_json:String(values[0])};return {success:true};}};
    return statement;
  }};
}

it('queues only an opaque ID and returns pending without a fabricated business answer',async()=>{
  const send=vi.fn(async()=>undefined);
  platform.context={env:{ASKAGENT_DB:database(),ASKAGENT_JOBS:{send},SESSION_HMAC_SECRET:'test-hmac'}};
  const h='h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  await transact(state=>{state.sessions[sessionKey('rose-and-stem',h)]={h,tenant:'rose-and-stem',created_at:Date.now(),expires_at:Date.now()+1800000,questions:0,requirements:blankRequirements(),shown:[],note:null,turns:[],assistant:{label:'unknown',confidence:'unknown'}} satisfies Session;});
  const pending=await submitAgentQuestion('rose-and-stem',`${question} email: private@example.com`,h,origin,new Headers({'user-agent':'ChatGPT-User/1.0 private detail','x-forwarded-for':'203.0.113.10',authorization:'private bearer',cookie:'private cookie'}));
  expect(pending.kind).toBe('pending');expect(pending.status).toBeUndefined();expect(pending.matches).toBeUndefined();expect(pending.quote).toBeUndefined();expect(pending.h).toBeUndefined();
  expect(send).toHaveBeenCalledWith({jobId:pending.job!.id},{contentType:'json'});
  expect(JSON.stringify(send.mock.calls)).not.toContain(question);
  const stored=await transact(state=>state.jobs[pending.job!.id]);
  expect(stored.ask).not.toContain('private@example.com');expect(stored.user_agent).toBe('ChatGPT-User');
  const serialized=JSON.stringify(stored);
  for(const privateValue of ['private detail','203.0.113.10','private bearer','private cookie'])expect(serialized).not.toContain(privateValue);
  expect(JSON.stringify(pending)).not.toContain(h);
  expect(await transact(state=>state.logs.length)).toBe(0);
});

it('rejects expired and cross-agent conversation handles rather than silently losing requirements',async()=>{
  const h='h_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  await expect(submitAgentQuestion('rose-and-stem',question,h,origin,new Headers())).rejects.toMatchObject({code:'session_expired',status:410});
  await transact(state=>{state.sessions[sessionKey('petal-atelier',h)]={h,tenant:'petal-atelier',created_at:Date.now(),expires_at:Date.now()+1800000,questions:0,requirements:blankRequirements(),shown:[],note:null,turns:[],assistant:{label:'unknown',confidence:'unknown'}} satisfies Session;});
  await expect(submitAgentQuestion('rose-and-stem',question,h,origin,new Headers())).rejects.toMatchObject({code:'session_expired',status:410});
  await expect(submitAgentQuestion('rose-and-stem',question,'invalid',origin,new Headers())).rejects.toMatchObject({code:'invalid_handle'});
});

it('returns incrementing poll links, isolates tenants, and exposes only the completed real result',async()=>{
  const queued=await submitAgentQuestion('rose-and-stem',question,null,origin,new Headers());
  const id=queued.job!.id;
  const waiting=await readAgentJobStatus('rose-and-stem',id,4,origin);
  expect(new URL(waiting.next[0].url).searchParams.get('attempt')).toBe('5');
  expect(new URL(waiting.next[0].url).searchParams.get('format')).toBe('html');
  await expect(readAgentJobStatus('petal-atelier',id,0,origin)).rejects.toMatchObject({status:410});
  const actual=result(),run=vi.fn(async()=>actual);
  expect(await executeAgentJob(id,run)).toEqual({ok:true,status:'complete'});
  expect(await readAgentJobStatus('rose-and-stem',id,5,origin)).toEqual(actual);
  await executeAgentJob(id,run);expect(run).toHaveBeenCalledTimes(1);
  await transact(state=>{state.jobs[id].expires_at=Date.now()-1;});
  await expect(readAgentJobStatus('rose-and-stem',id,0,origin)).rejects.toMatchObject({status:410});
});

it('retries provider failures without generating a template answer and ends with a sanitized error',async()=>{
  const queued=await submitAgentQuestion('rose-and-stem',question,null,origin,new Headers()),id=queued.job!.id;
  const run=vi.fn(async()=>{throw new Error('Provider failure containing a private credential');});
  await expect(executeAgentJob(id,run)).rejects.toMatchObject({status:503});
  expect((await readAgentJobStatus('rose-and-stem',id,0,origin)).kind).toBe('pending');
  await expect(executeAgentJob(id,run)).rejects.toMatchObject({status:503});
  expect(await executeAgentJob(id,run)).toEqual({ok:true,status:'error'});
  const failed=await readAgentJobStatus('rose-and-stem',id,1,origin);
  expect(failed.kind).toBe('error');expect(failed.status).toBeUndefined();expect(failed.matches).toBeUndefined();
  expect(JSON.stringify(failed)).not.toContain('private credential');
  await executeAgentJob(id,run);expect(run).toHaveBeenCalledTimes(3);
});
