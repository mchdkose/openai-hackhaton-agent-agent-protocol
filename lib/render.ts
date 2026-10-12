import type {AskEnvelope} from './types';
function escape(value:string):string{return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
export function markdown(envelope:AskEnvelope):string {
  const lines=[`# ${envelope.answer.title}`,...envelope.answer.bullets.map(text=>`- ${text}`)];
  if(envelope.answer.question)lines.push('',envelope.answer.question);
  lines.push('',`Demo scenario clock: ${envelope.scenario.clock} (${envelope.scenario.timezone}). This is a demonstration, not a live price or real delivery promise.`);
  if(envelope.mode)lines.push(`Operation mode: extraction=${envelope.mode.extraction}; composition=${envelope.mode.composition}; referee=${envelope.mode.referee}.`);
  lines.push('','[JSON]',JSON.stringify(envelope));
  if(envelope.next.length)lines.push('','Next links:',...envelope.next.map(link=>`${link.label}: ${link.url}`));
  lines.push('','Privacy: do not send names, phone numbers, email addresses or street addresses. Conversation links expire after 30 minutes; anyone holding the link can read the conversation.');
  return lines.join('\n');
}
export function respond(envelope:AskEnvelope,request:Request,status=200):Response {
  const url=new URL(request.url),format=url.searchParams.get('format');
  const headers:Record<string,string>={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Vary':'Accept','Access-Control-Allow-Origin':'*'};
  if(format==='json'||(!format&&request.headers.get('accept')?.includes('application/json'))){headers['Content-Type']='application/json; charset=utf-8';return new Response(JSON.stringify(envelope),{status,headers});}
  const md=markdown(envelope);
  if(format==='html'||(!format&&request.headers.get('accept')?.includes('text/html'))){
    headers['Content-Type']='text/html; charset=utf-8';
    const links=envelope.next.map(link=>`<li><a href="${escape(link.url)}" rel="noreferrer">${escape(link.label)}</a></li>`).join('');
    const body=`<!doctype html><html lang="${envelope.requirements?.language||'en'}"><head><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escape(envelope.answer.title)}</title></head><body><article><h1>${escape(envelope.answer.title)}</h1><ul>${envelope.answer.bullets.map(text=>`<li>${escape(text)}</li>`).join('')}</ul>${envelope.answer.question?`<p>${escape(envelope.answer.question)}</p>`:''}<p>Demo scenario clock: ${escape(envelope.scenario.clock)}</p><script type="application/json" id="askagent-data">${JSON.stringify(envelope).replace(/</g,'\\u003c')}</script><h2>Next links</h2><ul>${links}</ul><pre>${escape(md)}</pre></article></body></html>`;
    return new Response(body,{status,headers});
  }
  headers['Content-Type']='text/markdown; charset=utf-8';return new Response(md,{status,headers});
}
