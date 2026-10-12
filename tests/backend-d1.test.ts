import {describe,expect,it} from 'vitest';
import {d1Transact,privacyHash,storageMode,transact,type D1DatabaseLike,type D1Statement,type State} from '@/lib/store';

function database(initial?:Partial<State>,conflicts=0){
  let row: {version:number;state_json:string}|undefined=initial?{version:0,state_json:JSON.stringify(initial)}:undefined;
  let remainingConflicts=conflicts;
  const db:D1DatabaseLike={prepare(query:string):D1Statement{
    let values:unknown[]=[];
    const statement:D1Statement={bind(...next){values=next;return statement;},async first<T>():Promise<T|null>{
      if(query.startsWith('SELECT'))return row?{...row} as T:null;
      if(query.startsWith('UPDATE')){
        if(remainingConflicts>0){remainingConflicts--;if(row)row.version++;return null;}
        if(!row||row.version!==values[2])return null;
        row={version:row.version+1,state_json:String(values[0])};return {version:row.version} as T;
      }
      throw new Error('Unexpected query');
    },async run(){
      if(query.startsWith('INSERT')&&!row)row={version:0,state_json:String(values[0])};return {success:true};
    }};
    return statement;
  }};
  return {db,state:()=>row?JSON.parse(row.state_json) as State:undefined};
}
describe('Cloudflare D1 state compare-and-swap',()=>{
  it('keeps Worker I/O independent of a Node queue from a previous request',async()=>{
    const mock=database({});
    const runtime=globalThis as unknown as Record<string|symbol,unknown>;
    const symbol=Symbol.for('__cloudflare-context__');
    const previous=runtime[symbol];
    const shared=runtime.__askagentStore as {queue:Promise<unknown>};
    const queue=shared.queue;
    runtime[symbol]={env:{ASKAGENT_DB:mock.db,SESSION_HMAC_SECRET:'test-persistent-hmac'},cf:{},ctx:{}};
    shared.queue=new Promise(()=>undefined);
    try{
      expect(storageMode()).toBe('d1');
      await transact(state=>{state.orders.worker={id:'WORKER',total:1370,created_at:Date.now()};});
      expect(mock.state()?.orders.worker.id).toBe('WORKER');
      const hash=privacyHash('private-handle');
      runtime[symbol]={env:{ASKAGENT_DB:mock.db,SESSION_HMAC_SECRET:'test-persistent-hmac'},cf:{},ctx:{}};
      expect(privacyHash('private-handle')).toBe(hash);
    }finally{shared.queue=queue;if(previous===undefined)delete runtime[symbol];else runtime[symbol]=previous;}
  });
  it('never writes local files when Worker request context is absent',()=>{
    const runtime=globalThis as unknown as Record<string|symbol,unknown>;
    const symbol=Symbol.for('__cloudflare-context__');
    const previous=runtime[symbol],pair=runtime.WebSocketPair;
    delete runtime[symbol];runtime.WebSocketPair=function WebSocketPair(){};
    try{expect(()=>storageMode()).toThrow('Cloudflare request context is unavailable');}
    finally{if(previous!==undefined)runtime[symbol]=previous;if(pair===undefined)delete runtime.WebSocketPair;else runtime.WebSocketPair=pair;}
  });
  it('initializes a persistent document and keeps updates across independent transactions',async()=>{
    const mock=database();
    await d1Transact(mock.db,state=>{state.catalog_overrides['rose-and-stem']={as_of:'2026-10-12T17:05:00+03:00',products:{'GB-25R':{price:1300}},zones:{}};});
    const price=await d1Transact(mock.db,state=>state.catalog_overrides['rose-and-stem'].products['GB-25R'].price);
    expect(price).toBe(1300);
  });
  it('retries a conflicting version without losing another isolate’s update',async()=>{
    const mock=database({limits:{counter:{count:0,expires:Date.now()+60000}}});
    await Promise.all([d1Transact(mock.db,state=>{state.limits.counter.count++;}),d1Transact(mock.db,state=>{state.limits.counter.count++;})]);
    expect(mock.state()?.limits.counter.count).toBe(2);
  });
  it('reruns a pure callback after a compare-and-swap conflict',async()=>{
    const mock=database({},1);let attempts=0;
    const result=await d1Transact(mock.db,state=>{attempts++;state.orders.dedup={id:'DEMO-ONCE',total:1370,created_at:Date.now()};return state.orders.dedup.id;});
    expect(attempts).toBe(2);expect(result).toBe('DEMO-ONCE');expect(Object.keys(mock.state()!.orders)).toEqual(['dedup']);
  });
  it('prunes expired private state before saving',async()=>{
    const mock=database({limits:{old:{count:100,expires:Date.now()-1}},orders:{old:{id:'EXPIRED',total:1,created_at:Date.now()-86400001}},logs:[]});
    await d1Transact(mock.db,()=>undefined);
    expect(mock.state()?.limits).toEqual({});expect(mock.state()?.orders).toEqual({});
  });
  it('fails instead of overflowing the bounded D1 document',async()=>{
    const mock=database({});
    await expect(d1Transact(mock.db,state=>{state.orders['x'.repeat(1500000)]={id:'DEMO',total:1,created_at:Date.now()};})).rejects.toThrow('capacity reached');
    expect(mock.state()?.orders).toBeUndefined();
  });
  it('bounds conflict retries and never silently falls back to ephemeral files',async()=>{
    const mock=database({},20);
    await expect(d1Transact(mock.db,state=>{state.orders.failed={id:'FAILED',total:1,created_at:Date.now()};})).rejects.toThrow('storage busy');
    expect(mock.state()?.orders).toBeUndefined();
  });
});
