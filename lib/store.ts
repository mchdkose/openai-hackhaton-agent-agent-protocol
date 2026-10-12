import {randomBytes, createHmac} from 'node:crypto';
import path from 'node:path';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import type {AuditLog, CatalogOverride, Session} from './types';

export type State = {sessions: Record<string, Session>; logs: AuditLog[]; limits: Record<string, {count: number; expires: number}>; orders: Record<string, {id: string; total: number; created_at: number}>;catalog_overrides:Record<string,CatalogOverride>};
export type D1Statement = {bind(...values:unknown[]):D1Statement;first<T>():Promise<T|null>;run():Promise<unknown>};
export type D1DatabaseLike = {prepare(query:string):D1Statement};
const empty = (): State => ({sessions:{},logs:[],limits:{},orders:{},catalog_overrides:{}});
const runtime = globalThis as typeof globalThis & {__askagentStore?: {queue: Promise<unknown>; secret?: string};WebSocketPair?:unknown};
// Worker module evaluation must not generate random values or start I/O. Only
// the local Node fallback needs this queue and a lazily created fallback key.
const shared = runtime.__askagentStore ??= {queue: Promise.resolve()};
function cloudflareEnvironment():Record<string,unknown>|undefined {
  try{return getCloudflareContext().env as unknown as Record<string,unknown>;}catch{return undefined;}
}
export const storageMode = (): 'd1' | 'redis' | 'local_file' => {
  const env=cloudflareEnvironment();
  if(env){if(!env.ASKAGENT_DB)throw new Error('Cloudflare session database is not configured');return 'd1';}
  if(typeof runtime.WebSocketPair==='function')throw new Error('Cloudflare request context is unavailable');
  return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? 'redis' : 'local_file';
};
export const privacyHash = (value: string): string => {
  const configured=cloudflareEnvironment()?.SESSION_HMAC_SECRET;
  const secret=typeof configured==='string'?configured:process.env.SESSION_HMAC_SECRET||(shared.secret??=randomBytes(32).toString('hex'));
  return createHmac('sha256',secret).update(value).digest('hex').slice(0,24);
};
let dataDirectory: string | undefined;
function localDirectory():string{return dataDirectory??=process.env.ASKAGENT_DATA_DIR||path.join(process.cwd(),'.data');}

async function redis(command: (string|number)[]): Promise<unknown> {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {method:'POST', headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}`, 'Content-Type':'application/json'}, body:JSON.stringify(command), cache:'no-store', signal:AbortSignal.timeout(4000)});
  if (!response.ok) throw new Error('Session storage unavailable');
  const payload = await response.json() as {result:unknown;error?:string};
  if (payload.error) throw new Error('Session storage unavailable');
  return payload.result;
}
async function prepareDirectory() {
  const {mkdir}=await import('node:fs/promises');
  try { await mkdir(localDirectory(),{recursive:true}); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EROFS' && (error as NodeJS.ErrnoException).code !== 'EACCES') throw error;
    dataDirectory = path.join('/tmp','askagent-data');
    await mkdir(dataDirectory,{recursive:true});
  }
}
async function loadState(): Promise<State> {
  if (storageMode()==='redis') { const state = await redis(['GET','askagent:state:v1']); return state ? {...empty(),...JSON.parse(String(state))} as State : empty(); }
  await prepareDirectory();
  const {readFile}=await import('node:fs/promises');
  try { return {...empty(),...JSON.parse(await readFile(path.join(localDirectory(),'state.json'),'utf8'))} as State; }
  catch (error) { if ((error as NodeJS.ErrnoException).code==='ENOENT') return empty(); throw error; }
}
async function saveState(state: State) {
  if (storageMode()==='redis') { await redis(['SET','askagent:state:v1',JSON.stringify(state)]); return; }
  const temporary = path.join(localDirectory(),`state-${randomBytes(8).toString('hex')}.tmp`);
  const {writeFile,rename}=await import('node:fs/promises');
  await writeFile(temporary,JSON.stringify(state),{mode:0o600});
  await rename(temporary,path.join(localDirectory(),'state.json'));
}
function prune(state: State) {
  const now = Date.now();
  for (const [key,value] of Object.entries(state.sessions)) if (value.expires_at<=now) delete state.sessions[key];
  for (const [key,value] of Object.entries(state.limits)) if (value.expires<=now) delete state.limits[key];
  for (const [key,value] of Object.entries(state.orders)) if (value.created_at+86400000<=now) delete state.orders[key];
  state.logs=state.logs.filter(log => new Date(log.ts).getTime()+86400000>now).slice(-500);
}
export async function d1Transact<T>(db:D1DatabaseLike,fn:(state:State)=>T|Promise<T>):Promise<T>{
  // Callbacks mutate this in-memory document only and may be re-run after a CAS
  // conflict. Models, network calls and externally visible effects stay outside.
  for(let attempt=0;attempt<12;attempt++){
    const row=await db.prepare("SELECT version, state_json FROM askagent_state WHERE id = 'main'").first<{version:number;state_json:string}>();
    if(!row){
      await db.prepare("INSERT OR IGNORE INTO askagent_state (id, version, state_json, updated_at) VALUES ('main', 0, ?, ?)").bind(JSON.stringify(empty()),Date.now()).run();
      continue;
    }
    const state={...empty(),...JSON.parse(row.state_json)} as State;
    prune(state);
    const result=await fn(state);
    const serialized=JSON.stringify(state);
    if(Buffer.byteLength(serialized,'utf8')>1500000)throw new Error('Session storage capacity reached');
    const saved=await db.prepare("UPDATE askagent_state SET state_json = ?, version = version + 1, updated_at = ? WHERE id = 'main' AND version = ? RETURNING version").bind(serialized,Date.now(),row.version).first<{version:number}>();
    if(saved)return result;
    await new Promise(resolve=>setTimeout(resolve,5+Math.floor(Math.random()*20)));
  }
  throw new Error('Session storage busy');
}
export async function transact<T>(fn: (state: State) => T|Promise<T>): Promise<T> {
  if(storageMode()==='d1'){
    const database=cloudflareEnvironment()?.ASKAGENT_DB as D1DatabaseLike|undefined;
    if(!database)throw new Error('Cloudflare session database is not configured');
    // D1 CAS handles concurrency across isolates. Never chain this request's I/O
    // onto a Promise created by a different Worker request.
    return d1Transact(database,fn);
  }
  const operation = shared.queue.then(async () => {
    let lock: string | undefined;
    if (storageMode()==='redis') {
      lock=randomBytes(16).toString('hex');
      let acquired=false;
      for(let n=0;n<40;n++){ if(await redis(['SET','askagent:lock:v1',lock,'NX','PX',15000])){acquired=true;break;} await new Promise(resolve=>setTimeout(resolve,25)); }
      if(!acquired) throw new Error('Session storage busy');
    }
    try { const state=await loadState(); prune(state); const result=await fn(state); await saveState(state); return result; }
    finally { if(lock) await redis(['EVAL',"if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,'askagent:lock:v1',lock]); }
  });
  shared.queue=operation.catch(()=>undefined);
  return operation;
}
export const sessionKey = (tenant: string,h: string): string => `${tenant}:${h}`;
export const validHandle = (h?: string|null): h is string => !!h && /^h_[a-f0-9]{32}$/.test(h);
export async function readSession(tenant: string,h?: string|null): Promise<Session|undefined> {
  if(!validHandle(h)) return undefined;
  return transact(state=>{ const sess=state.sessions[sessionKey(tenant,h)]; return sess ? structuredClone(sess) : undefined; });
}
export async function writeSession(session: Session): Promise<void> {
  await transact(state=>{
    const existing=state.sessions[sessionKey(session.tenant,session.h)];
    if(existing && existing.expires_at>Date.now()){
      const turns=[...existing.turns,...session.turns].filter((turn,index,all)=>all.findIndex(t=>t.at===turn.at&&t.answer_hash===turn.answer_hash)===index).sort((a,b)=>a.at.localeCompare(b.at)).slice(-60);
      state.sessions[sessionKey(session.tenant,session.h)]={...session,quote:session.quote||existing.quote,turns,questions:existing.questions};
    }
  });
}
export async function recordLog(log: Omit<AuditLog,'id'|'ts'>): Promise<void> {
  await transact(state=>{state.logs.push({...log,id:randomBytes(8).toString('hex'),ts:new Date().toISOString()});});
}
export async function readLogs(): Promise<AuditLog[]> { return transact(state=>structuredClone(state.logs)); }
