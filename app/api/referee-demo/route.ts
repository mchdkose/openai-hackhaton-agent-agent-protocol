import {runRefereeDemo} from '@/lib/service';
import {jsonResult,readObject,verifyOrigin} from '@/lib/http';
import {guardRead,ProtocolError} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request) {
  try{verifyOrigin(request);await guardRead(request.headers);const body=await readObject(request);if(body.tenant!==undefined&&body.tenant!=='petal-atelier')throw new ProtocolError('invalid_demo','The synthetic demonstration is available only for Petal Atelier.');return jsonResult(await runRefereeDemo());}
  catch(error){const known=error instanceof ProtocolError;return jsonResult({ok:false,error:{code:known?error.code:'service_unavailable',message:known?error.message:'The service is temporarily unavailable.'}},known?error.status:503);}
}
