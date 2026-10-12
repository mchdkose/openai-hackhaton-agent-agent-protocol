import {describe,it,expect} from 'vitest';
import {runMerchantAgent} from '@/lib/merchant-agent';
import {getTenant} from '@/lib/tenants';
import {blankRequirements} from '@/lib/session';
import {DEMO_QUESTION} from '@/lib/demo';
import {agentChat,currentModelUsage,withModelUsage} from '@/lib/models';
import type {Session} from '@/lib/types';
import {writeFile} from 'node:fs/promises';

describe.skipIf(process.env.LIVE_AGENT_PROBE!=='1')('real provider merchant-agent integration',()=>{
  it('calls the configured real tool model and independent judge with no template',async()=>{
    const tenant=getTenant('rose-and-stem')!;
    const session:Session={h:'h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',tenant:tenant.id,created_at:Date.now(),expires_at:Date.now()+1800000,questions:1,requirements:blankRequirements(),shown:[],note:null,turns:[],assistant:{label:'unknown',confidence:'unknown'}};
    const trace:{milliseconds:number;tools:string[];feedback:unknown[]}[]=[];
    const started=Date.now();
    const probe=await withModelUsage(async()=>({result:await runMerchantAgent(tenant,session,process.env.AGENT_PROBE_ASK||DEMO_QUESTION,{chat:async(messages,tools)=>{
      const roundStart=Date.now();
      const reply=await agentChat(messages,tools);
      trace.push({milliseconds:Date.now()-roundStart,tools:(reply.tool_calls||[]).map(call=>call.function.name),feedback:messages.filter(message=>message.role==='tool').map(message=>JSON.parse(message.content||'{}')).filter(output=>output.error||output.accepted===false).map(output=>output.error||output.invalid_bullets||output.feedback?.map((item:{reason:string})=>item.reason))});
      return reply;
    }}),usage:currentModelUsage()})).catch(error=>{console.error(JSON.stringify({provider_probe_failed:true,cause:error.cause instanceof Error?error.cause.message:'Unknown provider error',trace}));throw error;});
    const report={provider_probe:true,scope:'Local real-provider probe, not public HTTP latency',milliseconds:Date.now()-started,status:probe.result.selection.verdict,model_calls:probe.usage?.calls,input_tokens:probe.usage?.input_tokens,cost_usd:probe.usage?.cost_usd,referee:probe.result.referee.verdict,trace};
    await writeFile('artifacts/agent-benchmark.json',JSON.stringify(report,null,2));
    expect(probe.result.mode.composition).toBe('model');expect(probe.result.selection.verdict).toBe(process.env.AGENT_PROBE_EXPECT_STATUS||'yes');expect(probe.result.answer.bullets.length).toBeGreaterThan(0);expect(probe.result.referee.mode).toBe('model_and_rules');
    console.log(JSON.stringify(report));
  },240000);
});
