import {afterEach,expect,it,vi} from 'vitest';
import {currentModelUsage,structuredModel,withModelUsage} from '../lib/models';

afterEach(()=>{
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('shares one seven-second budget across slow model calls and exposes only public usage',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout','Date','performance']});
  vi.stubEnv('NODE_ENV','production');
  vi.stubEnv('OPENROUTER_API_KEY','test-provider-key');
  vi.stubEnv('ASKAGENT_MODE','model');
  vi.stubEnv('MODEL_BUDGET_MS','');
  vi.stubEnv('MODEL_TIMEOUT_MS','12000');
  const deadlines:number[]=[];
  // Use the fake clock for AbortSignal as well as the simulated provider.
  vi.spyOn(AbortSignal,'timeout').mockImplementation(milliseconds=>{
    deadlines.push(milliseconds);
    const controller=new AbortController();
    setTimeout(()=>controller.abort(new Error('Model timeout')),milliseconds);
    return controller.signal;
  });
  const provider=vi.fn((_url:unknown,init?:RequestInit)=>new Promise<Response>((resolve,reject)=>{
    const timer=setTimeout(()=>resolve(Response.json({choices:[{message:{content:'{"ok":true}'}}],usage:{prompt_tokens:2,completion_tokens:1,cost:0.001}})),3000);
    init!.signal!.addEventListener('abort',()=>{clearTimeout(timer);reject(init!.signal!.reason);},{once:true});
  }));
  vi.stubGlobal('fetch',provider);
  const call=()=>structuredModel<{ok:boolean}>('test/model','test',{},'Test',{});
  const started=performance.now();
  const result=withModelUsage(async()=>{
    expect(await call()).toEqual({ok:true});
    expect(await call()).toEqual({ok:true});
    await expect(call()).rejects.toThrow('Model timeout');
    await expect(call()).rejects.toThrow('Model time budget exhausted');
    return currentModelUsage();
  });
  await vi.advanceTimersByTimeAsync(7000);
  expect(await result).toEqual({calls:2,input_tokens:4,output_tokens:2,cost_usd:0.002});
  expect(deadlines).toEqual([7000,4000,1000]);
  expect(provider).toHaveBeenCalledTimes(3);
  expect(performance.now()-started).toBe(7000);
});
