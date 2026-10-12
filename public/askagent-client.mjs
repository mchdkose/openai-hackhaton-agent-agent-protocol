// AskAgent 0.1: ordinary fetch, no dependencies, registration or MCP.
export class AskAgentError extends Error {
  constructor(code,message,status=0){super(message);this.name='AskAgentError';this.code=code;this.status=status;}
}
export class AskAgentClient {
  /** @param {{fetch?:typeof globalThis.fetch,pollIntervalMs?:number}} [options] */
  constructor({fetch:request=globalThis.fetch,pollIntervalMs=1500}={}){
    this.fetch=request;this.pollIntervalMs=Math.max(0,pollIntervalMs);this.origins=new WeakMap();
  }
  /** @param {string|URL} origin @param {{signal?:AbortSignal}} [options] */
  async discover(origin,{signal}={}){
    return this.request(new URL('/.well-known/askagent.json',origin),{signal});
  }
  async request(url,options={}){
    const response=await this.fetch(url,{...options,credentials:'omit',headers:{Accept:'application/json',...options.headers}});
    let body;
    try{body=await response.json();}catch{throw new AskAgentError('invalid_response','The website did not return JSON.',response.status);}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new AskAgentError('invalid_response','The website did not return a JSON object.',response.status);
    if(!response.ok||body.kind==='error')throw new AskAgentError(body.error?.code||'http_error',body.error?.message||'The website request failed.',response.status);
    this.origins.set(body,new URL(url).origin);
    return body;
  }
  /** @param {string|URL} endpoint @param {string} ask @param {{h?:string,signal?:AbortSignal,onStatus?:(status:{status?:string,expires_at?:string})=>void,method?:'GET'|'POST'}} [options] */
  async ask(endpoint,ask,{h,signal,onStatus,method='POST'}={}){
    const initial=new URL(endpoint);initial.searchParams.set('format','json');
    let response;
    if(method==='GET'){
      initial.searchParams.set('ask',ask);if(h)initial.searchParams.set('h',h);
      response=await this.request(initial,{signal});
    }else if(method==='POST'){
      response=await this.request(initial,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({ask,...(h?{h}:{})})});
    }else throw new AskAgentError('unsupported_method','Questions use GET or POST.');
    while(response.kind==='pending'){
      onStatus?.({status:response.job?.status,expires_at:response.job?.expires_at});
      const next=response.next?.find(link=>link.rel==='status'&&link.method==='GET');
      if(!next)throw new AskAgentError('status_missing','The pending answer did not include a status link.');
      const url=this.sameOrigin(next.url,initial);url.searchParams.set('format','json');
      if(response.job?.expires_at&&Date.parse(response.job.expires_at)<=Date.now())throw new AskAgentError('job_expired','The website task expired.');
      await this.pause(signal);
      response=await this.request(url,{signal});
    }
    if(response.protocol!=='askagent'||response.version!=='0.1'||response.kind!=='answer')throw new AskAgentError('invalid_answer','Expected an AskAgent 0.1 completed answer.');
    return response;
  }
  /** @param {any} response @param {string} relation @param {{signal?:AbortSignal}} [options] */
  async follow(response,relation,{signal}={}){
    const link=response.next?.find(item=>item.rel===relation&&item.method==='GET');
    if(!link)throw new AskAgentError('link_missing',`No ${relation} link was returned.`);
    if(!['evidence','quote','transcript'].includes(relation))throw new AskAgentError('human_handoff','Open checkout links for human review; this client never submits an order.');
    const origin=this.origins.get(response);
    if(!origin)throw new AskAgentError('unknown_origin','Follow a response received by this client.');
    const url=this.sameOrigin(link.url,new URL(origin));url.searchParams.set('format','json');
    return this.request(url,{signal});
  }
  sameOrigin(value,reference){
    const url=new URL(value,reference);
    if(url.origin!==reference.origin)throw new AskAgentError('origin_changed','The website returned a link to a different origin.');
    return url;
  }
  pause(signal){
    return new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(signal.reason||new AskAgentError('aborted','Request cancelled.'));return;}
      const abort=()=>{clearTimeout(timer);reject(signal.reason||new AskAgentError('aborted','Request cancelled.'));};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},this.pollIntervalMs);
      signal?.addEventListener('abort',abort,{once:true});
    });
  }
}
