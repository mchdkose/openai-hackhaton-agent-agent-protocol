import {describe,expect,it,vi} from 'vitest';
import {runMerchantAgent} from '@/lib/merchant-agent';
import {getTenant} from '@/lib/tenants';
import {blankRequirements} from '@/lib/session';
import type {AgentMessage,AgentTool} from '@/lib/models';
import type {Requirements,Session} from '@/lib/types';

const tenant=getTenant('rose-and-stem')!;
const requirements:Requirements={flower:'rose',color:'red',zone:'kadikoy',deadline_local:'20:00',delivery_date:'today',budget:1500,stems_min:25,note:'Happy birthday, Mom.',language:'en'};
const session:Session={h:'h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',tenant:'rose-and-stem',created_at:Date.now(),expires_at:Date.now()+1800000,questions:1,requirements:blankRequirements(),shown:[],note:null,turns:[],assistant:{label:'unknown',confidence:'unknown'}};
const calls=(...tools:{name:string;args:unknown}[]):AgentMessage=>({role:'assistant',content:null,tool_calls:tools.map((tool,index)=>({id:`call_${index}`,type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.args)}}))});
const final=()=>calls({name:'emit_answer',args:{title:'A birthday bouquet that reaches Kadikoy tonight',verdict:'yes',requirements,question:null,bullets:[{text:'I can deliver your mother’s 25 red roses to Kadikoy today by 19:30, for 1,370 TRY including delivery.',fact_refs:['catalog.products.GB-25R.name','catalog.products.GB-25R.stems','catalog.products.GB-25R.in_stock','catalog.delivery_zones.kadikoy.label','computed.GB-25R.kadikoy.eta_text','computed.GB-25R.kadikoy.total','computed.GB-25R.kadikoy.deadline_met']}]}});
const judge=vi.fn(async()=>({verdict:'pass' as const,checked:1,dropped:[],mode:'model_and_rules' as const}));
describe('real merchant tool-agent orchestration',()=>{
  it('prepares a selected exact proposal inside evaluation in three model turns',async()=>{
    const responses=[calls({name:'read_business',args:{}}),calls({name:'evaluate_request',args:{requirements,proposal:{sku:'GB-25R',zone:'kadikoy',addons:[]}}}),final()];
    const chat=vi.fn(async()=>responses.shift()!);
    const result=await runMerchantAgent(tenant,session,'Prepare the matching bouquet',{chat,judge});
    expect(chat).toHaveBeenCalledTimes(3);expect(result.quote?.eligible).toBe(true);expect(result.quote?.total).toBe(1370);
  });
  it('answers business policy questions without requiring a delivery district or a product',async()=>{
    const responses=[calls({name:'read_business',args:{}}),calls({name:'emit_answer',args:{intent:'information',title:'Our replacement policy',verdict:'yes',requirements:session.requirements,question:null,bullets:[{text:'Fresh flowers are non-returnable. Delivery damage qualifies for free replacement within 2 hours.',fact_refs:['catalog.returns']}]}})];
    const result=await runMerchantAgent(tenant,session,'What is your replacement policy?',{chat:async()=>responses.shift()!,judge});
    expect(result.selection.verdict).toBe('yes');expect(result.selection.matches).toEqual([]);expect(result.answer.question).toBeNull();expect(result.quote).toBeUndefined();
  });
  it('includes an over-budget add-on proposal as evidence and never prepares it',async()=>{
    const responses=[calls({name:'read_business',args:{}}),calls({name:'evaluate_request',args:{requirements,proposal:{sku:'GB-25R',zone:'kadikoy',addons:['vase']}}}),calls({name:'emit_answer',args:{intent:'purchase',title:'The vase exceeds your budget',verdict:'no',requirements,question:null,bullets:[{text:'With a vase, the total is 1,620 TRY, exceeding your 1,500 TRY budget.',fact_refs:['proposal.total','request.budget']}]}})];
    const result=await runMerchantAgent(tenant,session,'Add a vase under the same budget',{chat:async()=>responses.shift()!,judge});
    expect(result.selection.verdict).toBe('no');expect(result.quote).toBeUndefined();expect(result.selection.facts.find(fact=>fact.fact_ref==='proposal.total')?.value).toBe(1620);
  });
  it('retrieves business data, evaluates requirements and returns model-generated prose',async()=>{
    const responses=[calls({name:'read_catalog',args:{}},{name:'read_delivery_and_policy',args:{}}),calls({name:'evaluate_request',args:{requirements}}),final()];
    const chat=vi.fn(async(_messages:AgentMessage[],_tools:AgentTool[])=>responses.shift()!);
    const result=await runMerchantAgent(tenant,session,'A birthday request',{chat,judge});
    expect(chat).toHaveBeenCalledTimes(3);expect(judge).toHaveBeenCalled();
    expect(result.answer.bullets[0]).toContain('I can deliver your mother’s');
    expect(result.mode.composition).toBe('model');expect(result.mode.extraction).toBe('model');expect(result.requirements).toEqual(requirements);
    const messages=chat.mock.calls[1]?.[0] as AgentMessage[]|undefined;
    expect(messages?.some(message=>message.role==='tool'&&message.content?.includes('GB-25R'))).toBe(true);
  });
  it('exposes complete expanded merchant knowledge to the model through tools',async()=>{
    const rich={...tenant,business_context:{care:{tip:'Refresh the vase water each morning.'},privacy:'We do not print prices on gift cards.'}};
    let observed:AgentMessage[]=[];let index=0;
    const replies=[calls({name:'read_catalog',args:{}},{name:'read_delivery_and_policy',args:{}}),calls({name:'evaluate_request',args:{requirements}}),final()];
    await runMerchantAgent(rich,session,'A birthday request',{chat:async messages=>{observed=structuredClone(messages);return replies[index++];},judge});
    const tools=observed.filter(message=>message.role==='tool').map(message=>JSON.parse(message.content!));
    expect(tools[1].business_context.care.tip).toBe('Refresh the vase water each morning.');
    expect(tools[0].catalog.products['GB-25R'].price).toBe(1280);
    expect(tools[0].facts).toBeUndefined();expect(tools[1].catalog.products).toBeUndefined();
  });
  it('requires tool inspection before a final answer instead of accepting canned output',async()=>{
    let observedFeedback=false;let index=0;
    const replies=[final(),calls({name:'read_catalog',args:{}},{name:'read_delivery_and_policy',args:{}}),calls({name:'evaluate_request',args:{requirements}}),final()];
    await runMerchantAgent(tenant,session,'A birthday request',{chat:async messages=>{if(messages.some(message=>message.role==='tool'&&message.content?.includes('Inspect the business')))observedFeedback=true;return replies[index++];},judge});
    expect(observedFeedback).toBe(true);
  });
  it('returns a retryable error on provider outage and never substitutes a template',async()=>{
    const chat=vi.fn(async()=>{throw new Error('Provider unavailable');});
    await expect(runMerchantAgent(tenant,session,'A birthday request',{chat,judge})).rejects.toMatchObject({code:'agent_unavailable',status:503});
    expect(chat).toHaveBeenCalledTimes(1);
  });
  it('returns an error if the independent judge provider fails',async()=>{
    const replies=[calls({name:'read_catalog',args:{}},{name:'read_delivery_and_policy',args:{}}),calls({name:'evaluate_request',args:{requirements}}),final()];
    await expect(runMerchantAgent(tenant,session,'A birthday request',{chat:async()=>replies.shift()!,judge:async()=>{throw new Error('Judge outage');}})).rejects.toMatchObject({code:'agent_unavailable',status:503});
  });
});
