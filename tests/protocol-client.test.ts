import {describe,it,expect,vi} from 'vitest';
import {AskAgentClient} from '../public/askagent-client.mjs';

const origin='https://agent.example';
const link=(rel:string,path:string)=>({rel,label:rel,method:'GET',url:`${origin}${path}`});
const answer=()=>({protocol:'askagent',version:'0.1',kind:'answer',h:'h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',answer:{title:'A real answer',bullets:['A source-backed result.'],question:null},next:[link('quote','/quote?h=h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),link('checkout','/review')]});
const pending=(attempt:number)=>({protocol:'askagent',version:'0.1',kind:'pending',job:{status:'running',expires_at:new Date(Date.now()+60000).toISOString()},next:[link('status',`/status?attempt=${attempt}`)]});
describe('dependency-free AskAgent client',()=>{
  it('sends a POST, follows returned status URLs, preserves the handle, and reads a quote',async()=>{
    const responses=[pending(1),pending(2),answer(),{kind:'quote',quote:{total:710}}];
    const fetch=vi.fn(async()=>Response.json(responses.shift()));
    const client=new AskAgentClient({fetch,pollIntervalMs:0}),onStatus=vi.fn();
    const response=await client.ask(`${origin}/conversation`,'A custom business request',{h:'h_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',onStatus});
    expect(response.h).toBe('h_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');expect(onStatus).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [URL,RequestInit])[1].body as string)).toEqual({ask:'A custom business request',h:'h_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'});
    expect((fetch.mock.calls[1] as unknown as [URL])[0].searchParams.get('attempt')).toBe('1');
    expect((fetch.mock.calls[2] as unknown as [URL])[0].searchParams.get('attempt')).toBe('2');
    expect((await client.follow(response,'quote')).quote.total).toBe(710);
    await expect(client.follow(response,'checkout')).rejects.toMatchObject({code:'human_handoff'});
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it('rejects status links to other origins before making another request',async()=>{
    const data=pending(1);data.next[0].url='https://other.example/steal';
    const fetch=vi.fn(async()=>Response.json(data));
    await expect(new AskAgentClient({fetch,pollIntervalMs:0}).ask(`${origin}/ask`,'Question')).rejects.toMatchObject({code:'origin_changed'});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('propagates a real agent error and supports cancellation of pending jobs',async()=>{
    const fetch=vi.fn(async()=>Response.json({kind:'error',error:{code:'agent_unavailable',message:'The real agent failed.'}},{status:503}));
    await expect(new AskAgentClient({fetch}).ask(`${origin}/ask`,'Question')).rejects.toMatchObject({code:'agent_unavailable',status:503});
    const controller=new AbortController();
    const queuedFetch=vi.fn(async()=>{controller.abort(new Error('Cancelled'));return Response.json(pending(1));});
    await expect(new AskAgentClient({fetch:queuedFetch}).ask(`${origin}/ask`,'Question',{signal:controller.signal})).rejects.toThrow('Cancelled');
    expect(queuedFetch).toHaveBeenCalledTimes(1);
  });
});
