import {executeAgentJob} from '@/lib/agent-jobs';
import {jsonResult,readObject,verifyAdmin,verifyOrigin} from '@/lib/http';
import {ProtocolError} from '@/lib/session';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request){
  try{
    verifyAdmin(request);verifyOrigin(request);
    const body=await readObject(request);
    if(typeof body.jobId!=='string')throw new ProtocolError('invalid_request','An agent task ID is required.');
    return jsonResult(await executeAgentJob(body.jobId));
  }catch(error){
    const known=error instanceof ProtocolError;
    return jsonResult({ok:false,error:{code:known?error.code:'agent_unavailable',message:known?error.message:'The real merchant agent could not finish this task.'}},known?error.status:503);
  }
}
