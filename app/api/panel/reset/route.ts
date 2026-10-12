import {jsonResult,verifyAdmin,verifyOrigin} from '@/lib/http';
import {ProtocolError} from '@/lib/session';
import {transact} from '@/lib/store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request){
  try{verifyOrigin(request);verifyAdmin(request);await transact(state=>{state.logs=[];});return jsonResult({ok:true});}
  catch(error){const known=error instanceof ProtocolError;return jsonResult({ok:false,error:{code:known?error.code:'service_unavailable',message:known?error.message:'The service is temporarily unavailable.'}},known?error.status:503);}
}
