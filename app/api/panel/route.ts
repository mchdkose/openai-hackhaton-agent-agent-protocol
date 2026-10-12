import {getPanelData} from '@/lib/service';
import {jsonResult} from '@/lib/http';
import {guardRead,ProtocolError} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request){
  try{await guardRead(request.headers);return jsonResult(await getPanelData(new URL(request.url).searchParams.get('tenant')||undefined));}
  catch(error){const known=error instanceof ProtocolError;return jsonResult({ok:false,error:{code:known?error.code:'service_unavailable',message:known?error.message:'The service is temporarily unavailable.'}},known?error.status:503);}
}
