export const MODEL_IDS = {
  extractor:process.env.OPENROUTER_EXTRACT_MODEL||process.env.EXTRACT_MODEL||'anthropic/claude-haiku-5.5',
  composer:process.env.OPENROUTER_COMPOSE_MODEL||process.env.COMPOSE_MODEL||'openai/gpt-6-luna',
  judge:process.env.OPENROUTER_JUDGE_MODEL||process.env.REFEREE_MODEL||'openai/gpt-6.1-sol',
};
export function modelsEnabled(): boolean { return !!process.env.OPENROUTER_API_KEY && (process.env.NODE_ENV!=='test'||process.env.AGENT_TEST_MODEL==='1'); }
function timeoutMilliseconds(value:string|undefined,fallback:number):number {
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>0?Math.max(1,Math.min(2_147_483_647,Math.floor(parsed))):fallback;
}
export async function structuredModel<T>(model:string,name:string,schema:unknown,system:string,input:unknown,maxTokens=400): Promise<T> {
  if(!modelsEnabled()) throw new Error('Models unavailable');
  const tracked=usageContext.getStore();
  const timeout=timeoutMilliseconds(process.env.AGENT_MODEL_TIMEOUT_MS,60000);
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type':'application/json','HTTP-Referer':process.env.BASE_URL||'http://localhost:3000','X-OpenRouter-Title':'AskAgent'},
    body:JSON.stringify({model,max_tokens:model.startsWith('openai/')?Math.max(maxTokens,1600):maxTokens,...(model.startsWith('openai/')?{reasoning:{effort:'low',exclude:true}}:{}),messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}],response_format:{type:'json_schema',json_schema:{name,strict:true,schema}},provider:{require_parameters:true}}),
    signal:AbortSignal.timeout(timeout),cache:'no-store',
  });
  if(!response.ok) throw new Error('Model provider unavailable');
  const body=await response.json() as {choices?:{message?:{content?:string}}[];usage?:{prompt_tokens?:number;completion_tokens?:number;cost?:number}};
  if(tracked){tracked.usage.calls++;tracked.usage.input_tokens+=body.usage?.prompt_tokens||0;tracked.usage.output_tokens+=body.usage?.completion_tokens||0;if(typeof body.usage?.cost==='number')tracked.usage.cost_usd=(tracked.usage.cost_usd||0)+body.usage.cost;}
  const content=body.choices?.[0]?.message?.content;
  if(!content) throw new Error('Invalid model response');
  return JSON.parse(content) as T;
}
import {AsyncLocalStorage} from 'node:async_hooks';
import type {ModelUsage} from './types';
const usageContext=new AsyncLocalStorage<{usage:ModelUsage}>();
export function withModelUsage<T>(callback:()=>Promise<T>):Promise<T>{return usageContext.run({usage:{calls:0,input_tokens:0,output_tokens:0,cost_usd:null}},callback);}
export function currentModelUsage():ModelUsage|undefined{const usage=usageContext.getStore()?.usage;return usage?{...usage}:undefined;}
export type AgentTool = {type:'function';function:{name:string;description:string;parameters:unknown;strict?:boolean}};
export type AgentToolCall = {id:string;type:'function';function:{name:string;arguments:string}};
export type AgentMessage = {role:'system'|'user'|'assistant'|'tool';content:string|null;tool_calls?:AgentToolCall[];tool_call_id?:string};
export async function agentChat(messages:AgentMessage[],tools:AgentTool[]):Promise<AgentMessage>{
  if(!process.env.OPENROUTER_API_KEY)throw new Error('The merchant agent provider is not configured');
  const model=MODEL_IDS.composer;
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':process.env.BASE_URL||'http://localhost:3000','X-OpenRouter-Title':'AskAgent merchant tool agent'},body:JSON.stringify({model,messages,tools,tool_choice:'auto',max_tokens:2400,...(model.startsWith('openai/')?{reasoning:{effort:model==='openai/gpt-6-luna'?'none':'low',exclude:true}}:{}),provider:{require_parameters:true}}),signal:AbortSignal.timeout(timeoutMilliseconds(process.env.AGENT_MODEL_TIMEOUT_MS,60000)),cache:'no-store'});
  if(!response.ok){const errorBody=await response.json().catch(()=>({})) as {error?:{message?:string}};const detail=String(errorBody.error?.message||'Provider request failed').replaceAll(process.env.OPENROUTER_API_KEY!,'[credential]').slice(0,240);throw new Error(`The merchant agent provider is unavailable (${response.status}): ${detail}`);}
  const body=await response.json() as {choices?:{message?:AgentMessage}[];usage?:{prompt_tokens?:number;completion_tokens?:number;cost?:number}};
  const tracked=usageContext.getStore();
  if(tracked){tracked.usage.calls++;tracked.usage.input_tokens+=body.usage?.prompt_tokens||0;tracked.usage.output_tokens+=body.usage?.completion_tokens||0;if(typeof body.usage?.cost==='number')tracked.usage.cost_usd=(tracked.usage.cost_usd||0)+body.usage.cost;}
  const message=body.choices?.[0]?.message;
  if(!message)throw new Error('The merchant agent returned no message');
  return {...message,role:'assistant'};
}
