import {beforeEach,it,expect,vi} from 'vitest';
const queued=vi.hoisted(()=>({submit:vi.fn()}));
vi.mock('@/lib/agent-jobs',()=>({submitAgentQuestion:queued.submit}));
import {POST,OPTIONS} from '../app/t/[tenant]/askagent/route';
const context={params:Promise.resolve({tenant:'rose-and-stem'})};
beforeEach(()=>queued.submit.mockReset());
it('accepts JSON POST and negotiates JSON without a format query',async()=>{
  queued.submit.mockResolvedValue({protocol:'askagent',version:'0.1',kind:'pending',tenant:{id:'rose-and-stem',name:'Rose & Stem'},answer:{title:'Queued',bullets:[],question:null},job:{id:'job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',status:'queued',expires_at:new Date().toISOString()},next:[]});
  const ask='A complex request '.repeat(40);
  const response=await POST(new Request('https://agent.example/t/rose-and-stem/askagent',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({ask})}),context);
  expect(response.status).toBe(200);expect(response.headers.get('Content-Type')).toContain('application/json');
  expect((await response.json()).kind).toBe('pending');expect(queued.submit).toHaveBeenCalledWith('rose-and-stem',ask,undefined,'https://agent.example',expect.any(Headers));
});
it('rejects malformed JSON and unadvertised action fields without queuing work',async()=>{
  for(const body of ['not json',JSON.stringify({ask:'Question',order:true}),JSON.stringify({ask:5})]){
    const response=await POST(new Request('https://agent.example/ask?format=json',{method:'POST',headers:{'Content-Type':'application/json'},body}),context);
    expect(response.status).toBe(400);
  }
  expect(queued.submit).not.toHaveBeenCalled();expect(OPTIONS().status).toBe(204);
});
